'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {NexifySidebar} from '@/components/nexify-sidebar';
import {Clock3,Play,Square,Activity,Trophy,Target,RefreshCw} from 'lucide-react';
type ActivityEntry={id:string;category:string;note:string;createdAt:string};
type Shift={id:string;memberName:string;mine:boolean;startedAt:string;endedAt:string|null;activities:ActivityEntry[]};
type Stat={membershipId:string;name:string;avatar:string|null;role:string;minutes:number;active:boolean;activityCount:number};
type Data={communityName:string;quotaMinutes:number;weekStarts:string;myRole:string;myActiveShiftId:string|null;mySuspended:boolean;leaderboard:Stat[];history:Shift[]};
const fmt=(mins:number)=>mins>=60?Math.floor(mins/60)+'h '+(mins%60)+'m':mins+'m';
const dt=(s:string)=>new Date(s).toLocaleString();
async function parse(res:Response){const json=await res.json();if(!res.ok)throw Error(json.error||'Request failed');return json;}
export default function ShiftsPage(){
 const {id}=useParams<{id:string}>();
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[category,setCategory]=useState('Patrol'),[note,setNote]=useState(''),[hours,setHours]=useState(2),[now,setNow]=useState(Date.now());
 const api='/api/communities/'+id+'/shifts';
 async function load(){const result=await fetch(api,{cache:'no-store'}).then(parse);setData(result);setHours(Math.floor(result.quotaMinutes/60));}
 useEffect(()=>{if(!id)return;load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[id]);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return ()=>clearInterval(t);},[]);
 async function act(payload:object,successMessage:string,method:'POST'|'PATCH'='POST'){
  setBusy(true);setError('');setNotice('');
  try{
   await fetch(api,{method,headers:{'content-type':'application/json'},body:JSON.stringify(payload)}).then(parse);
   await load();setNotice(successMessage);
   if('action'in payload&&payload.action==='activity')setNote('');
  }catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}
 }
 const manager=data?.myRole==='OWNER'||data?.myRole==='ADMIN';
 const me=data?.leaderboard.find(s=>s.role&&data.history.some(h=>h.mine&&h.memberName===s.name));
 const active=data?.history.find(s=>s.id===data.myActiveShiftId);
 const elapsed=active?Math.floor(Math.max(0,now-new Date(active.startedAt).getTime())/60000):0;
 const quota=data?.quotaMinutes||0;
 return <div className="app"><NexifySidebar communityId={id}/><main className="cm-page cm-content"><div className="cm-container">
  <Link className="cm-back" href={'/dashboard/communities/'+id}>← Back to community</Link>
  <header className="cm-hero"><div className="cm-logo"><Clock3 size={38}/></div><div><span className="muted">NEXIFY / SHIFT OPERATIONS</span><h1>Shift Management</h1><p>Clock in, track activity, view staff quotas and leaderboards</p></div></header>
  {loading?<section className="panel">Loading shift data…</section>:!data?<section className="panel"><h2>Shifts unavailable</h2><p>{error||'A staff role is required to access shifts.'}</p></section>:<>
   <div className="shift-summary">
    <div className="stat"><span className="muted">YOUR STATUS</span><div className="shift-big">{data.myActiveShiftId?'Clocked In':'Off Duty'}</div><div className="hint">{data.mySuspended?'Staff access suspended':data.myActiveShiftId?'Current shift '+fmt(elapsed):'Ready for your next shift'}</div></div>
    <div className="stat"><span className="muted">WEEKLY QUOTA</span><div className="shift-big">{fmt(quota)}</div><div className="hint">Week starting {new Date(data.weekStarts).toLocaleDateString()}</div></div>
    <div className="stat"><span className="muted">STAFF ON DUTY</span><div className="shift-big">{data.leaderboard.filter(s=>s.active).length}</div><div className="hint">Across this community</div></div>
    <div className="stat"><span className="muted">ACTIVITY LOGS</span><div className="shift-big">{data.leaderboard.reduce((v,s)=>v+s.activityCount,0)}</div><div className="hint">Logged this week</div></div>
   </div>
   <div className="shift-grid">
    <section className="panel cm-panel"><h2><Play size={18}/> Your shift</h2><p>Track your time while on duty. Times are recorded automatically.</p>
     <div className="shift-actionbox"><span className={data.myActiveShiftId?'shift-light on':'shift-light'}/><strong>{data.myActiveShiftId?'You are on duty':'You are off duty'}</strong>{active&&<small>Started {dt(active.startedAt)} · {fmt(elapsed)}</small>}</div>
     <button className={'cm-button shift-start'+(data.myActiveShiftId?' shift-stop':'')} disabled={busy||data.mySuspended} onClick={()=>act({action:data.myActiveShiftId?'clockOut':'clockIn'},data.myActiveShiftId?'Shift ended and saved.':'You are clocked in.')}>{data.myActiveShiftId?<><Square size={15}/> Clock Out</>:<><Play size={15}/> Clock In</>}</button>
     <h3><Activity size={17}/> Record activity</h3><p>Log what you did during your current shift. Activity notes are manual, not automatically pulled from ER:LC.</p>
     <label htmlFor="activity-type">Category</label><select id="activity-type" value={category} onChange={e=>setCategory(e.target.value)} disabled={!data.myActiveShiftId||busy}>{['Patrol','Training','Moderation','Support','Other'].map(c=><option key={c}>{c}</option>)}</select>
     <label htmlFor="activity-note">Activity note</label><textarea id="activity-note" rows={3} value={note} maxLength={300} onChange={e=>setNote(e.target.value)} placeholder="What did you work on?" disabled={!data.myActiveShiftId||busy}/>
     <button className="cm-button" disabled={busy||!data.myActiveShiftId||note.trim().length<3||data.mySuspended} onClick={()=>act({action:'activity',category,note},'Activity recorded.')}>Add activity</button>
    </section>
    <section className="panel cm-panel"><h2><Trophy size={18}/> Weekly leaderboard</h2><p>Ranked by time on duty since Monday (UTC). Active shifts count toward totals.</p>
     <div className="shift-leaders">{data.leaderboard.map((s,i)=><div className="shift-leader" key={s.membershipId}><span className="shift-rank">#{i+1}</span><div className="shift-person"><strong>{s.name}</strong><small>{s.role}{s.active?' · On Duty':''}</small></div><div className="shift-total"><strong>{fmt(s.minutes)}</strong><small>{quota>0?Math.min(100,Math.floor(s.minutes/quota*100))+'% quota':'No quota'}</small></div><div className="shift-progress"><div style={{width:quota>0?Math.min(100,s.minutes/quota*100)+'%':'0%'}}/></div></div>)}</div>
     {data.leaderboard.length===0&&<p>No staff shift records yet.</p>}
     {manager&&<div className="shift-quota"><h3><Target size={17}/> Community weekly quota</h3><p>Set the same weekly target for all staff. Enter hours from 0 to 168.</p><div className="shift-quota-controls"><input aria-label="Weekly quota hours" type="number" min={0} max={168} step={1} value={hours} onChange={e=>setHours(Number(e.target.value))}/><button className="cm-button" disabled={busy||!Number.isInteger(hours)||hours<0||hours>168} onClick={()=>act({quotaMinutes:hours*60},'Weekly quota saved.','PATCH')}>Save quota</button></div></div>}
    </section>
   </div>
   <section className="panel shift-history"><div className="panelhead"><div><h2>Shift logs</h2><p>{manager?'Community shifts':'Your shifts'} for the current week, including activity entries.</p></div><button className="staff-mutedbtn" onClick={()=>{setError('');load().catch(e=>setError(e.message));}}><RefreshCw size={14}/> Refresh</button></div>
    <div className="shift-logs">{data.history.map(s=><article className="shift-log" key={s.id}><div className="shift-log-head"><strong>{s.memberName}</strong><span className={s.endedAt?'pill':'shift-state-active'}>{s.endedAt?'Completed':'Active'}</span></div><p>{dt(s.startedAt)} — {s.endedAt?dt(s.endedAt):'In progress'}</p><small>Duration: {fmt(Math.floor(Math.max(0,(s.endedAt?new Date(s.endedAt).getTime():now)-new Date(s.startedAt).getTime())/60000))}</small>{s.activities.length>0&&<div className="shift-activities">{s.activities.map(a=><div key={a.id}><b>{a.category}</b> · {a.note}<small>{dt(a.createdAt)}</small></div>)}</div>}</article>)}</div>
    {data.history.length===0&&<p>No shifts have been recorded this week.</p>}
   </section>
  </>}
  {notice&&<div className="cm-alert" role="status">{notice}</div>}
  {error&&data&&<div className="cm-alert error" role="alert">{error}</div>}
 </div></main></div>;
}
