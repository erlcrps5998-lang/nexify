import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import type {Prisma} from '@prisma/client';

type Ctx={params:Promise<{id:string}>};
type Question={id:string;label:string;type:'SHORT'|'LONG'|'SELECT'|'CHECKBOX';required:boolean;options:string[]};
const kinds=['SHORT','LONG','SELECT','CHECKBOX'];
export async function appActor(params:Ctx['params']){
 const session=await getServerSession(authOptions);
 const discordId=(session?.user as {discordId?:string}|undefined)?.discordId;
 const {id}=await params;
 const community=await prisma.community.findUnique({where:{id},select:{id:true,name:true}});
 if(!community)return {community:null,user:null,member:null,manager:false};
 const user=discordId?await prisma.user.findUnique({where:{discordId}}):null;
 const member=user?await prisma.membership.findUnique({where:{userId_communityId:{userId:user.id,communityId:id}}}):null;
 const manager=!!member&&['OWNER','ADMIN'].includes(member.role)&&(!member.suspendedUntil||member.suspendedUntil<=new Date());
 return {community,user,member,manager};
}
function validQuestions(value:unknown):value is Question[]{
 if(!Array.isArray(value)||value.length>25||value.length<1)return false;
 const ids=new Set<string>();
 return value.every(q=>{
  if(!q||typeof q!=='object'||typeof q.id!=='string'||!/^q_[a-zA-Z0-9_-]{3,60}$/.test(q.id)||ids.has(q.id))return false;
  ids.add(q.id);
  return typeof q.label==='string'&&q.label.trim().length>=3&&q.label.length<=180&&kinds.includes(q.type)&&typeof q.required==='boolean'&&Array.isArray(q.options)&&q.options.length<=12&&q.options.every((x:unknown)=>typeof x==='string'&&x.trim().length>0&&x.length<=100)&&(!['SELECT','CHECKBOX'].includes(q.type)||q.options.length>=2);
 });
}
export async function GET(_req:Request,{params}:Ctx){
 try{
  const a=await appActor(params);
  if(!a.community)return NextResponse.json({error:'Community not found'},{status:404});
  const forms=await prisma.applicationForm.findMany({where:{communityId:a.community.id,...(a.manager?{}:{isOpen:true})},orderBy:{createdAt:'desc'},select:{id:true,title:true,description:true,isOpen:true,questions:true,createdAt:true,_count:{select:{submissions:true}}}});
  return NextResponse.json({communityName:a.community.name,manager:a.manager,authenticated:!!a.user,forms:forms.map(f=>({...f,count:a.manager?f._count.submissions:undefined,_count:undefined}))});
 }catch{return NextResponse.json({error:'Unable to load applications'},{status:503});}
}
export async function POST(req:Request,{params}:Ctx){
 try{
  const a=await appActor(params);
  if(!a.manager||!a.community)return NextResponse.json({error:'Only active owners and admins can create application forms'},{status:403});
  const b=await req.json() as Record<string,unknown>;
  if(!b||typeof b.title!=='string'||b.title.trim().length<3||b.title.length>90||typeof b.description!=='string'||b.description.length>1200||typeof b.isOpen!=='boolean'||!validQuestions(b.questions))return NextResponse.json({error:'Check title (3–90 characters), description and questions (1–25)'},{status:400});
  const result=await prisma.applicationForm.create({data:{communityId:a.community.id,title:b.title.trim(),description:b.description.trim()||null,isOpen:b.isOpen,questions:b.questions as unknown as Prisma.InputJsonValue}});
  return NextResponse.json({id:result.id},{status:201});
 }catch{return NextResponse.json({error:'Unable to create application'},{status:503});}
}
export async function PATCH(req:Request,{params}:Ctx){
 try{
  const a=await appActor(params);
  if(!a.manager||!a.community)return NextResponse.json({error:'Permission denied'},{status:403});
  const b=await req.json() as Record<string,unknown>;
  if(!b||typeof b.formId!=='string'||typeof b.title!=='string'||b.title.trim().length<3||b.title.length>90||typeof b.description!=='string'||b.description.length>1200||typeof b.isOpen!=='boolean'||!validQuestions(b.questions))return NextResponse.json({error:'Invalid form settings'},{status:400});
  const form=await prisma.applicationForm.findFirst({where:{id:b.formId,communityId:a.community.id}});
  if(!form)return NextResponse.json({error:'Application not found'},{status:404});
  await prisma.applicationForm.update({where:{id:form.id},data:{title:b.title.trim(),description:b.description.trim()||null,isOpen:b.isOpen,questions:b.questions as unknown as Prisma.InputJsonValue}});
  return NextResponse.json({success:true});
 }catch{return NextResponse.json({error:'Unable to update application'},{status:503});}
}
export {validQuestions};
