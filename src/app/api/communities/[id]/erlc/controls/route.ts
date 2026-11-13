import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {authOptions} from '@/lib/auth';
import {decryptServerKey} from '@/lib/erlc';

export const runtime='nodejs';
type Ctx={params:Promise<{id:string}>};
type Action='ANNOUNCE'|'MESSAGE'|'PM'|'KICK'|'BAN'|'UNBAN';
const permissions:Record<string,Action[]>={
 OWNER:['ANNOUNCE','MESSAGE','PM','KICK','BAN','UNBAN'],
 ADMIN:['ANNOUNCE','MESSAGE','PM','KICK','BAN','UNBAN'],
 MODERATOR:['ANNOUNCE','MESSAGE','PM','KICK'],
 STAFF:['ANNOUNCE','PM'],
 MEMBER:[]
};
const allowedActions=['ANNOUNCE','MESSAGE','PM','KICK','BAN','UNBAN'];
async function actor(params:Ctx['params']){
 const session=await getServerSession(authOptions);
 const discordId=(session?.user as {discordId?:string}|undefined)?.discordId;
 if(!discordId)return null;
 const user=await prisma.user.findUnique({where:{discordId}});
 if(!user)return null;
 const {id}=await params;
 const membership=await prisma.membership.findUnique({where:{userId_communityId:{userId:user.id,communityId:id}}});
 if(!membership)return null;
 return {id,user,membership,suspended:!!membership.suspendedUntil&&membership.suspendedUntil>new Date()};
}
const fail=(message:string,status:number)=>NextResponse.json({error:message},{status});
export async function GET(_request:Request,{params}:Ctx){
 try{
  const a=await actor(params);
  if(!a||a.suspended||a.membership.role==='MEMBER')return fail('Active community staff membership required',403);
  const connection=await prisma.erlcConnection.findUnique({where:{communityId:a.id},select:{id:true,serverName:true}});
  const logs=await prisma.erlcCommandLog.findMany({where:{communityId:a.id},orderBy:{createdAt:'desc'},take:100,
   select:{id:true,actorName:true,actorRole:true,action:true,target:true,status:true,response:true,createdAt:true,completedAt:true}});
  return NextResponse.json({connected:!!connection,serverName:connection?.serverName||null,role:a.membership.role,permissions:permissions[a.membership.role],logs:logs.map(l=>({...l,createdAt:l.createdAt.toISOString(),completedAt:l.completedAt?.toISOString()||null}))});
 }catch{return fail('Could not load command controls',503);}
}
function commandFor(action:Action,target:unknown,message:unknown){
 const cleanTarget=typeof target==='string'?target.trim():'';
 const cleanMessage=typeof message==='string'?message.trim():'';
 // Never accept free-form commands. Target must be a single exact username, not all/others.
 const playerOk=/^[a-zA-Z0-9_]{3,20}$/.test(cleanTarget)&&!['all','others','me','staff','admins','moderators'].includes(cleanTarget.toLowerCase());
 const textOk=cleanMessage.length>=3&&cleanMessage.length<=180&&!/[\r\n\u0000-\u001F]/.test(cleanMessage);
 if(action==='ANNOUNCE'||action==='MESSAGE'){
  if(!textOk)return null;
  return {command:(action==='ANNOUNCE'?':h ':':m ')+cleanMessage,target:null};
 }
 if(action==='PM'){
  if(!playerOk||!textOk)return null;
  return {command:':pm '+cleanTarget+' '+cleanMessage,target:cleanTarget};
 }
 if(action==='KICK'||action==='BAN'||action==='UNBAN'){
  if(!playerOk)return null;
  return {command:':'+action.toLowerCase()+' '+cleanTarget,target:cleanTarget};
 }
 return null;
}
export async function POST(req:Request,{params}:Ctx){
 try{
  const a=await actor(params);
  if(!a||a.suspended||a.membership.role==='MEMBER')return fail('Active community staff membership required',403);
  const role=a.membership.role;
  const body=await req.json() as Record<string,unknown>;
  if(!body||typeof body.action!=='string'||!allowedActions.includes(body.action))return fail('Choose an allowed command type',400);
  const action=body.action as Action;
  if(!permissions[role].includes(action))return fail('You do not have permission for this command',403);
  const payload=commandFor(action,body.target,body.message);
  if(!payload)return fail('Enter a valid player username and/or message',400);
  const connection=await prisma.erlcConnection.findUnique({where:{communityId:a.id}});
  if(!connection)return fail('Connect an ER:LC server first',409);
  const since=new Date(Date.now()-15000);
  const last=await prisma.erlcCommandLog.findFirst({where:{actorId:a.user.id,communityId:a.id,createdAt:{gte:since}},orderBy:{createdAt:'desc'}});
  if(last)return fail('Please allow 15 seconds between commands.',429);
  const log=await prisma.erlcCommandLog.create({data:{communityId:a.id,actorId:a.user.id,actorName:a.user.name,actorRole:role,action,target:payload.target,command:payload.command,status:'PENDING'}});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch('https://api.erlc.gg/v2/server/command',{
    method:'POST',headers:{'Server-Key':decryptServerKey(connection.encryptedServerKey),'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({command:payload.command}),cache:'no-store',signal:controller.signal
   });
   let result:unknown={};
   try{result=await response.json();}catch{}
   const parsed=(result&&typeof result==='object'&&!Array.isArray(result))?result as Record<string,unknown>:{};
   const message=typeof parsed.message==='string'?parsed.message:typeof parsed.Message==='string'?parsed.Message:'';
   const ok=response.ok&&parsed.success!==false&&parsed.Success!==false;
   const status=ok?'SUCCESS':'FAILED';
   const reason=ok?(message||'Accepted by ER:LC API'):(response.status===429?'ER:LC rate limit reached':response.status===401||response.status===403?'ER:LC rejected the command or server authorization':message||'ER:LC returned HTTP '+response.status);
   await prisma.erlcCommandLog.update({where:{id:log.id},data:{status,response:reason.slice(0,350),completedAt:new Date()}});
   if(!ok)return fail(reason,response.status===429?429:502);
   return NextResponse.json({success:true,logId:log.id,message:reason});
  }catch{
   await prisma.erlcCommandLog.update({where:{id:log.id},data:{status:'FAILED',response:'ER:LC command request timed out or failed',completedAt:new Date()}}).catch(()=>{});
   return fail('ER:LC did not confirm the command. Check the command log before retrying.',503);
  }finally{clearTimeout(timer);}
 }catch{return fail('Could not process command',503);}
}
