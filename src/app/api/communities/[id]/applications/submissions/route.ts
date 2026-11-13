import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import type {Prisma} from '@prisma/client';
type Ctx={params:Promise<{id:string}>};
type Q={id:string;label:string;type:string;required:boolean;options:string[]};
async function auth(params:Ctx['params']){
 const session=await getServerSession(authOptions);
 const discordId=(session?.user as {discordId?:string}|undefined)?.discordId;
 const {id}=await params;
 if(!discordId)return {communityId:id,user:null,manager:false};
 const user=await prisma.user.upsert({where:{discordId},update:{name:session?.user?.name||'Discord user',avatar:session?.user?.image},create:{discordId,name:session?.user?.name||'Discord user',avatar:session?.user?.image}});
 const membership=await prisma.membership.findUnique({where:{userId_communityId:{communityId:id,userId:user.id}}});
 const manager=!!membership&&['OWNER','ADMIN'].includes(membership.role)&&(!membership.suspendedUntil||membership.suspendedUntil<=new Date());
 return {communityId:id,user,manager};
}
export async function GET(req:Request,{params}:Ctx){
 try{
  const a=await auth(params);
  if(!a.user)return NextResponse.json({error:'Discord login required'},{status:401});
  const formId=new URL(req.url).searchParams.get('formId');
  if(!formId)return NextResponse.json({error:'Select an application'},{status:400});
  const form=await prisma.applicationForm.findFirst({where:{id:formId,communityId:a.communityId},select:{id:true,title:true,isOpen:true}});
  if(!form)return NextResponse.json({error:'Form not found'},{status:404});
  const submissions=await prisma.applicationSubmission.findMany({where:{formId,...(a.manager?{}:{applicantId:a.user.id})},include:{applicant:{select:{name:true,discordId:true}}},orderBy:{submittedAt:'desc'},take:200});
  return NextResponse.json({manager:a.manager,submissions:submissions.map(s=>({id:s.id,name:s.applicant.name,discordId:a.manager?s.applicant.discordId:undefined,status:s.status,answers:s.answers,questionSnapshot:s.questionSnapshot,reviewerNote:s.reviewerNote,reviewerName:s.reviewerName,submittedAt:s.submittedAt.toISOString()}))});
 }catch{return NextResponse.json({error:'Unable to load submissions'},{status:503});}
}
export async function POST(req:Request,{params}:Ctx){
 try{
  const a=await auth(params);
  if(!a.user)return NextResponse.json({error:'Sign in with Discord to apply'},{status:401});
  const body=await req.json() as {formId?:unknown;answers?:unknown};
  if(!body||typeof body.formId!=='string'||!body.answers||typeof body.answers!=='object'||Array.isArray(body.answers))return NextResponse.json({error:'Invalid application answers'},{status:400});
  const form=await prisma.applicationForm.findFirst({where:{id:body.formId,communityId:a.communityId,isOpen:true}});
  if(!form)return NextResponse.json({error:'Application is closed or unavailable'},{status:404});
  const questions=form.questions as unknown as Q[];
  const answers=body.answers as Record<string,unknown>;
  if(Object.keys(answers).length>questions.length||Object.keys(answers).some(k=>!questions.some(q=>q.id===k)))return NextResponse.json({error:'Invalid question answers'},{status:400});
  for(const q of questions){
   const value=answers[q.id];
   if(q.type==='CHECKBOX'){
    if(value!==undefined&&(!Array.isArray(value)||value.length>q.options.length||value.some(x=>typeof x!=='string'||!q.options.includes(x))))return NextResponse.json({error:'Invalid checkbox selection'},{status:400});
    if(q.required&&(!Array.isArray(value)||value.length===0))return NextResponse.json({error:'Answer all required questions'},{status:400});
   }else{
    if(value!==undefined&&(typeof value!=='string'||value.length>2000||(q.type==='SELECT'&&!q.options.includes(value))))return NextResponse.json({error:'Invalid answer'},{status:400});
    if(q.required&&(typeof value!=='string'||!value.trim()))return NextResponse.json({error:'Answer all required questions'},{status:400});
   }
  }
  const existing=await prisma.applicationSubmission.findUnique({where:{formId_applicantId:{formId:form.id,applicantId:a.user.id}}});
  if(existing)return NextResponse.json({error:'You have already applied to this form'},{status:409});
  await prisma.applicationSubmission.create({data:{formId:form.id,applicantId:a.user.id,answers:answers as Prisma.InputJsonValue,questionSnapshot:questions as unknown as Prisma.InputJsonValue}});
  return NextResponse.json({success:true},{status:201});
 }catch{return NextResponse.json({error:'Could not submit application'},{status:503});}
}
export async function PATCH(req:Request,{params}:Ctx){
 try{
  const a=await auth(params);
  if(!a.manager||!a.user)return NextResponse.json({error:'Only active owners and admins can review applications'},{status:403});
  const body=await req.json() as {submissionId?:unknown;status?:unknown;reviewerNote?:unknown};
  if(!body||typeof body.submissionId!=='string'||typeof body.status!=='string'||!['UNDER_REVIEW','ACCEPTED','DENIED'].includes(body.status)||typeof body.reviewerNote!=='string'||body.reviewerNote.length>1000)return NextResponse.json({error:'Invalid review'},{status:400});
  const target=await prisma.applicationSubmission.findFirst({where:{id:body.submissionId,form:{communityId:a.communityId}}});
  if(!target)return NextResponse.json({error:'Submission not found'},{status:404});
  if(target.applicantId===a.user.id)return NextResponse.json({error:'You cannot review your own application'},{status:403});
  await prisma.applicationSubmission.update({where:{id:target.id},data:{status:body.status as 'UNDER_REVIEW'|'ACCEPTED'|'DENIED',reviewerNote:body.reviewerNote.trim()||null,reviewerName:a.user.name,reviewedAt:new Date()}});
  return NextResponse.json({success:true});
 }catch{return NextResponse.json({error:'Unable to review application'},{status:503});}
}
