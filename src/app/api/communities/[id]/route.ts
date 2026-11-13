import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
type Ctx={params:Promise<{id:string}>};
async function auth(id:string){
 const session=await getServerSession(authOptions);
 const discordId=(session?.user as {discordId?:string}|undefined)?.discordId;
 if(!discordId)return null;
 const user=await prisma.user.findUnique({where:{discordId}});
 if(!user)return null;
 const member=await prisma.membership.findUnique({where:{userId_communityId:{userId:user.id,communityId:id}}});
 return member;
}
export async function GET(_req:Request,{params}:Ctx){
 try{
  const {id}=await params;const member=await auth(id);
  if(!member)return NextResponse.json({error:'Community unavailable or access denied'},{status:403});
  const c=await prisma.community.findUnique({where:{id},select:{id:true,name:true,slug:true,description:true,logoUrl:true}});
  if(!c)return NextResponse.json({error:'Community not found'},{status:404});
  return NextResponse.json({...c,role:member.role});
 }catch{return NextResponse.json({error:'Unable to load community'},{status:503});}
}
export async function PATCH(req:Request,{params}:Ctx){
 try{
  const {id}=await params;const member=await auth(id);
  if(!member||!['OWNER','ADMIN'].includes(member.role))return NextResponse.json({error:'Only owners and admins can edit settings'},{status:403});
  const body=await req.json() as Record<string,unknown>;
  if(!body||typeof body.name!=='string'||body.name.trim().length<3||body.name.trim().length>60)return NextResponse.json({error:'Name must be 3–60 characters'},{status:400});
  if(typeof body.description!=='string'||body.description.length>1000)return NextResponse.json({error:'Description must be 1000 characters or fewer'},{status:400});
  if(typeof body.logoUrl!=='string'||body.logoUrl.length>500)return NextResponse.json({error:'Logo URL must be under 500 characters'},{status:400});
  const url=body.logoUrl.trim();
  if(url){try{if(new URL(url).protocol!=='https:')throw Error('invalid');}catch{return NextResponse.json({error:'Logo must be an HTTPS image URL'},{status:400});}}
  const c=await prisma.community.update({where:{id},data:{name:body.name.trim(),description:body.description.trim()||null,logoUrl:url||null},select:{id:true,name:true,slug:true,description:true,logoUrl:true}});
  return NextResponse.json({...c,role:member.role});
 }catch{return NextResponse.json({error:'Unable to save settings'},{status:503});}
}
