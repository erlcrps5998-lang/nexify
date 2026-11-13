'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {LayoutDashboard,Users,Settings,ShieldCheck,UserRoundX,CalendarDays,ClipboardList,Clock3,RadioTower,ChevronDown,House,UserCog,KeyRound} from 'lucide-react';

type Community={id:string;name:string;role:string};
export function NexifySidebar({communityId}:{communityId?:string}){
 const pathname=usePathname();
 const [communities,setCommunities]=useState<Community[]>([]);
 const [selected,setSelected]=useState(communityId||'');
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  fetch('/api/communities',{cache:'no-store'}).then(r=>r.ok?r.json():[]).then((items:Community[])=>{
   setCommunities(items);
   setSelected(current=>communityId||current||items[0]?.id||'');
  }).catch(()=>{});
 },[communityId]);
 const base=selected?'/dashboard/communities/'+selected:null;
 const staff=base?base+'/staff':null;
 const links=[
  {label:'Overview',href:'/dashboard',icon:LayoutDashboard},
  {label:'Community Settings',href:base?base+'#community-settings':null,icon:Settings},
  {label:'Members & Roles',href:base?base+'#community-members':null,icon:Users},
  {label:'Staff Directory',href:staff?staff+'#staff-directory':null,icon:UserCog},
  {label:'Advanced Permissions',href:base?base+'/ranks':null,icon:KeyRound},
  {label:'Suspensions',href:staff?staff+'#staff-directory':null,icon:UserRoundX},
  {label:'LOA Requests',href:staff?staff+'#loa-requests':null,icon:CalendarDays},
  {label:'Shift Management',href:base?base+'/shifts':null,icon:Clock3},
  {label:'Moderation',href:base?base+'/moderation':null,icon:ShieldCheck},
  {label:'Applications',href:base?base+'/applications':null,icon:ClipboardList},
  {label:'ER:LC Servers',href:base?base+'/erlc':null,icon:RadioTower},
  {label:'Server Controls',href:base?base+'/erlc/controls':null,icon:ShieldCheck}
 ];
 const coming: {label:string;icon:typeof RadioTower}[]=[];
 function active(href:string|null,label:string){
  if(!href)return false;
  if(label==='Overview')return pathname==='/dashboard';
  if(label==='Community Settings'||label==='Members & Roles')return pathname===base;
  if(label==='Shift Management')return pathname===base+'/shifts';
  if(label==='Moderation')return pathname===base+'/moderation';
  if(label==='Advanced Permissions')return pathname===base+'/ranks';
  if(label==='Applications')return pathname===base+'/applications';
  if(label==='ER:LC Servers')return pathname===base+'/erlc';
  if(label==='Server Controls')return pathname===base+'/erlc/controls';
  return pathname===staff;
 }
 return <><button className="sidebar-mobile-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="nexify-navigation">☰ Menu <ChevronDown size={14}/></button>
  <aside id="nexify-navigation" className={'sidebar nexify-sidebar'+(open?' mobile-open':'')}>
   <Link href="/" className="brand">✦ Nexify<span className="dot">.</span></Link>
   <div className="sidecaption">WORKSPACE</div>
   <label className="sidebar-select-label" htmlFor="sidebar-community">Current community</label>
   <select id="sidebar-community" className="sidebar-select" value={selected} onChange={e=>{setSelected(e.target.value);setOpen(false);}} disabled={!communities.length}>
    {!communities.length&&<option value="">No communities yet</option>}
    {communities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
   </select>
   <nav aria-label="Nexify navigation" className="sidebar-nav">
    {links.map(item=>item.href?<Link key={item.label} href={item.href} onClick={()=>setOpen(false)} className={'sideitem sidebar-link'+(active(item.href,item.label)?' active':'')}><item.icon size={17}/><span>{item.label}</span></Link>:<span key={item.label} className="sideitem sidebar-unavailable" title="Create or select a community first"><item.icon size={17}/><span>{item.label}</span></span>)}
    {coming.length>0&&<div className="sidecaption">COMING SOON</div>}
    {coming.map(item=><span key={item.label} className="sideitem sidebar-unavailable" title="Coming soon"><item.icon size={17}/><span>{item.label}</span><small>Soon</small></span>)}
   </nav>
   <div className="sidebarbottom"><Link href="/dashboard" className="sidebar-home"><House size={15}/> All communities</Link><p>NEXIFY · EARLY ACCESS</p></div>
  </aside>
 </>;
}
