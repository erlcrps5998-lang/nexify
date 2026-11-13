'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {NexifySidebar} from '@/components/nexify-sidebar';
import {Terminal,RadioTower,Send,RefreshCw,ShieldCheck} from 'lucide-react';

type Action='ANNOUNCE'|'MESSAGE'|'PM'|'KICK'|'BAN'|'UNBAN';
type CommandLog={id:string;actorName:string;actorRole:string;action:string;target:string|null;status:string;response:string|null;createdAt:string};
type Data={connected:boolean;serverName:string|null;role:string;permissions:Action[];logs:CommandLog[]};
const types:Record<Action,{name:string;detail:string;needsTarget:boolean;needsMessage:boolean;confirm:boolean}>={
 ANNOUNCE:{name:'Server announcement',detail:'Display a short hint to everyone in the server',needsTarget:false,needsMessage:true,confirm:false},
 MESSAGE:{name:'Server message',detail:'Broadcast a message to all online players',needsTarget:false,needsMessage:true,confirm:false},
 PM:{name:'Private message',detail:'Send a private message to one player',needsTarget:true,needsMessage:true,confirm:false},
 KICK:{name:'Kick player',detail:'Remove a player from the active server',needsTarget:true,needsMessage:false,confirm:true},
 BAN:{name:'Ban player',detail:'Restrict a player from rejoining the server',needsTarget:true,needsMessage:false,confirm:true},
 UNBAN:{name:'Unban player',detail:'Remove a player ban using the player username',needsTarget:true,needsMessage:false,confirm:true}
};
const allActions=Object.keys(types) as Action[];
async function parse(r:Response){const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');return data;}
export default function ErlcControls(){
 const {id}=useParams<{id:string}>();
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [action,setAction]=useState<Action>('ANNOUNCE'),[target,setTarget]=useState(''),[message,setMessage]=useState('');
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('ALL');
 const api='/api/communities/'+id+'/erlc/controls';
 async function refresh(){const result=await fetch(api,{cache:'no-store'}).then(parse) as Data;setData(result);setAction(a=>result.permissions.includes(a)?a:result.permissions[0]||'ANNOUNCE');}
 useEffect(()=>{if(!id)return;refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[id]);
 async function run(){
  if(types[action].confirm&&!window.confirm('Send '+types[action].name.toLowerCase()+' for '+target+' to your live ER:LC server?'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,target,message})}).then(parse);
   setNotice(result.message||'Command accepted by ER:LC API.');setMessage('');setTarget('');
  }catch(e){setError(e instanceof Error?e.message:'Command failed.');}finally{try{await refresh();}catch{}setBusy(false);}
 }
 const config=types[action];
 const allowed=Boolean(data?.connected)&&Boolean(data?.permissions.includes(action))&&!busy
  &&(!config.needsTarget||/^[a-zA-Z0-9_]{3,20}$/.test(target))
  &&(!config.needsMessage||(message.trim().length>=3&&message.trim().length<=180&&!/[\r\n]/.test(message)));
 const logs=(data?.logs||[]).filter(l=>(filter==='ALL'||l.status===filter)&&[l.actorName,l.action,l.target||'',l.response||''].some(t=>t.toLowerCase().includes(search.toLowerCase())));
 return <div className="app"><NexifySidebar communityId={id}/><main className="cm-page cm-content"><div className="cm-container">
  <Link className="cm-back" href={'/dashboard/communities/'+id+'/erlc'}>← Back to ER:LC server</Link>
  <header className="cm-hero"><div className="cm-logo"><Terminal size={38}/></div><div><span className="muted">NEXIFY / ER:LC SERVER OPERATIONS</span><h1>Server Controls</h1><p>Authorized in-game commands and community command history</p></div></header>
  {loading?<div className="panel">Loading command permissions…</div>:!data?<div className="panel"><h2>Controls unavailable</h2><p>{error||'You need an active staff account.'}</p></div>:<>
   <div className="erlc-topline"><div><span className="muted">CONNECTED SERVER</span><h2>{data.serverName||'No ER:LC connection'}</h2><small>Your Nexify rank: {data.role} · Available commands: {data.permissions.length}</small></div><Link className="staff-mutedbtn" href={'/dashboard/communities/'+id+'/erlc'}><RadioTower size={15}/> Server information</Link></div>
   {!data.connected&&<div className="cm-alert error">Connect your private server in ER:LC Servers before sending commands.</div>}
   <div className="ctrl-grid">
    <section className="panel cm-panel"><h2><Send size={18}/> Send a command</h2><p>Commands run in your connected ER:LC server. Actions are permission-checked, rate-limited, and logged.</p>
     <label htmlFor="ctrl-action">Command</label><select id="ctrl-action" value={action} disabled={busy} onChange={e=>setAction(e.target.value as Action)}>{allActions.filter(a=>data.permissions.includes(a)).map(a=><option key={a} value={a}>{types[a].name}</option>)}</select>
     <p className="ctrl-detail">{config.detail}</p>
     {config.needsTarget&&<><label htmlFor="ctrl-player">Player username</label><input id="ctrl-player" disabled={busy} value={target} onChange={e=>setTarget(e.target.value)} maxLength={20} placeholder="Exact Roblox username"/><small>Use an exact username, not a group or display name.</small></>}
     {config.needsMessage&&<><label htmlFor="ctrl-message">Message</label><textarea id="ctrl-message" disabled={busy} value={message} maxLength={180} rows={4} onChange={e=>setMessage(e.target.value)} placeholder="Write a clear message…"/></>}
     <button className="cm-button ctrl-submit" disabled={!allowed} onClick={run}><Send size={16}/> {busy?'Sending…':'Send to ER:LC'}</button>
     <div className="ctrl-policy"><ShieldCheck size={17}/><span>For your community's authorized staff. Commands are sent to the official ER:LC API and may affect live players. A 15-second cooldown applies between commands.</span></div>
    </section>
    <section className="panel cm-panel"><div className="panelhead"><div><h2>Command logs</h2><p>Latest 100 commands submitted through Nexify, including results.</p></div><button className="staff-mutedbtn" disabled={busy} onClick={()=>refresh().catch(e=>setError(e.message))}><RefreshCw size={15}/> Refresh</button></div>
     <div className="ctrl-filters"><input aria-label="Search command history" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search staff, action, player…"/><select aria-label="Command result" value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">All results</option><option value="SUCCESS">Accepted</option><option value="FAILED">Failed</option><option value="PENDING">Pending</option></select></div>
     <div className="ctrl-logs">{logs.map(l=><article key={l.id} className="ctrl-log"><div className="ctrl-log-top"><strong>{types[l.action as Action]?.name||l.action}</strong><span className={'ctrl-status '+l.status.toLowerCase()}>{l.status==='SUCCESS'?'Accepted':l.status==='FAILED'?'Failed':'Pending'}</span></div><p>{l.target?'Target: '+l.target:'Server-wide'} · By {l.actorName} ({l.actorRole})</p><small>{new Date(l.createdAt).toLocaleString()}</small>{l.response&&<div className="ctrl-response">{l.response}</div>}</article>)}</div>
     {!logs.length&&<p>{data.logs.length?'No matching records.':'No commands have been sent from Nexify yet.'}</p>}
    </section>
   </div>
  </>}
  {notice&&<div className="cm-alert" role="status">{notice}</div>}
  {error&&data&&<div className="cm-alert error" role="alert">{error}</div>}
 </div></main></div>;
}
