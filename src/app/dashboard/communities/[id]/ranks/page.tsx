'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {NexifySidebar} from '@/components/nexify-sidebar';
import {Shield,Plus,Trash2,Save} from 'lucide-react';
type Rank={id:string;name:string;color:string;priority:number;permissions:string[];memberCount:number};
type Member={id:string;name:string;discordId:string;role:string;rankId:string|null};
type Data={myRole:string;editable:boolean;permissions:string[];keys:string[];ranks:Rank[];members:Member[]};
const groups:Record<string,string[]>={
 'Community':['community.edit','members.manage','staff.manage','ranks.manage'],
 'Staff & Leave':['loa.review','shifts.view','shifts.manage','shifts.quota'],
 'Moderation':['moderation.warn','moderation.kick','moderation.ban'],
 'Applications':['applications.manage','applications.review'],
 'ER:LC':['erlc.view','erlc.connect','erlc.announce','erlc.message','erlc.pm','erlc.kick','erlc.ban','erlc.unban']
};
const labels:Record<string,string>={
 'community.edit':'Edit community settings','members.manage':'Manage members and base roles','staff.manage':'Manage staff profiles and suspensions','ranks.manage':'Manage custom ranks (owner only)',
 'loa.review':'Review staff LOAs','shifts.view':'View shifts and leaderboard','shifts.manage':'Clock in and log shift activity','shifts.quota':'Set weekly shift quotas',
 'moderation.warn':'Record warnings','moderation.kick':'Record kicks','moderation.ban':'Record bans and unbans',
 'applications.manage':'Create and edit application forms','applications.review':'Review application submissions',
 'erlc.view':'View live server and player list','erlc.connect':'Connect or disconnect ER:LC server','erlc.announce':'Send announcements','erlc.message':'Send server messages',
 'erlc.pm':'Private message players','erlc.kick':'Kick players','erlc.ban':'Ban players','erlc.unban':'Unban players'
};
const blank=()=>({name:'',color:'#6489ff',priority:10,permissions:[] as string[]});
async function parse(r:Response){const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v;}
export default function RanksPage(){
 const {id}=useParams<{id:string}>();
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState<string|null>(null),[form,setForm]=useState(blank());
 const api='/api/communities/'+id+'/ranks';
 async function load(){const d=await fetch(api,{cache:'no-store'}).then(parse) as Data;setData(d);}
 useEffect(()=>{if(!id)return;load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[id]);
 function edit(rank:Rank){setSelected(rank.id);setForm({name:rank.name,color:rank.color,priority:rank.priority,permissions:rank.permissions});}
 async function save(){
  setBusy(true);setError('');setNotice('');
  try{await fetch(api,{method:selected?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,...(selected?{rankId:selected}:{})})}).then(parse);await load();setNotice('Custom rank saved.');setSelected(null);setForm(blank());}
  catch(e){setError(e instanceof Error?e.message:'Could not save rank');}finally{setBusy(false);}
 }
 async function remove(rank:Rank){
  if(!window.confirm('Delete '+rank.name+'? Assigned staff will return to their base-role permissions.'))return;
  setBusy(true);setError('');setNotice('');
  try{await fetch(api,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({rankId:rank.id})}).then(parse);await load();setSelected(null);setForm(blank());setNotice('Rank deleted.');}catch(e){setError(e instanceof Error?e.message:'Cannot delete rank');}finally{setBusy(false);}
 }
 async function assign(m:Member,value:string){
  setBusy(true);setError('');setNotice('');
  try{await fetch(api+'/assign',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({membershipId:m.id,rankId:value||null})}).then(parse);await load();setNotice('Staff rank assigned.');}catch(e){setError(e instanceof Error?e.message:'Unable to assign rank');}finally{setBusy(false);}
 }
 return <div className="app"><NexifySidebar communityId={id}/><main className="cm-page cm-content"><div className="cm-container">
  <Link href={'/dashboard/communities/'+id} className="cm-back">← Back to community</Link>
  <header className="cm-hero"><div className="cm-logo"><Shield size={38}/></div><div><span className="muted">NEXIFY / ACCESS MANAGEMENT</span><h1>Advanced Permissions</h1><p>Build custom staff ranks, assign members, and control feature access</p></div></header>
  {loading?<section className="panel">Loading ranks…</section>:!data?<section className="panel"><h2>Access unavailable</h2><p>{error}</p></section>:<>
   <div className="rank-notice"><Shield size={17}/><p>Community owners always retain full access. Custom ranks replace the assigned member's default permissions; removing an assignment restores their base-role permissions. Only the owner can create, edit, delete or assign ranks.</p></div>
   <div className="rank-grid">
    <section className="panel cm-panel"><h2>Custom ranks</h2><p>Choose an existing rank to edit its permissions and style.</p>
     <div className="rank-list">{data.ranks.map(r=><div key={r.id} className={'rank-row'+(selected===r.id?' chosen':'')}><span className="rank-dot" style={{background:r.color}}/><div><strong>{r.name}</strong><small>{r.memberCount} members · Priority {r.priority} · {r.permissions.length} permissions</small></div>{data.editable&&<button className="staff-mutedbtn" onClick={()=>edit(r)}>Edit</button>}</div>)}</div>
     {!data.ranks.length&&<p>No custom ranks created yet.</p>}
     {data.editable&&<button className="staff-mutedbtn" onClick={()=>{setSelected(null);setForm(blank());}}><Plus size={15}/> New rank</button>}
     <h2 className="rank-assign-title">Assign staff ranks</h2><p>Assign one custom permission rank per community member.</p>
     <div className="rank-assignments">{data.members.map(m=><div key={m.id} className="rank-assignment"><div><strong>{m.name}</strong><small>{m.role} · {m.discordId}</small></div>{m.role==='OWNER'?<span className="pill">Protected Owner</span>:<select aria-label={'Rank for '+m.name} disabled={!data.editable||busy} value={m.rankId||''} onChange={e=>assign(m,e.target.value)}><option value="">Default ({m.role})</option>{data.ranks.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>}</div>)}</div>
    </section>
    <section className="panel cm-panel"><h2>{selected?'Edit rank':'Create a custom rank'}</h2>
     {!data.editable?<p>Only the community owner can manage rank settings. Assigned staff permissions still apply throughout Nexify.</p>:<>
      <label htmlFor="rank-name">Rank name</label><input id="rank-name" maxLength={45} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} placeholder="e.g. Senior Administrator"/>
      <div className="rank-fields"><div><label htmlFor="rank-color">Rank color</label><input id="rank-color" type="color" value={form.color} onChange={e=>setForm(v=>({...v,color:e.target.value}))}/></div><div><label htmlFor="rank-priority">Priority (0–999)</label><input id="rank-priority" type="number" min={0} max={999} value={form.priority} onChange={e=>setForm(v=>({...v,priority:Number(e.target.value)}))}/></div></div>
      <h3>Feature permissions</h3><p>Choose exactly which actions members of this rank can perform.</p>
      <div className="rank-perm-groups">{Object.entries(groups).map(([group,keys])=><div key={group} className="rank-group"><h4>{group}</h4>{keys.map(key=><label className="rank-checkbox" key={key}><input type="checkbox" checked={form.permissions.includes(key)} disabled={key==='ranks.manage'} onChange={e=>setForm(v=>({...v,permissions:e.target.checked?[...v.permissions,key]:v.permissions.filter(x=>x!==key)}))}/><span>{labels[key]}</span>{key==='ranks.manage'&&<small>Owner only</small>}</label>)}</div>)}</div>
      <div className="staff-actions rank-buttons"><button className="cm-button" disabled={busy||form.name.trim().length<2||form.priority<0||form.priority>999} onClick={save}><Save size={16}/> {selected?'Save changes':'Create rank'}</button>{selected&&<button className="cm-remove" disabled={busy} onClick={()=>{const rank=data.ranks.find(r=>r.id===selected);if(rank)remove(rank);}}><Trash2 size={15}/> Delete</button>}{selected&&<button className="staff-mutedbtn" onClick={()=>{setSelected(null);setForm(blank());}}>Cancel</button>}</div>
     </>}
    </section>
   </div>
  </>}
  {notice&&<div className="cm-alert" role="status">{notice}</div>}{error&&data&&<div className="cm-alert error" role="alert">{error}</div>}
 </div></main></div>;
}
