import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {can,permissionsFor} from '@/lib/permissions';
type Context={params:Promise<{id:string}>};
async function actor(params:Context['params']){
 const session=await getServerSession(authOptions);
 const discordId=(session?.user as {discordId?:string}|undefined)?.discordId;
 if(!discordId)return null;
 const user=await prisma.user.findUnique({where:{discordId}});
 if(!user)return null;
 const {id}=await params;
 const membership=await prisma.membership.findUnique({where:{userId_communityId:{userId:user.id,communityId:id}}});
 return membership?{id,membership}:null;
}
export async function GET(_req:Request,{params}:Context){
 try{
  const a=await actor(params);
  if(!a)return NextResponse.json({error:'Access denied'},{status:403});
  const members=await prisma.membership.findMany({where:{communityId:a.id,role:{not:'MEMBER'}},include:{user:{select:{name:true,discordId:true,avatar:true}}},orderBy:{user:{name:'asc'}}});
  return NextResponse.json({myMembershipId:a.membership.id,myRole:a.membership.role,permissions:await permissionsFor(a.membership,a.id),mySuspended:!!a.membership.suspendedUntil&&a.membership.suspendedUntil>new Date(),staff:members.map(m=>({id:m.id,name:m.user.name,discordId:m.user.discordId,avatar:m.user.avatar,role:m.role,title:m.staffTitle||'',suspendedUntil:m.suspendedUntil?.toISOString()||null,suspensionReason:m.suspensionReason||'',rankId:m.rankId}))});
 }catch{return NextResponse.json({error:'Unable to load staff'},{status:503});}
}
export async function PATCH(req:Request,{params}:Context){
 try{
  const a=await actor(params);
  if(!a||!(await can(a.membership,a.id,'staff.manage')))return NextResponse.json({error:'Permission denied'},{status:403});
  if(a.membership.suspendedUntil&&a.membership.suspendedUntil>new Date())return NextResponse.json({error:'Your staff access is suspended'},{status:403});
  const body=await req.json();
  if(!body||typeof body!=='object')return NextResponse.json({error:'Invalid request'},{status:400});
  const {membershipId,title,suspendedUntil,suspensionReason}=body as Record<string,unknown>;
  if(typeof membershipId!=='string'||typeof title!=='string'||title.length>60||typeof suspensionReason!=='string'||suspensionReason.length>300||(suspendedUntil!==null&&typeof suspendedUntil!=='string'))return NextResponse.json({error:'Invalid staff details'},{status:400});
  const target=await prisma.membership.findFirst({where:{id:membershipId,communityId:a.id}});
  if(!target||target.role==='MEMBER'||target.id===a.membership.id)return NextResponse.json({error:'Cannot modify this staff member'},{status:403});
  if(a.membership.role==='ADMIN'&&!['MODERATOR','STAFF'].includes(target.role))return NextResponse.json({error:'Admins cannot modify owners or other admins'},{status:403});
  if(target.role==='OWNER')return NextResponse.json({error:'The community owner cannot be suspended or modified'},{status:403});
  let until:Date|null=null;
  if(suspendedUntil){
   until=new Date(suspendedUntil);
   if(Number.isNaN(until.getTime())||until.getTime()<=Date.now()||until.getTime()>Date.now()+365*86400000)return NextResponse.json({error:'Choose a future suspension end date within one year'},{status:400});
  }
  await prisma.membership.update({where:{id:target.id},data:{staffTitle:title.trim()||null,suspendedUntil:until,suspensionReason:until?suspensionReason.trim()||null:null}});
  return NextResponse.json({success:true});
 }catch{return NextResponse.json({error:'Could not update staff member'},{status:503});}
}
