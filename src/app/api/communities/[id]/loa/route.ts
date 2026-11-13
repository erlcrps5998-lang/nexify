import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {authOptions} from '@/lib/auth';
type Ctx={params:Promise<{id:string}>};
async function actor(params:Ctx['params']){
 const session=await getServerSession(authOptions);
 const discordId=(session?.user as {discordId?:string}|undefined)?.discordId;
 if(!discordId)return null;
 const user=await prisma.user.findUnique({where:{discordId}});
 if(!user)return null;
 const {id}=await params;
 const membership=await prisma.membership.findUnique({where:{userId_communityId:{userId:user.id,communityId:id}}});
 return membership?{id,membership}:null;
}
const manager=(role:string)=>role==='OWNER'||role==='ADMIN';
async function getRequests(id:string,viewer:{id:string;role:string}){
 const requests=await prisma.leaveRequest.findMany({
  where:{membership:{communityId:id},...(manager(viewer.role)?{}:{membershipId:viewer.id})},
  include:{membership:{include:{user:{select:{name:true,discordId:true}}}}},
  orderBy:{createdAt:'desc'},take:150
 });
 return requests.map(r=>({id:r.id,membershipId:r.membershipId,name:r.membership.user.name,role:r.membership.role,startDate:r.startDate.toISOString(),endDate:r.endDate.toISOString(),reason:r.reason,status:r.status,reviewerNote:r.reviewerNote||'',createdAt:r.createdAt.toISOString()}));
}
export async function GET(_req:Request,{params}:Ctx){
 try{const a=await actor(params);if(!a)return NextResponse.json({error:'Access denied'},{status:403});return NextResponse.json(await getRequests(a.id,a.membership));}
 catch{return NextResponse.json({error:'Unable to load LOAs'},{status:503});}
}
export async function POST(req:Request,{params}:Ctx){
 try{
  const a=await actor(params);
  if(!a||a.membership.role==='MEMBER')return NextResponse.json({error:'Staff membership required'},{status:403});
  const body=await req.json();
  const {startDate,endDate,reason}=body as Record<string,unknown>;
  if(typeof startDate!=='string'||typeof endDate!=='string'||typeof reason!=='string'||reason.trim().length<5||reason.length>500)return NextResponse.json({error:'Provide dates and a reason (5–500 characters)'},{status:400});
  const start=new Date(startDate+'T00:00:00.000Z'),end=new Date(endDate+'T00:00:00.000Z');
  const today=new Date();today.setUTCHours(0,0,0,0);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start<today||end<start||end.getTime()-start.getTime()>90*86400000)return NextResponse.json({error:'Choose valid upcoming dates within a 90-day leave'},{status:400});
  const pending=await prisma.leaveRequest.count({where:{membershipId:a.membership.id,status:'PENDING'}});
  if(pending>=5)return NextResponse.json({error:'You already have five pending LOA requests'},{status:409});
  await prisma.leaveRequest.create({data:{membershipId:a.membership.id,startDate:start,endDate:end,reason:reason.trim()}});
  return NextResponse.json(await getRequests(a.id,a.membership),{status:201});
 }catch{return NextResponse.json({error:'Unable to request leave'},{status:503});}
}
export async function PATCH(req:Request,{params}:Ctx){
 try{
  const a=await actor(params);
  if(!a)return NextResponse.json({error:'Access denied'},{status:403});
  if(a.membership.suspendedUntil&&a.membership.suspendedUntil>new Date())return NextResponse.json({error:'Staff permissions suspended'},{status:403});
  const {requestId,status,reviewerNote}=await req.json();
  if(typeof requestId!=='string'||typeof status!=='string'||typeof reviewerNote!=='string'||reviewerNote.length>500)return NextResponse.json({error:'Invalid request'},{status:400});
  const request=await prisma.leaveRequest.findFirst({where:{id:requestId,membership:{communityId:a.id}},include:{membership:true}});
  if(!request||request.status!=='PENDING')return NextResponse.json({error:'Request not found or already reviewed'},{status:404});
  if(status==='CANCELLED'){
    if(request.membershipId!==a.membership.id)return NextResponse.json({error:'Only the requester can cancel their LOA'},{status:403});
  }else if(status==='APPROVED'||status==='DENIED'){
    if(!manager(a.membership.role)||request.membershipId===a.membership.id)return NextResponse.json({error:'Managers cannot approve their own requests'},{status:403});
    if(a.membership.role==='ADMIN'&&['OWNER','ADMIN'].includes(request.membership.role))return NextResponse.json({error:'Only the owner can review admin leave'},{status:403});
  }else return NextResponse.json({error:'Invalid status'},{status:400});
  const result=await prisma.leaveRequest.updateMany({where:{id:requestId,status:'PENDING'},data:{status:status as 'APPROVED'|'DENIED'|'CANCELLED',reviewerNote:reviewerNote.trim()||null,reviewedAt:new Date()}});
  if(result.count!==1)return NextResponse.json({error:'Request already changed'},{status:409});
  return NextResponse.json(await getRequests(a.id,a.membership));
 }catch{return NextResponse.json({error:'Unable to update leave request'},{status:503});}
}
