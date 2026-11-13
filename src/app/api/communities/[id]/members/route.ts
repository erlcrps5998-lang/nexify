import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
type Ctx={params:Promise<{id:string}>};
type Role='OWNER'|'ADMIN'|'MODERATOR'|'STAFF'|'MEMBER';
const roles:Role[]=['OWNER','ADMIN','MODERATOR','STAFF','MEMBER'];
async function auth(params:Ctx['params']){
 const session=await getServerSession(authOptions);
 const discordId=(session?.user as {discordId?:string}|undefined)?.discordId;
 if(!discordId)return null;
 const user=await prisma.user.findUnique({where:{discordId}});
 if(!user)return null;
 const {id}=await params;
 const member=await prisma.membership.findUnique({where:{userId_communityId:{userId:user.id,communityId:id}}});
 if(!member)return null;
 return {id,member};
}
function allowed(actor:Role,role:Role){return actor==='OWNER'?role!=='OWNER':actor==='ADMIN'&&['MODERATOR','STAFF','MEMBER'].includes(role);}
async function list(id:string){
 const members=await prisma.membership.findMany({where:{communityId:id},include:{user:{select:{id:true,discordId:true,name:true,avatar:true}}},orderBy:{user:{name:'asc'}}});
 return members.map(m=>({id:m.id,role:m.role,user:m.user}));
}
export async function GET(_req:Request,{params}:Ctx){
 try{const c=await auth(params);if(!c)return NextResponse.json({error:'Access denied'},{status:403});return NextResponse.json(await list(c.id));}
 catch{return NextResponse.json({error:'Unable to load members'},{status:503});}
}
export async function POST(req:Request,{params}:Ctx){
 try{
  const c=await auth(params);
  if(!c||!['OWNER','ADMIN'].includes(c.member.role)||(c.member.suspendedUntil&&c.member.suspendedUntil>new Date()))return NextResponse.json({error:'Permission denied'},{status:403});
  const {discordId,role}=await req.json();
  if(typeof discordId!=='string'||!/^[0-9]{17,20}$/.test(discordId))return NextResponse.json({error:'Enter a valid Discord user ID'},{status:400});
  if(!roles.includes(role)||!allowed(c.member.role,role))return NextResponse.json({error:'Cannot assign that role'},{status:403});
  const user=await prisma.user.upsert({where:{discordId},update:{},create:{discordId,name:'Discord user '+discordId.slice(-4)}});
  const existing=await prisma.membership.findUnique({where:{userId_communityId:{userId:user.id,communityId:c.id}}});
  if(existing)return NextResponse.json({error:'Already a member'},{status:409});
  await prisma.membership.create({data:{communityId:c.id,userId:user.id,role}});
  return NextResponse.json(await list(c.id),{status:201});
 }catch{return NextResponse.json({error:'Unable to add member'},{status:503});}
}
export async function PATCH(req:Request,{params}:Ctx){
 try{
  const c=await auth(params);
  if(!c||!['OWNER','ADMIN'].includes(c.member.role)||(c.member.suspendedUntil&&c.member.suspendedUntil>new Date()))return NextResponse.json({error:'Permission denied'},{status:403});
  const {membershipId,role}=await req.json();
  if(typeof membershipId!=='string'||!roles.includes(role)||!allowed(c.member.role,role))return NextResponse.json({error:'Invalid role or membership'},{status:400});
  const target=await prisma.membership.findFirst({where:{id:membershipId,communityId:c.id}});
  if(!target||!allowed(c.member.role,target.role))return NextResponse.json({error:'Cannot edit this member'},{status:403});
  await prisma.membership.update({where:{id:target.id},data:{role}});
  return NextResponse.json(await list(c.id));
 }catch{return NextResponse.json({error:'Unable to update member'},{status:503});}
}
export async function DELETE(req:Request,{params}:Ctx){
 try{
  const c=await auth(params);
  if(!c||!['OWNER','ADMIN'].includes(c.member.role)||(c.member.suspendedUntil&&c.member.suspendedUntil>new Date()))return NextResponse.json({error:'Permission denied'},{status:403});
  const {membershipId}=await req.json();
  if(typeof membershipId!=='string')return NextResponse.json({error:'Invalid member'},{status:400});
  const target=await prisma.membership.findFirst({where:{id:membershipId,communityId:c.id}});
  if(!target||!allowed(c.member.role,target.role))return NextResponse.json({error:'Cannot remove this member'},{status:403});
  await prisma.membership.delete({where:{id:target.id}});
  return NextResponse.json(await list(c.id));
 }catch{return NextResponse.json({error:'Unable to remove member'},{status:503});}
}
