'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {NexifySidebar} from '@/components/nexify-sidebar';
import {ClipboardList,Plus,Trash2,ChevronUp,ChevronDown} from 'lucide-react';

type Kind='SHORT'|'LONG'|'SELECT'|'CHECKBOX';
type Question={id:string;label:string;type:Kind;required:boolean;options:string[]};
type Form={id:string;title:string;description:string|null;isOpen:boolean;questions:Question[];count?:number};
type Submission={id:string;name:string;discordId?:string;status:string;answers:Record<string,string|string[]>;questionSnapshot:Question[];reviewerNote:string|null;reviewerName:string|null;submittedAt:string};
type Listing={communityName:string;manager:boolean;reviewer:boolean;authenticated:boolean;forms:Form[]};
const emptyQuestion=():Question=>({id:'q_'+Math.random().toString(36).slice(2,12),label:'',type:'SHORT',required:true,options:[]});
async function parse(r:Response){const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d;}
export default function ApplicationsPage(){
 const {id}=useParams<{id:string}>();
 const base='/api/communities/'+id+'/applications';
 const [data,setData]=useState<Listing|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [tab,setTab]=useState<'forms'|'apply'|'review'>('forms');
 const [editing,setEditing]=useState<string|null>(null),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[isOpen,setIsOpen]=useState(false),[questions,setQuestions]=useState<Question[]>([emptyQuestion()]);
 const [selected,setSelected]=useState(''),[answers,setAnswers]=useState<Record<string,string|string[]>>({});
 const [submissions,setSubmissions]=useState<Submission[]>([]),[reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
 const [expanded,setExpanded]=useState<string|null>(null);
 async function refresh(){const d=await fetch(base,{cache:'no-store'}).then(parse) as Listing;setData(d);setSelected(x=>d.forms.some(f=>f.id===x)?x:d.forms[0]?.id||'');}
 useEffect(()=>{if(!id)return;refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[id]);
 async function fetchSubmissions(formId:string){
  if(!formId){setSubmissions([]);return;}
  try{const d=await fetch(base+'/submissions?formId='+encodeURIComponent(formId),{cache:'no-store'}).then(parse);setSubmissions(d.submissions);}catch(e){setError(e instanceof Error?e.message:'Could not load submissions');}
 }
 useEffect(()=>{if(!selected||!data?.authenticated)return;fetchSubmissions(selected);setAnswers({});},[selected,data?.authenticated]);
 function resetForm(){setEditing(null);setTitle('');setDescription('');setIsOpen(false);setQuestions([emptyQuestion()]);}
 function editForm(f:Form){setEditing(f.id);setTitle(f.title);setDescription(f.description||'');setIsOpen(f.isOpen);setQuestions(f.questions.map(q=>({...q,options:[...q.options]})));setTab('forms');}
 function setQuestion(index:number,patch:Partial<Question>){setQuestions(q=>q.map((x,i)=>i===index?{...x,...patch}:x));}
 async function saveForm(){
  setError('');setNotice('');setBusy(true);
  try{await fetch(base,{method:editing?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...(editing?{formId:editing}:{}),title,description,isOpen,questions:questions.map(q=>({...q,label:q.label.trim(),options:q.options.map(o=>o.trim()).filter(Boolean)}))})}).then(parse);await refresh();resetForm();setNotice('Application form saved.');}catch(e){setError(e instanceof Error?e.message:'Unable to save form');}finally{setBusy(false);}
 }
 async function submit(){
  setError('');setNotice('');setBusy(true);
  try{await fetch(base+'/submissions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({formId:selected,answers})}).then(parse);await fetchSubmissions(selected);setNotice('Application submitted successfully.');setAnswers({});}catch(e){setError(e instanceof Error?e.message:'Unable to submit');}finally{setBusy(false);}
 }
 async function review(submissionId:string,status:'UNDER_REVIEW'|'ACCEPTED'|'DENIED'){
  setError('');setNotice('');setBusy(true);
  try{await fetch(base+'/submissions',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({submissionId,status,reviewerNote:reviewNotes[submissionId]||''})}).then(parse);await fetchSubmissions(selected);setNotice('Hiring decision saved.');}catch(e){setError(e instanceof Error?e.message:'Unable to review');}finally{setBusy(false);}
 }
 const form=data?.forms.find(f=>f.id===selected);
 const mySubmission=!data?.reviewer?submissions[0]:null;
 return <div className="app"><NexifySidebar communityId={id}/><main className="cm-page cm-content"><div className="cm-container">
  <Link href={'/dashboard/communities/'+id} className="cm-back">← Back to community</Link>
  <header className="cm-hero"><div className="cm-logo"><ClipboardList size={38}/></div><div><span className="muted">NEXIFY / RECRUITMENT</span><h1>Application Center</h1><p>Custom forms, questions, submissions and hiring decisions</p></div></header>
  {loading?<div className="panel">Loading applications…</div>:!data?<div className="panel"><h2>Applications unavailable</h2><p>{error}</p></div>:<>
   <nav className="app-tabs" aria-label="Application sections">
    <button className={tab==='forms'?'selected':''} onClick={()=>setTab('forms')}>Applications</button>
    <button className={tab==='apply'?'selected':''} onClick={()=>setTab('apply')}>Apply</button>
    {data.reviewer&&<button className={tab==='review'?'selected':''} onClick={()=>setTab('review')}>Review Submissions</button>}
   </nav>
   {tab==='forms'&&<div className="application-grid">
    <section className="panel cm-panel"><h2>Community applications</h2><p>Choose a form. Managers can create, edit and open or close applications.</p>
     <div className="app-list">{data.forms.map(f=><div className="app-list-item" key={f.id}><div><strong>{f.title}</strong><small>{f.description||'No description'}</small></div><span className={'app-status '+(f.isOpen?'open':'closed')}>{f.isOpen?'Open':'Closed'}</span>{data.manager&&<button className="staff-mutedbtn" onClick={()=>editForm(f)}>Edit</button>}<button className="staff-mutedbtn" onClick={()=>{setSelected(f.id);setTab('apply');}}>View</button></div>)}</div>
     {!data.forms.length&&<p>No application forms yet.</p>}
    </section>
    {data.manager&&<section className="panel cm-panel"><h2>{editing?'Edit application':'Create application'}</h2><p>Build your form with up to 25 questions. Each question can be required or optional.</p>
      <label htmlFor="app-title">Application title</label><input id="app-title" value={title} maxLength={90} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Moderator Application"/>
      <label htmlFor="app-description">Description</label><textarea id="app-description" value={description} maxLength={1200} rows={3} onChange={e=>setDescription(e.target.value)} placeholder="What is this role about?"/>
      <label className="app-check"><input type="checkbox" checked={isOpen} onChange={e=>setIsOpen(e.target.checked)}/> Accept new applications (Open)</label>
      <h3>Form questions</h3>
      <div className="app-question-builder">{questions.map((q,i)=><div className="app-question" key={q.id}>
       <div className="app-question-header"><strong>Question {i+1}</strong><div><button aria-label="Move question up" disabled={i===0} onClick={()=>setQuestions(a=>{const b=[...a];[b[i-1],b[i]]=[b[i],b[i-1]];return b;})}><ChevronUp size={16}/></button><button aria-label="Move question down" disabled={i===questions.length-1} onClick={()=>setQuestions(a=>{const b=[...a];[b[i+1],b[i]]=[b[i],b[i+1]];return b;})}><ChevronDown size={16}/></button><button aria-label="Remove question" disabled={questions.length===1} onClick={()=>setQuestions(a=>a.filter(x=>x.id!==q.id))}><Trash2 size={16}/></button></div></div>
       <input aria-label={'Question '+(i+1)+' text'} value={q.label} onChange={e=>setQuestion(i,{label:e.target.value})} maxLength={180} placeholder="Type your question"/>
       <select aria-label={'Question '+(i+1)+' type'} value={q.type} onChange={e=>setQuestion(i,{type:e.target.value as Kind,options:['SELECT','CHECKBOX'].includes(e.target.value)?q.options.length>=2?q.options:['Option 1','Option 2']:[]})}><option value="SHORT">Short answer</option><option value="LONG">Long answer</option><option value="SELECT">Multiple choice (one)</option><option value="CHECKBOX">Checkboxes (multiple)</option></select>
       {['SELECT','CHECKBOX'].includes(q.type)&&<><label>Options (one per line, 2–12)</label><textarea aria-label={'Question '+(i+1)+' options'} rows={4} value={q.options.join('\n')} onChange={e=>setQuestion(i,{options:e.target.value.split('\n').slice(0,12)})}/></>}
       <label className="app-check"><input type="checkbox" checked={q.required} onChange={e=>setQuestion(i,{required:e.target.checked})}/> Required</label>
      </div>)}</div>
      <div className="staff-actions"><button className="staff-mutedbtn" disabled={questions.length>=25} onClick={()=>setQuestions(q=>[...q,emptyQuestion()])}><Plus size={15}/> Add question</button><button className="cm-button" disabled={busy||title.trim().length<3||questions.some(q=>q.label.trim().length<3)} onClick={saveForm}>{busy?'Saving…':editing?'Save changes':'Create application'}</button>{editing&&<button className="staff-mutedbtn" onClick={resetForm}>Cancel editing</button>}</div>
     </section>}
   </div>}
   {tab==='apply'&&<section className="panel cm-panel"><h2>Apply to {data.communityName}</h2><p>Choose an open position and complete its application.</p>
    <label htmlFor="app-select">Application</label><select id="app-select" value={selected} onChange={e=>setSelected(e.target.value)}>{data.forms.map(f=><option key={f.id} value={f.id}>{f.title}{f.isOpen?'':' (Closed)'}</option>)}</select>
    {!form?<p>No applications are currently available.</p>:<><h3>{form.title}</h3><p>{form.description}</p>
      {!form.isOpen&&<p className="app-closed-message">This application is currently closed.</p>}
      {!data.authenticated&&<p>Please <Link href="/login">sign in with Discord</Link> to submit your application.</p>}
      {mySubmission&&<div className="cm-alert">You already submitted this application. Status: <strong>{mySubmission.status.replace('_',' ')}</strong>{mySubmission.reviewerNote&&<p>Reviewer note: {mySubmission.reviewerNote}</p>}</div>}
      {form.questions.map(q=><div className="app-answer" key={q.id}><label htmlFor={q.id}>{q.label}{q.required?' *':''}</label>
       {q.type==='SHORT'&&<input id={q.id} disabled={!form.isOpen||!!mySubmission} value={typeof answers[q.id]==='string'?answers[q.id] as string:''} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))} maxLength={2000}/>}
       {q.type==='LONG'&&<textarea id={q.id} rows={4} disabled={!form.isOpen||!!mySubmission} value={typeof answers[q.id]==='string'?answers[q.id] as string:''} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))} maxLength={2000}/>}
       {q.type==='SELECT'&&<select id={q.id} disabled={!form.isOpen||!!mySubmission} value={typeof answers[q.id]==='string'?answers[q.id] as string:''} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))}><option value="">Choose an answer</option>{q.options.map(o=><option key={o}>{o}</option>)}</select>}
       {q.type==='CHECKBOX'&&<div className="app-options">{q.options.map(o=><label key={o} className="app-check"><input type="checkbox" disabled={!form.isOpen||!!mySubmission} checked={Array.isArray(answers[q.id])&&(answers[q.id] as string[]).includes(o)} onChange={e=>setAnswers(a=>{const old=Array.isArray(a[q.id])?a[q.id] as string[]:[];return {...a,[q.id]:e.target.checked?[...old,o]:old.filter(x=>x!==o)};})}/>{o}</label>)}</div>}
      </div>)}
      <button className="cm-button" disabled={!form.isOpen||!data.authenticated||!!mySubmission||busy} onClick={submit}>{busy?'Submitting…':'Submit application'}</button>
     </>}
   </section>}
   {tab==='review'&&data.reviewer&&<section className="panel cm-panel"><h2>Application review queue</h2><p>Review responses, leave notes, and mark candidates Under Review, Accepted, or Denied. Accepting does not automatically add them to staff.</p>
    <label htmlFor="review-form">Application form</label><select id="review-form" value={selected} onChange={e=>setSelected(e.target.value)}>{data.forms.map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select>
    <div className="app-review-list">{submissions.map(s=><article key={s.id} className="app-review-card"><div className="app-review-head"><div><strong>{s.name}</strong><small>Discord ID: {s.discordId} · {new Date(s.submittedAt).toLocaleString()}</small></div><span className="pill">{s.status.replace('_',' ')}</span></div>
      <button className="staff-mutedbtn" onClick={()=>setExpanded(expanded===s.id?null:s.id)}>{expanded===s.id?'Hide answers':'Review answers'}</button>
      {expanded===s.id&&<div className="app-review-detail">{s.questionSnapshot.map(q=><div key={q.id}><strong>{q.label}</strong><p>{Array.isArray(s.answers[q.id])?(s.answers[q.id] as string[]).join(', '):s.answers[q.id]||'No answer'}</p></div>)}
       <label htmlFor={'note-'+s.id}>Reviewer note</label><textarea id={'note-'+s.id} rows={3} maxLength={1000} value={reviewNotes[s.id]??s.reviewerNote??''} onChange={e=>setReviewNotes(v=>({...v,[s.id]:e.target.value}))}/>
       <div className="staff-actions"><button className="staff-mutedbtn" disabled={busy} onClick={()=>review(s.id,'UNDER_REVIEW')}>Under Review</button><button className="cm-button" disabled={busy} onClick={()=>review(s.id,'ACCEPTED')}>Accept</button><button className="cm-remove" disabled={busy} onClick={()=>review(s.id,'DENIED')}>Deny</button></div>
       {s.reviewerName&&<small>Last reviewed by {s.reviewerName}</small>}
      </div>}
     </article>)}</div>
    {!submissions.length&&<p>No submissions for this form.</p>}
   </section>}
  </>}
  {notice&&<div className="cm-alert" role="status">{notice}</div>}
  {error&&data&&<div className="cm-alert error" role="alert">{error}</div>}
 </div></main></div>;
}
