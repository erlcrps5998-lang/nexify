'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';
import {NexifySidebar} from '@/components/nexify-sidebar';
import {ShieldCheck,Search,RefreshCw,ClipboardList} from 'lucide-react';

type Action='WARNING'|'KICK'|'BAN'|'UNBAN';
type Log={id:string;action:Action;targetRobloxId:string;targetRobloxName:string|null;reason:string|null;actorName:string;createdAt:string};
type Data={role:string;permissions:Action[];suspended:boolean;logs:Log[]};
async function parse(res:Response){const d=await res.json();if(!res.ok)throw new Error(d.error||'Request failed');return d;}
const actions:Action[]=['WARNING','KICK','BAN','UNBAN'];
const names:Record<Action,string>={WARNING:'Warning',KICK:'Kick',BAN:'Ban',UNBAN:'Unban'};
const date=(s:string)=>new Date(s).toLocaleString();
export default function ModerationPage(){
 const {id}=useParams<{id:string}>();
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [action,setAction]=useState<Action>('WARNING'),[targetId,setTargetId]=useState(''),[targetName,setTargetName]=useState(''),[reason,setReason]=useState('');
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('ALL');
 const api='/api/communities/'+id+'/moderation';
 async function load(){const d:Data=await fetch(api,{cache:'no-store'}).then(parse);setData(d);setAction(a=>d.permissions.includes(a)?a:d.permissions[0]||'WARNING');}
 useEffect(()=>{if(!id)return;load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[id]);
 const filtered=useMemo(()=>data?.logs.filter(l=>(filter==='ALL'||l.action===filter)&&[l.targetRobloxId,l.targetRobloxName||'',l.reason||'',l.actorName].some(t=>t.toLowerCase().includes(query.toLowerCase())))||[],[data,filter,query]);
 async function save(){
  setBusy(true);setError('');setNotice('');
  try{
   await fetch(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,targetRobloxId:targetId,targetRobloxName:targetName,reason})}).then(parse);
   setTargetId('');setTargetName('');setReason('');
   await load();setNotice('Moderation record saved to audit history.');
  }catch(e){setError(e instanceof Error?e.message:'Could not save record');}finally{setBusy(false);}
 }
 return <div className="app"><NexifySidebar communityId={id}/><main className="cm-page cm-content"><div className="cm-container">
  <Link className="cm-back" href={'/dashboard/communities/'+id}>← Back to community</Link>
  <header className="cm-hero"><div className="cm-logo"><ShieldCheck size={38}/></div><div><span className="muted">NEXIFY / COMMUNITY SAFETY</span><h1>Moderation Center</h1><p>Warnings, kicks, bans, unbans and staff audit history</p></div></header>
  {loading?<section className="panel">Loading moderation records…</section>:!data?<section className="panel"><h2>Moderation unavailable</h2><p>{error||'You must have a staff role in this community.'}</p></section>:<>
   <div className="mod-stats">
    {(['WARNING','KICK','BAN','UNBAN'] as const).map(a=><div className="stat" key={a}><div className="muted">{names[a].toUpperCase()} RECORDS</div><div className="statnum">{data.logs.filter(l=>l.action===a).length}</div><div className="hint">Recent audit entries</div></div>)}
   </div>
   <div className="mod-grid">
    <section className="panel cm-panel"><h2><ShieldCheck size={18}/> Record an action</h2><p>Save a moderation record. <strong>This does not send commands to ER:LC.</strong> Server integration will be added separately.</p>
     <div className="mod-perms"><strong>Your role: {data.role}</strong><small>Allowed: {data.permissions.map(a=>names[a]).join(', ')||'None'}</small></div>
     {data.suspended&&<div className="mod-warning">Your staff access is suspended. You can read existing records but cannot create new ones.</div>}
     <label htmlFor="mod-action">Action type</label><select id="mod-action" value={action} onChange={e=>setAction(e.target.value as Action)} disabled={busy||data.suspended}>{actions.filter(a=>data.permissions.includes(a)).map(a=><option value={a} key={a}>{names[a]}</option>)}</select>
     <label htmlFor="mod-id">Target Roblox user ID</label><input id="mod-id" type="text" inputMode="numeric" value={targetId} onChange={e=>setTargetId(e.target.value.replace(/[^0-9]/g,'').slice(0,20))} placeholder="Numeric Roblox user ID" disabled={busy||data.suspended}/>
     <label htmlFor="mod-name">Roblox username (optional)</label><input id="mod-name" value={targetName} maxLength={50} onChange={e=>setTargetName(e.target.value)} placeholder="Player username" disabled={busy||data.suspended}/>
     <label htmlFor="mod-reason">Reason</label><textarea id="mod-reason" value={reason} rows={4} maxLength={500} onChange={e=>setReason(e.target.value)} placeholder="Explain why the action was recorded…" disabled={busy||data.suspended}/>
     <button className="cm-button mod-save" disabled={busy||data.suspended||!data.permissions.includes(action)||!/^\d{1,20}$/.test(targetId)||reason.trim().length<5} onClick={save}>{busy?'Saving…':'Save Moderation Record'}</button>
    </section>
    <section className="panel cm-panel"><div className="panelhead"><div><h2><ClipboardList size={18}/> Moderation logs</h2><p>Newest 250 records, scoped to this community.</p></div><button className="staff-mutedbtn" onClick={()=>{setError('');load().catch(e=>setError(e.message));}}><RefreshCw size={15}/> Refresh</button></div>
     <div className="mod-filters"><div className="mod-search"><Search size={16}/><input aria-label="Search moderation records" placeholder="Search player, ID, reason or staff…" value={query} onChange={e=>setQuery(e.target.value)}/></div><select aria-label="Filter by action" value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">All actions</option>{actions.map(a=><option value={a} key={a}>{names[a]}</option>)}</select></div>
     <div className="mod-logs">{filtered.map(log=><article className="mod-log" key={log.id}><div className="mod-log-top"><strong>{log.targetRobloxName||'Roblox user'}</strong><span className={'mod-tag mod-'+log.action.toLowerCase()}>{names[log.action]}</span></div><small>Roblox ID: {log.targetRobloxId}</small><p>{log.reason}</p><div className="mod-log-foot">By {log.actorName} · {date(log.createdAt)}</div></article>)}</div>
     {!filtered.length&&<p>{data.logs.length?'No records match your filters.':'No moderation records yet.'}</p>}
    </section>
   </div>
  </>}
  {notice&&<div className="cm-alert" role="status">{notice}</div>}
  {error&&data&&<div className="cm-alert error" role="alert">{error}</div>}
 </div></main></div>;
}
