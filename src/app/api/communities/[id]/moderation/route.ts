import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';

type Context={params:Promise<{id:string}>};
type Action='WARNING'|'KICK'|'BAN'|'UNBAN';
type Role='OWNER'|'ADMIN'|'MODERATOR'|'STAFF'|'MEMBER';
const permission:Record<Role,Action[]>={
 OWNER:['WARNING','KICK','BAN','UNBAN'],
 ADMIN:['WARNING','KICK','BAN','UNBAN'],
 MODERATOR:['WARNING','KICK'],
 STAFF:['WARNING'],
 MEMBER:[]
};
const labels:Action[]=['WARNING','KICK','BAN','UNBAN'];
async function actor(params:Context['params']){
 const session=await getServerSession(authOptions);
 const discordId=(session?.user as {discordId?:string}|undefined)?.discordId;
 if(!discordId)return null;
 const user=await prisma.user.findUnique({where:{discordId}});
 if(!user)return null;
 const {id}=await params;
 const membership=await prisma.membership.findUnique({where:{userId_communityId:{userId:user.id,communityId:id}}});
 return membership?{id,user,membership}:null;
}
export async function GET(_req:Request,{params}:Context){
 try{
  const a=await actor(params);
  if(!a)return NextResponse.json({error:'Community access required'},{status:403});
  const role=a.membership.role as Role;
  if(role==='MEMBER')return NextResponse.json({error:'Staff role required'},{status:403});
  const logs=await prisma.moderationLog.findMany({where:{communityId:a.id},orderBy:{createdAt:'desc'},take:250});
  return NextResponse.json({role,permissions:permission[role],suspended:!!a.membership.suspendedUntil&&a.membership.suspendedUntil>new Date(),logs:logs.map(log=>({
   id:log.id,action:log.action,targetRobloxId:log.targetRobloxId,targetRobloxName:log.targetRobloxName,
   reason:log.reason,actorName:log.actorName||'Staff member',createdAt:log.createdAt.toISOString()
  }))});
 }catch{return NextResponse.json({error:'Could not load moderation records'},{status:503});}
}
export async function POST(req:Request,{params}:Context){
 try{
  const a=await actor(params);
  if(!a)return NextResponse.json({error:'Community access required'},{status:403});
  const role=a.membership.role as Role;
  if(a.membership.suspendedUntil&&a.membership.suspendedUntil>new Date())return NextResponse.json({error:'Staff access is suspended'},{status:403});
  const body=await req.json() as Record<string,unknown>;
  if(!body||typeof body.action!=='string'||!labels.includes(body.action as Action))return NextResponse.json({error:'Choose a valid moderation action'},{status:400});
  const action=body.action as Action;
  if(!permission[role].includes(action))return NextResponse.json({error:'Your role cannot record this action'},{status:403});
  if(typeof body.targetRobloxId!=='string'||!/^\d{1,20}$/.test(body.targetRobloxId)||BigInt(body.targetRobloxId)===0n)return NextResponse.json({error:'Enter a valid numeric Roblox user ID'},{status:400});
  if(typeof body.targetRobloxName!=='string'||body.targetRobloxName.length>50)return NextResponse.json({error:'Roblox username must be at most 50 characters'},{status:400});
  if(typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>500)return NextResponse.json({error:'Reason must be 5–500 characters'},{status:400});
  const saved=await prisma.moderationLog.create({data:{
    communityId:a.id,actorId:a.user.id,actorName:a.user.name,
    targetRobloxId:body.targetRobloxId,targetRobloxName:body.targetRobloxName.trim()||null,
    action,reason:body.reason.trim()
  }});
  return NextResponse.json({success:true,id:saved.id},{status:201});
 }catch{return NextResponse.json({error:'Could not save moderation record'},{status:503});}
}
