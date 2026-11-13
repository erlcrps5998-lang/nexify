import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {can,permissionsFor} from '@/lib/permissions';
type Ctx={params:Promise<{id:string}>};
const staffRoles=['OWNER','ADMIN','MODERATOR','STAFF'];
async function getActor(params:Ctx['params']){
 const session=await getServerSession(authOptions);
 const discordId=(session?.user as {discordId?:string}|undefined)?.discordId;
 if(!discordId)return null;
 const user=await prisma.user.findUnique({where:{discordId}});
 if(!user)return null;
 const {id}=await params;
 const membership=await prisma.membership.findUnique({where:{userId_communityId:{userId:user.id,communityId:id}}});
 if(!membership)return null;
 const community=await prisma.community.findUnique({where:{id},select:{id:true,name:true,weeklyShiftQuotaMinutes:true}});
 return community?{community,membership}:null;
}
const isManager=(role:string)=>role==='OWNER'||role==='ADMIN';
function weekStart(now:Date){
 const t=new Date(now);
 t.setUTCHours(0,0,0,0);
 t.setUTCDate(t.getUTCDate()-((t.getUTCDay()+6)%7));
 return t;
}
export async function GET(_request:Request,{params}:Ctx){
 try{
  const actor=await getActor(params);
  if(!actor)return NextResponse.json({error:'Community access required'},{status:403});
  const {community,membership}=actor;
  if(!(await can(membership,community.id,'shifts.view')))return NextResponse.json({error:'Staff role required'},{status:403});
  const now=new Date(),start=weekStart(now);
  const staff=await prisma.membership.findMany({where:{communityId:community.id,role:{in:['OWNER','ADMIN','MODERATOR','STAFF']}},include:{user:{select:{name:true,avatar:true}}}});
  const shifts=await prisma.shift.findMany({where:{communityId:community.id,OR:[{startedAt:{gte:start}},{endedAt:{gte:start}},{endedAt:null}]},include:{activities:{orderBy:{createdAt:'desc'},take:100}},orderBy:{startedAt:'desc'},take:700});
  const stats=staff.map(m=>{
   const related=shifts.filter(s=>s.membershipId===m.id);
   const totalMs=related.reduce((sum,s)=>{
    const begin=Math.max(s.startedAt.getTime(),start.getTime());
    const end=Math.min((s.endedAt||now).getTime(),now.getTime());
    return sum+Math.max(0,end-begin);
   },0);
   return {membershipId:m.id,name:m.user.name,avatar:m.user.avatar,role:m.role,minutes:Math.floor(totalMs/60000),active:related.some(s=>s.endedAt===null),activityCount:related.reduce((sum,s)=>sum+s.activities.length,0)};
  }).sort((a,b)=>b.minutes-a.minutes||a.name.localeCompare(b.name));
  const myActive=shifts.find(s=>s.membershipId===membership.id&&s.endedAt===null);
  const history=shifts.filter(s=>isManager(membership.role)||s.membershipId===membership.id).slice(0,100).map(s=>({
    id:s.id,memberName:staff.find(m=>m.id===s.membershipId)?.user.name||'Staff member',mine:s.membershipId===membership.id,
    startedAt:s.startedAt.toISOString(),endedAt:s.endedAt?.toISOString()||null,
    activities:s.activities.map(a=>({id:a.id,category:a.category,note:a.note,createdAt:a.createdAt.toISOString()}))
  }));
  return NextResponse.json({communityName:community.name,quotaMinutes:community.weeklyShiftQuotaMinutes,weekStarts:start.toISOString(),myRole:membership.role,myActiveShiftId:myActive?.id||null,mySuspended:!!membership.suspendedUntil&&membership.suspendedUntil>now,permissions:await permissionsFor(membership,community.id),leaderboard:stats,history});
 }catch{return NextResponse.json({error:'Could not load shifts'},{status:503});}
}
export async function POST(req:Request,{params}:Ctx){
 try{
  const actor=await getActor(params);
  if(!actor||!(await can(actor.membership,actor.community.id,'shifts.manage')))return NextResponse.json({error:'Staff membership required'},{status:403});
  const {community,membership}=actor;
  if(membership.suspendedUntil&&membership.suspendedUntil>new Date())return NextResponse.json({error:'Your staff access is suspended'},{status:403});
  const body=await req.json() as {action?:unknown;category?:unknown;note?:unknown};
  if(!body||typeof body.action!=='string')return NextResponse.json({error:'Invalid action'},{status:400});
  const current=await prisma.shift.findFirst({where:{membershipId:membership.id,endedAt:null},orderBy:{startedAt:'desc'}});
  if(body.action==='clockIn'){
   if(current)return NextResponse.json({error:'You are already clocked in'},{status:409});
   await prisma.shift.create({data:{communityId:community.id,membershipId:membership.id}});
   return NextResponse.json({success:true},{status:201});
  }
  if(body.action==='clockOut'){
   if(!current)return NextResponse.json({error:'You are not clocked in'},{status:409});
   const result=await prisma.shift.updateMany({where:{id:current.id,endedAt:null},data:{endedAt:new Date()}});
   if(!result.count)return NextResponse.json({error:'Shift already ended'},{status:409});
   return NextResponse.json({success:true});
  }
  if(body.action==='activity'){
   if(!current)return NextResponse.json({error:'Clock in before logging activities'},{status:409});
   if(typeof body.category!=='string'||!['Patrol','Training','Moderation','Support','Other'].includes(body.category)||typeof body.note!=='string'||body.note.trim().length<3||body.note.length>300)return NextResponse.json({error:'Choose a category and enter a note (3–300 characters)'},{status:400});
   await prisma.shiftActivity.create({data:{shiftId:current.id,category:body.category,note:body.note.trim()}});
   return NextResponse.json({success:true},{status:201});
  }
  return NextResponse.json({error:'Unknown action'},{status:400});
 }catch{return NextResponse.json({error:'Could not update shift'},{status:503});}
}
export async function PATCH(req:Request,{params}:Ctx){
 try{
  const actor=await getActor(params);
  if(!actor||!(await can(actor.membership,actor.community.id,'shifts.quota')))return NextResponse.json({error:'Only owners and admins can set quotas'},{status:403});
  if(actor.membership.suspendedUntil&&actor.membership.suspendedUntil>new Date())return NextResponse.json({error:'Staff access suspended'},{status:403});
  const body=await req.json() as {quotaMinutes?:unknown};
  if(!Number.isInteger(body?.quotaMinutes)||typeof body.quotaMinutes!=='number'||body.quotaMinutes<0||body.quotaMinutes>10080)return NextResponse.json({error:'Quota must be 0–10080 minutes'},{status:400});
  await prisma.community.update({where:{id:actor.community.id},data:{weeklyShiftQuotaMinutes:body.quotaMinutes}});
  return NextResponse.json({success:true});
 }catch{return NextResponse.json({error:'Unable to save quota'},{status:503});}
}
