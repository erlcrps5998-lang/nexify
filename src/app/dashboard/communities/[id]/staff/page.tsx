import {NexifySidebar} from '@/components/nexify-sidebar';
'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
type Role='OWNER'|'ADMIN'|'MODERATOR'|'STAFF'|'MEMBER';
type Staff={id:string;name:string;discordId:string;avatar:string|null;role:Role;title:string;suspendedUntil:string|null;suspensionReason:string};
type Overview={staff:Staff[];myMembershipId:string;myRole:Role;mySuspended:boolean};
type Leave={id:string;membershipId:string;name:string;role:Role;startDate:string;endDate:string;reason:string;status:'PENDING'|'APPROVED'|'DENIED'|'CANCELLED';reviewerNote:string;createdAt:string};
async function parse(response:Response){const value=await response.json();if(!response.ok)throw new Error(value.error||'Request failed');return value;}
function dateOnly(s:string){return s.slice(0,10);}
export default function StaffPage(){
 const {id}=useParams<{id:string}>();
 const [info,setInfo]=useState<Overview|null>(null),[leaves,setLeaves]=useState<Leave[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [editing,setEditing]=useState<string|null>(null),[title,setTitle]=useState(''),[until,setUntil]=useState(''),[reason,setReason]=useState('');
 const [start,setStart]=useState(''),[end,setEnd]=useState(''),[leaveReason,setLeaveReason]=useState('');
 const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
 const staffUrl='/api/communities/'+id+'/staff',loaUrl='/api/communities/'+id+'/loa';
 async function refresh(){
  const [staff,loa]=await Promise.all([fetch(staffUrl,{cache:'no-store'}).then(parse),fetch(loaUrl,{cache:'no-store'}).then(parse)]);
  setInfo(staff);setLeaves(loa);
 }
 useEffect(()=>{if(!id)return;refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[id]);
 const manager=info?.myRole==='OWNER'||info?.myRole==='ADMIN';
 const canManage=(m:Staff)=>Boolean(manager&&!info?.mySuspended&&m.id!==info?.myMembershipId&&(info?.myRole==='OWNER'?m.role!=='OWNER':['MODERATOR','STAFF'].includes(m.role)));
 const canReview=(l:Leave)=>Boolean(manager&&!info?.mySuspended&&l.membershipId!==info?.myMembershipId&&(info?.myRole==='OWNER'||!['OWNER','ADMIN'].includes(l.role)));
 const today=new Date().toISOString().slice(0,10);
 async function saveStaff(m:Staff){
  setBusy(true);setError('');setSuccess('');
  try{
   await fetch(staffUrl,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({membershipId:m.id,title,suspendedUntil:until?new Date(until+'T23:59:59.000Z').toISOString():null,suspensionReason:reason})}).then(parse);
   await refresh();setEditing(null);setSuccess('Staff record saved.');
  }catch(e){setError(e instanceof Error?e.message:'Could not save staff.');}finally{setBusy(false);}
 }
 async function requestLeave(){
  setBusy(true);setError('');setSuccess('');
  try{
   const data=await fetch(loaUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({startDate:start,endDate:end,reason:leaveReason})}).then(parse);
   setLeaves(data);setStart('');setEnd('');setLeaveReason('');setSuccess('Leave request submitted for review.');
  }catch(e){setError(e instanceof Error?e.message:'Could not request leave.');}finally{setBusy(false);}
 }
 async function updateLeave(l:Leave,status:'APPROVED'|'DENIED'|'CANCELLED'){
  setBusy(true);setError('');setSuccess('');
  try{
   const data=await fetch(loaUrl,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:l.id,status,reviewerNote:reviewNotes[l.id]||''})}).then(parse);
   setLeaves(data);setSuccess('Leave request '+status.toLowerCase()+'.');
  }catch(e){setError(e instanceof Error?e.message:'Could not update request.');}finally{setBusy(false);}
 }
 return <div className="app"><NexifySidebar communityId={id}/><main className="cm-page cm-content"><div className="cm-container">
  <Link className="cm-back" href={'/dashboard/communities/'+id}>← Back to community</Link>
  <header className="cm-hero"><div className="cm-logo">♙</div><div><span className="muted">NEXIFY / COMMUNITY STAFF</span><h1>Staff Management</h1><p>Directory, titles, suspensions, permissions and leave requests</p></div></header>
  {loading?<div className="panel"><p>Loading staff records…</p></div>:!info?<div className="panel"><h2>Staff not available</h2><p>{error||'You must belong to this community to continue.'}</p></div>:<>
   <div className="staff-stats"><div className="stat"><span className="muted">STAFF MEMBERS</span><div className="statnum">{info.staff.length}</div></div><div className="stat"><span className="muted">ACTIVE</span><div className="statnum">{info.staff.filter(m=>!m.suspendedUntil||new Date(m.suspendedUntil)<=new Date()).length}</div></div><div className="stat"><span className="muted">SUSPENDED</span><div className="statnum">{info.staff.filter(m=>m.suspendedUntil&&new Date(m.suspendedUntil)>new Date()).length}</div></div><div className="stat"><span className="muted">PENDING LOAS</span><div className="statnum">{leaves.filter(l=>l.status==='PENDING').length}</div></div></div>
   <section id="staff-directory" className="panel staff-panel"><div className="panelhead"><div><h2>Staff directory</h2><p>Roles are assigned in Community Management. Owners can manage admins; admins can manage moderators and staff.</p></div><span className="pill">{info.myRole}</span></div>
    <div className="staff-rows">{info.staff.map(m=><div className="staff-entry" key={m.id}>
     <div className="staff-entry-top"><div className="cm-memberavatar">{m.avatar?<img src={m.avatar} alt=""/>:m.name.slice(0,1)}</div><div className="staff-entry-name"><strong>{m.name}</strong><small>{m.title||m.discordId}</small></div><span className="pill">{m.role}</span><span className={m.suspendedUntil&&new Date(m.suspendedUntil)>new Date()?'staff-state suspended':'staff-state'}>{m.suspendedUntil&&new Date(m.suspendedUntil)>new Date()?'Suspended':'Active'}</span>{canManage(m)&&<button className="staff-mutedbtn" disabled={busy} onClick={()=>{setEditing(editing===m.id?null:m.id);setTitle(m.title);setUntil(m.suspendedUntil&&new Date(m.suspendedUntil)>new Date()?dateOnly(m.suspendedUntil):'');setReason(m.suspensionReason);}}> {editing===m.id?'Close':'Manage'} </button>}</div>
     {m.suspendedUntil&&new Date(m.suspendedUntil)>new Date()&&<p className="staff-note">Suspended until {new Date(m.suspendedUntil).toLocaleDateString()} {m.suspensionReason?'· '+m.suspensionReason:''}</p>}
     {editing===m.id&&canManage(m)&&<div className="staff-editor"><div><label htmlFor={'title-'+m.id}>Position / title</label><input id={'title-'+m.id} value={title} maxLength={60} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Senior Moderator"/></div><div><label htmlFor={'until-'+m.id}>Suspension ends (optional)</label><input id={'until-'+m.id} type="date" min={today} value={until} onChange={e=>setUntil(e.target.value)}/></div><div className="staff-full"><label htmlFor={'reason-'+m.id}>Suspension reason (up to 300 characters)</label><textarea id={'reason-'+m.id} value={reason} onChange={e=>setReason(e.target.value)} maxLength={300} placeholder="Reason for temporary suspension"/></div><div className="staff-full staff-actions"><button className="cm-button" disabled={busy} onClick={()=>saveStaff(m)}>Save changes</button><button className="staff-mutedbtn" onClick={()=>{setUntil('');setReason('');}} disabled={busy}>Clear suspension</button><Link className="staff-mutedbtn" href={'/dashboard/communities/'+id}>Edit role / permissions →</Link></div></div>}
    </div>)}</div>
    {!info.staff.length&&<p>No staff yet. Add members and assign staff ranks in Community Management.</p>}
   </section>
   <div id="loa-requests" className="staff-split">
    <section className="panel cm-panel"><h2>Request leave of absence</h2><p>Submit an LOA for a manager to review. Requests can cover up to 90 days.</p>
     {info.myRole==='MEMBER'?<p>Staff access is required to request leave.</p>:<><label htmlFor="leave-start">Start date</label><input id="leave-start" type="date" min={today} value={start} onChange={e=>setStart(e.target.value)}/><label htmlFor="leave-end">End date</label><input id="leave-end" type="date" min={start||today} value={end} onChange={e=>setEnd(e.target.value)}/><label htmlFor="leave-reason">Reason</label><textarea id="leave-reason" rows={4} maxLength={500} value={leaveReason} onChange={e=>setLeaveReason(e.target.value)} placeholder="Explain the time off you are requesting"/><button className="cm-button" disabled={busy||!start||!end||leaveReason.trim().length<5} onClick={requestLeave}>Submit LOA request</button></>}
    </section>
    <section className="panel cm-panel"><h2>{manager?'Leave requests & approvals':'My leave requests'}</h2><p>{manager?'Review staff requests. You cannot approve your own LOA.':'Track your requests and their approval status.'}</p>
     <div className="staff-rows">{leaves.map(l=><div className="staff-leave" key={l.id}><div className="staff-leave-top"><strong>{l.name}</strong><span className={'staff-state '+(l.status==='DENIED'?'suspended':'')}>{l.status}</span></div><small>{dateOnly(l.startDate)} through {dateOnly(l.endDate)} · {l.role}</small><p>{l.reason}</p>{l.reviewerNote&&<small>Manager note: {l.reviewerNote}</small>}
      {l.status==='PENDING'&&canReview(l)&&<><textarea rows={2} value={reviewNotes[l.id]||''} maxLength={500} onChange={e=>setReviewNotes(v=>({...v,[l.id]:e.target.value}))} placeholder="Optional review note"/><div className="staff-actions"><button className="cm-button" disabled={busy} onClick={()=>updateLeave(l,'APPROVED')}>Approve</button><button className="cm-remove" disabled={busy} onClick={()=>updateLeave(l,'DENIED')}>Deny</button></div></>}
      {l.status==='PENDING'&&l.membershipId===info.myMembershipId&&<button className="staff-mutedbtn" disabled={busy} onClick={()=>updateLeave(l,'CANCELLED')}>Cancel request</button>}
     </div>)}</div>{!leaves.length&&<p>No leave requests yet.</p>}
    </section>
   </div>
  </>}
  {success&&<div className="cm-alert" role="status">{success}</div>}
  {error&&info&&<div className="cm-alert error" role="alert">{error}</div>}
 </div></main></div>;
}
