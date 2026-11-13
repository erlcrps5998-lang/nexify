import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {ALL_PERMISSIONS,allowedKeys,permissionsFor} from '@/lib/permissions';
import type {Prisma} from '@prisma/client';

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
const fail=(error:string,status:number)=>NextResponse.json({error},{status});
export async function GET(_request:Request,{params}:Ctx){
 try{
  const a=await actor(params);
  if(!a)return fail('Community membership required',403);
  const ranks=await prisma.staffRank.findMany({where:{communityId:a.id},orderBy:[{priority:'desc'},{name:'asc'}],include:{_count:{select:{members:true}}}});
  const members=await prisma.membership.findMany({where:{communityId:a.id},include:{user:{select:{name:true,discordId:true}}},orderBy:{user:{name:'asc'}}});
  const permissions=await permissionsFor(a.membership,a.id);
  return NextResponse.json({
    myRole:a.membership.role,permissions,editable:a.membership.role==='OWNER',
    keys:ALL_PERMISSIONS,
    ranks:ranks.map(r=>({id:r.id,name:r.name,color:r.color,priority:r.priority,permissions:allowedKeys(r.permissions),memberCount:r._count.members})),
    members:members.map(m=>({id:m.id,name:m.user.name,discordId:m.user.discordId,role:m.role,rankId:m.rankId}))
  });
 }catch{return fail('Unable to load ranks',503);}
}
export async function POST(req:Request,{params}:Ctx){
 try{
  const a=await actor(params);if(!a||a.membership.role!=='OWNER')return fail('Only the community owner can create custom ranks',403);
  const body=await req.json() as Record<string,unknown>;
  if(!body||typeof body.name!=='string'||body.name.trim().length<2||body.name.length>45||typeof body.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(body.color)||!Number.isInteger(body.priority)||typeof body.priority!=='number'||body.priority<0||body.priority>999||!Array.isArray(body.permissions)||body.permissions.some(x=>typeof x!=='string'||!ALL_PERMISSIONS.includes(x as never)))return fail('Invalid rank settings',400);
  const count=await prisma.staffRank.count({where:{communityId:a.id}});if(count>=30)return fail('Maximum of 30 ranks per community',409);
  const permissions=allowedKeys(body.permissions).filter(x=>x!=='ranks.manage');
  await prisma.staffRank.create({data:{communityId:a.id,name:body.name.trim(),color:body.color,priority:body.priority,permissions:permissions as Prisma.InputJsonValue}});
  return NextResponse.json({success:true},{status:201});
 }catch{return fail('Could not create rank (check for duplicate name)',503);}
}
export async function PATCH(req:Request,{params}:Ctx){
 try{
  const a=await actor(params);if(!a||a.membership.role!=='OWNER')return fail('Only the owner can edit ranks',403);
  const b=await req.json() as Record<string,unknown>;
  if(!b||typeof b.rankId!=='string'||typeof b.name!=='string'||b.name.trim().length<2||b.name.length>45||typeof b.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(b.color)||typeof b.priority!=='number'||!Number.isInteger(b.priority)||b.priority<0||b.priority>999||!Array.isArray(b.permissions)||b.permissions.some(x=>typeof x!=='string'||!ALL_PERMISSIONS.includes(x as never)))return fail('Invalid rank settings',400);
  const rank=await prisma.staffRank.findFirst({where:{id:b.rankId,communityId:a.id}});if(!rank)return fail('Rank not found',404);
  await prisma.staffRank.update({where:{id:rank.id},data:{name:b.name.trim(),color:b.color,priority:b.priority,permissions:allowedKeys(b.permissions).filter(x=>x!=='ranks.manage') as Prisma.InputJsonValue}});
  return NextResponse.json({success:true});
 }catch{return fail('Unable to update rank',503);}
}
export async function DELETE(req:Request,{params}:Ctx){
 try{
  const a=await actor(params);if(!a||a.membership.role!=='OWNER')return fail('Only the owner can delete ranks',403);
  const body=await req.json() as {rankId?:unknown};if(typeof body?.rankId!=='string')return fail('Invalid rank',400);
  const rank=await prisma.staffRank.findFirst({where:{id:body.rankId,communityId:a.id}});if(!rank)return fail('Rank not found',404);
  await prisma.staffRank.delete({where:{id:rank.id}});
  return NextResponse.json({success:true});
 }catch{return fail('Unable to remove rank',503);}
}
