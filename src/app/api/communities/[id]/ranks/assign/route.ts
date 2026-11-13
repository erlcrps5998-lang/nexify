import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
type Ctx={params:Promise<{id:string}>};
export async function PATCH(req:Request,{params}:Ctx){
 try{
  const session=await getServerSession(authOptions);
  const discordId=(session?.user as {discordId?:string}|undefined)?.discordId;
  if(!discordId)return NextResponse.json({error:'Sign in required'},{status:401});
  const user=await prisma.user.findUnique({where:{discordId}});
  const {id}=await params;
  if(!user)return NextResponse.json({error:'Access denied'},{status:403});
  const actor=await prisma.membership.findUnique({where:{userId_communityId:{userId:user.id,communityId:id}}});
  if(!actor||actor.role!=='OWNER')return NextResponse.json({error:'Only the owner can assign custom ranks'},{status:403});
  const body=await req.json() as {membershipId?:unknown;rankId?:unknown};
  if(typeof body.membershipId!=='string'||!(body.rankId===null||typeof body.rankId==='string'))return NextResponse.json({error:'Invalid assignment'},{status:400});
  const target=await prisma.membership.findFirst({where:{id:body.membershipId,communityId:id}});
  if(!target||target.role==='OWNER')return NextResponse.json({error:'Cannot change owner rank'},{status:403});
  if(body.rankId){
   const rank=await prisma.staffRank.findFirst({where:{id:body.rankId,communityId:id}});
   if(!rank)return NextResponse.json({error:'Rank not found in this community'},{status:404});
  }
  await prisma.membership.update({where:{id:target.id},data:{rankId:body.rankId as string|null}});
  return NextResponse.json({success:true});
 }catch{return NextResponse.json({error:'Could not assign rank'},{status:503});}
}
