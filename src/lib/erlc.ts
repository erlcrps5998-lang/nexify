import 'server-only';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

function secret(){
 const raw=process.env.ERLC_ENCRYPTION_KEY||process.env.NEXTAUTH_SECRET;
 if(!raw||raw.length<20)throw new Error('Server encryption is not configured');
 return createHash('sha256').update('nexify-erlc-v1:').update(raw).digest();
}
export function encryptServerKey(key:string):string{
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',secret(),iv);
 const encrypted=Buffer.concat([cipher.update(key,'utf8'),cipher.final()]);
 return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function decryptServerKey(value:string):string{
 const parts=value.split('.');
 if(parts.length!==3)throw new Error('Invalid encrypted key');
 const decipher=createDecipheriv('aes-256-gcm',secret(),Buffer.from(parts[0],'base64url'));
 decipher.setAuthTag(Buffer.from(parts[1],'base64url'));
 return Buffer.concat([decipher.update(Buffer.from(parts[2],'base64url')),decipher.final()]).toString('utf8');
}
type JsonObject=Record<string,unknown>;
const asObject=(v:unknown):JsonObject=>(v&&typeof v==='object'&&!Array.isArray(v))?v as JsonObject:{};
const pick=(o:JsonObject,...keys:string[]):unknown=>{for(const k of keys)if(o[k]!==undefined&&o[k]!==null)return o[k];return undefined;};
const str=(v:unknown):string=>typeof v==='string'?v:typeof v==='number'?String(v):'';
const num=(v:unknown):number|null=>{
 if(typeof v==='number'&&Number.isFinite(v))return v;
 if(typeof v==='string'&&/^\d+$/.test(v))return Number(v);
 return null;
};
export class ErlcApiError extends Error{
 constructor(public status:number,message:string){super(message);}
}
const endpoint='https://api.erlc.gg/v2/server?Players=true&Queue=true&Staff=true';
export async function fetchErlcServer(key:string){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),9000);
 let res:Response;
 try{
  res=await fetch(endpoint,{headers:{'Server-Key':key,Accept:'application/json'},cache:'no-store',signal:controller.signal});
 }catch{
  throw new ErlcApiError(503,'ER:LC API could not be reached. Please try again.');
 }finally{clearTimeout(timeout);}
 if(!res.ok){
  if(res.status===401||res.status===403)return Promise.reject(new ErlcApiError(400,'ER:LC rejected this server key. Verify it in your private server settings.'));
  if(res.status===429)return Promise.reject(new ErlcApiError(429,'ER:LC API rate limit reached. Try refreshing later.'));
  throw new ErlcApiError(502,'ER:LC API returned status '+res.status+'.');
 }
 let raw:unknown;
 try{raw=await res.json();}catch{throw new ErlcApiError(502,'ER:LC returned invalid server data.');}
 const root=asObject(raw);
 const info={...root,...asObject(pick(root,'Server','server','Info','info'))};
 const records=pick(root,'Players','players');
 const playerData=Array.isArray(records)?records:Array.isArray(asObject(records).Players)?asObject(records).Players:[];
 const players=(playerData as unknown[]).slice(0,200).map(v=>{
  const p=asObject(v);
  const combined=str(pick(p,'Player','player'));
  const match=combined.match(/^(.*?):(\d+)$/);
  return {
   username:str(pick(p,'Username','username','Name','name'))||match?.[1]||combined||'Unknown player',
   userId:str(pick(p,'UserId','userId','Id','id'))||match?.[2]||'',
   team:str(pick(p,'Team','team'))||'Unknown',
   permission:str(pick(p,'Permission','permission'))||'Normal',
   callsign:str(pick(p,'Callsign','CallSign','callsign'))
  };
 });
 const q=pick(root,'Queue','queue');
 const queue=Array.isArray(q)?q.length:num(q)??(Array.isArray(asObject(q).Players)?(asObject(q).Players as unknown[]).length:0);
 const staff=pick(root,'Staff','staff');
 const staffObject=asObject(staff);
 const staffCount=Array.isArray(staff)?staff.length:Object.values(staffObject).reduce((sum,v)=>sum+(Array.isArray(v)?v.length:0),0);
 const name=str(pick(info,'Name','name','ServerName','serverName'))||'ER:LC Private Server';
 return {name,owner:str(pick(info,'Owner','OwnerId','owner','ownerId')),
  playerCount:num(pick(info,'CurrentPlayers','PlayerCount','currentPlayers'))??players.length,
  maxPlayers:num(pick(info,'MaxPlayers','maxPlayers','MaxPlayerCount')),
  joinCode:str(pick(info,'JoinKey','joinKey','JoinCode','joinCode')),
  queueCount:queue,staffCount,players,checkedAt:new Date().toISOString()};
}
