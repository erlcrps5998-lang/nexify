import {prisma} from '@/lib/prisma';
import type {CommunityRole} from '@prisma/client';

export const PERMISSION_GROUPS={
 'Community':['community.edit','members.manage','staff.manage','ranks.manage'],
 'Staff & Leave':['loa.review','shifts.view','shifts.manage','shifts.quota'],
 'Moderation':['moderation.warn','moderation.kick','moderation.ban'],
 'Applications':['applications.manage','applications.review'],
 'ER:LC':['erlc.view','erlc.connect','erlc.announce','erlc.message','erlc.pm','erlc.kick','erlc.ban','erlc.unban']
} as const;
export type Permission=(typeof PERMISSION_GROUPS)[keyof typeof PERMISSION_GROUPS][number];
export const ALL_PERMISSIONS=Object.values(PERMISSION_GROUPS).flat() as Permission[];
const LEGACY:Record<CommunityRole,Permission[]>={
 OWNER:ALL_PERMISSIONS,
 ADMIN:ALL_PERMISSIONS.filter(x=>x!=='ranks.manage'),
 MODERATOR:['shifts.view','shifts.manage','moderation.warn','moderation.kick','erlc.view','erlc.announce','erlc.message','erlc.pm','erlc.kick'],
 STAFF:['shifts.view','shifts.manage','moderation.warn','erlc.view','erlc.announce','erlc.pm'],
 MEMBER:[]
};
type Member={role:CommunityRole;rankId?:string|null;suspendedUntil?:Date|null};
export function allowedKeys(raw:unknown):Permission[]{
 return Array.isArray(raw)?[...new Set(raw.filter((x):x is Permission=>typeof x==='string'&&ALL_PERMISSIONS.includes(x as Permission)))]:[];
}
export async function permissionsFor(member:Member,communityId:string):Promise<Permission[]>{
 if(member.role==='OWNER')return ALL_PERMISSIONS;
 if(member.suspendedUntil&&member.suspendedUntil>new Date())return [];
 if(member.rankId){
  const rank=await prisma.staffRank.findFirst({where:{id:member.rankId,communityId},select:{permissions:true}});
  if(rank)return allowedKeys(rank.permissions).filter(x=>x!=='ranks.manage');
 }
 return LEGACY[member.role]||[];
}
export async function can(member:Member,communityId:string,key:Permission):Promise<boolean>{
 return (await permissionsFor(member,communityId)).includes(key);
}
