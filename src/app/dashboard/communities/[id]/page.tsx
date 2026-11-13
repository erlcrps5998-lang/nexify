'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
type Role='OWNER'|'ADMIN'|'MODERATOR'|'STAFF'|'MEMBER';
type Community={id:string;name:string;slug:string;description:string|null;logoUrl:string|null;role:Role};
type Member={id:string;role:Role;user:{id:string;name:string;discordId:string;avatar:string|null}};
const roles:Role[]=['ADMIN','MODERATOR','STAFF','MEMBER'];
async function parse(res:Response){const data=await res.json();if(!res.ok)throw Error(data.error||'Request failed');return data;}
export default function CommunitySettings(){
 const {id}=useParams<{id:string}>();
 const [community,setCommunity]=useState<Community|null>(null);
 const [members,setMembers]=useState<Member[]>([]);
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[logoUrl,setLogoUrl]=useState('');
 const [discordId,setDiscordId]=useState(''),[newRole,setNewRole]=useState<Role>('STAFF');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{
  if(!id)return;
  Promise.all([fetch('/api/communities/'+id).then(parse),fetch('/api/communities/'+id+'/members').then(parse)])
   .then(([c,m]:[Community,Member[]])=>{setCommunity(c);setMembers(m);setName(c.name);setDescription(c.description||'');setLogoUrl(c.logoUrl||'');})
   .catch(e=>setError(e.message)).finally(()=>setLoading(false));
 },[id]);
 const editor=community?.role==='OWNER'||community?.role==='ADMIN';
 const selectable=community?.role==='OWNER'?roles:roles.filter(r=>r!=='ADMIN');
 async function save(){
  setError('');setNotice('');setBusy(true);
  try{const c=await fetch('/api/communities/'+id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name,description,logoUrl})}).then(parse);setCommunity(c);setNotice('Community settings saved.');}
  catch(e){setError(e instanceof Error?e.message:'Unable to save');}finally{setBusy(false);}
 }
 async function membersAction(method:'POST'|'PATCH'|'DELETE',body:object){
  setError('');setNotice('');setBusy(true);
  try{const m=await fetch('/api/communities/'+id+'/members',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(parse);setMembers(m);setDiscordId('');setNotice(method==='POST'?'Member added.':method==='PATCH'?'Role updated.':'Member removed.');}
  catch(e){setError(e instanceof Error?e.message:'Unable to update member');}finally{setBusy(false);}
 }
 const canManage=(m:Member)=>community?.role==='OWNER'?m.role!=='OWNER':community?.role==='ADMIN'&&['MODERATOR','STAFF','MEMBER'].includes(m.role);
 return <main className="cm-page"><div className="cm-container">
  <Link className="cm-back" href="/dashboard">← Back to dashboard</Link>
  {loading?<p>Loading community…</p>:!community?<div className="panel"><h2>Community unavailable</h2><p>{error||'You do not have access.'}</p><Link href="/dashboard">Return to dashboard</Link></div>:<>
   <header className="cm-hero"><div className="cm-logo">{community.logoUrl?<img alt="Community logo" src={community.logoUrl}/>:community.name.charAt(0).toUpperCase()}</div><div><span className="muted">COMMUNITY MANAGEMENT</span><h1>{community.name}</h1><p>{community.slug} · Your role: {community.role}</p></div></header>
   <div className="staff-shortcuts"><Link className="cm-button" href={"/dashboard/communities/"+id+"/staff"}>♙ Open Staff Management →</Link><span className="muted">Staff directory · Suspensions · LOA approvals</span></div><div className="cm-grid">
    <section className="panel cm-panel"><h2>Community settings</h2><p>Edit your community profile and branding.</p>
     <label htmlFor="cm-name">Community name</label><input id="cm-name" value={name} maxLength={60} onChange={e=>setName(e.target.value)} disabled={!editor||busy}/>
     <label htmlFor="cm-desc">Description</label><textarea id="cm-desc" rows={5} value={description} maxLength={1000} onChange={e=>setDescription(e.target.value)} placeholder="Describe your ER:LC community" disabled={!editor||busy}/>
     <label htmlFor="cm-logo">Logo URL</label><input id="cm-logo" type="url" value={logoUrl} maxLength={500} onChange={e=>setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" disabled={!editor||busy}/>
     <small className="muted">Paste a public HTTPS image link. Direct file uploads are not included yet.</small>
     {editor?<button className="cm-button" disabled={busy||name.trim().length<3} onClick={save}>{busy?'Saving…':'Save settings'}</button>:<p>Only owners and admins can change settings.</p>}
    </section>
    <section className="panel cm-panel"><h2>Members <span className="pill">{members.length}</span></h2><p>View members, assign roles, and manage access.</p>
     {editor&&<div className="cm-invite"><label htmlFor="cm-discord">Add member by Discord User ID</label><input id="cm-discord" value={discordId} maxLength={20} onChange={e=>setDiscordId(e.target.value.trim())} placeholder="Discord user ID" disabled={busy}/>
      <div className="cm-actions"><select aria-label="New member role" value={newRole} onChange={e=>setNewRole(e.target.value as Role)} disabled={busy}>{selectable.map(r=><option key={r} value={r}>{r}</option>)}</select><button className="cm-button" disabled={busy||!/^[0-9]{17,20}$/.test(discordId)} onClick={()=>membersAction('POST',{discordId,role:newRole})}>Add member</button></div>
      <small className="muted">Use Discord Developer Mode to copy a user's ID. They can access the community when they sign in.</small>
     </div>}
     <div className="cm-members">{members.map(m=><div className="cm-member" key={m.id}>
      <div className="cm-memberavatar">{m.user.avatar?<img src={m.user.avatar} alt=""/>:m.user.name.charAt(0).toUpperCase()}</div>
      <div className="cm-membername"><strong>{m.user.name}</strong><small>{m.user.discordId}</small></div>
      {canManage(m)?<div className="cm-membertools"><select aria-label={'Role for '+m.user.name} value={m.role} disabled={busy} onChange={e=>membersAction('PATCH',{membershipId:m.id,role:e.target.value})}>{selectable.map(r=><option key={r} value={r}>{r}</option>)}</select><button className="cm-remove" disabled={busy} onClick={()=>{if(window.confirm('Remove this member from the community?'))membersAction('DELETE',{membershipId:m.id});}}>Remove</button></div>:<span className="pill">{m.role}</span>}
     </div>)}</div>
    </section>
   </div>
  </>}
  {notice&&<div className="cm-alert" role="status">{notice}</div>}
  {error&&community&&<div className="cm-alert error" role="alert">{error}</div>}
 </div></main>;
}
