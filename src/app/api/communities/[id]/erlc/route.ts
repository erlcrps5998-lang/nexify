import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {can} from '@/lib/permissions';
import {decryptServerKey,encryptServerKey,ErlcApiError,fetchErlcServer} from '@/lib/erlc';

export const runtime='nodejs';
type Ctx={params:Promise<{id:string}>};
async function actor(params:Ctx['params']){
 const session=await getServerSession(authOptions);
 const discordId=(session?.user as {discordId?:string}|undefined)?.discordId;
 if(!discordId)return null;
 const user=await prisma.user.findUnique({where:{discordId}});
 if(!user)return null;
 const {id}=await params;
 const membership=await prisma.membership.findUnique({where:{userId_communityId:{userId:user.id,communityId:id}}});
 if(!membership)return null;
 const suspended=!!membership.suspendedUntil&&membership.suspendedUntil>new Date();
 return {id,role:membership.role,suspended,viewer:!suspended&&await can(membership,id,'erlc.view'),manager:!suspended&&await can(membership,id,'erlc.connect')};
}
const permitted=(role:string)=>['OWNER','ADMIN','MODERATOR','STAFF'].includes(role);
const error=(e:unknown,defaultMessage:string)=>{
 if(e instanceof ErlcApiError)return NextResponse.json({error:e.message},{status:e.status});
 return NextResponse.json({error:defaultMessage},{status:503});
};
export async function GET(_req:Request,{params}:Ctx){
 try{
  const a=await actor(params);
  if(!a||!a.viewer||a.suspended)return NextResponse.json({error:'Active community staff membership required'},{status:403});
  const connection=await prisma.erlcConnection.findUnique({where:{communityId:a.id}});
  if(!connection)return NextResponse.json({connected:false,manager:a.manager});
  let live;
  try{live=await fetchErlcServer(decryptServerKey(connection.encryptedServerKey));}
  catch(e){
   if(e instanceof ErlcApiError)return NextResponse.json({connected:true,manager:a.manager,serverName:connection.serverName,connectedAt:connection.connectedAt.toISOString(),live:null,error:e.message,apiStatus:e.status});
   throw e;
  }
  if(live.name!==connection.serverName)await prisma.erlcConnection.update({where:{id:connection.id},data:{serverName:live.name}}).catch(()=>{});
  return NextResponse.json({connected:true,manager:a.manager,serverName:live.name,connectedAt:connection.connectedAt.toISOString(),live});
 }catch(e){return error(e,'Unable to load ER:LC server information');}
}
export async function POST(req:Request,{params}:Ctx){
 try{
  const a=await actor(params);
  if(!a||!a.manager)return NextResponse.json({error:'Only active community owners and admins can connect a server'},{status:403});
  const body=await req.json() as {serverKey?:unknown};
  if(!body||typeof body.serverKey!=='string'||body.serverKey.trim().length<8||body.serverKey.trim().length>250||/[\r\n]/.test(body.serverKey))return NextResponse.json({error:'Enter a valid ER:LC Server Key'},{status:400});
  const key=body.serverKey.trim();
  // Validate with PRC before storing; the key is never returned to the browser.
  const live=await fetchErlcServer(key);
  await prisma.erlcConnection.upsert({where:{communityId:a.id},update:{encryptedServerKey:encryptServerKey(key),serverName:live.name},create:{communityId:a.id,encryptedServerKey:encryptServerKey(key),serverName:live.name}});
  return NextResponse.json({connected:true,serverName:live.name},{status:201});
 }catch(e){return error(e,'Unable to connect the server');}
}
export async function DELETE(_req:Request,{params}:Ctx){
 try{
  const a=await actor(params);
  if(!a||!a.manager)return NextResponse.json({error:'Only active community owners and admins can disconnect a server'},{status:403});
  await prisma.erlcConnection.deleteMany({where:{communityId:a.id}});
  return NextResponse.json({connected:false});
 }catch(e){return error(e,'Unable to disconnect the server');}
}
