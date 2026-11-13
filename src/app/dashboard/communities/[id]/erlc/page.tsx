'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect,useState} from 'react';
import {NexifySidebar} from '@/components/nexify-sidebar';
import {RadioTower,RefreshCw,Users,ShieldCheck,KeyRound,Unplug,Search,Server,Clock3} from 'lucide-react';

type Player={username:string;userId:string;team:string;permission:string;callsign:string};
type Live={name:string;owner:string;playerCount:number;maxPlayers:number|null;joinCode:string;queueCount:number;staffCount:number;players:Player[];checkedAt:string};
type Connection={connected:boolean;manager:boolean;serverName?:string;connectedAt?:string;live?:Live|null;error?:string;apiStatus?:number};
async function parse(r:Response){const v=await r.json();if(!r.ok)throw Error(v.error||'Unable to load server');return v;}
export default function ErlcPage(){
 const {id}=useParams<{id:string}>();
 const [data,setData]=useState<Connection|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [serverKey,setServerKey]=useState(''),[replaceOpen,setReplaceOpen]=useState(false),[query,setQuery]=useState(''),[team,setTeam]=useState('ALL');
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const url='/api/communities/'+id+'/erlc';
 async function load(){const v=await fetch(url,{cache:'no-store'}).then(parse) as Connection;setData(v);}
 useEffect(()=>{if(!id)return;load().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[id]);
 async function connect(){
  setBusy(true);setError('');setNotice('');
  try{const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({serverKey})}).then(parse);setServerKey('');setReplaceOpen(false);await load();setNotice('Connected to '+res.serverName+'.');}
  catch(e){setError(e instanceof Error?e.message:'Could not connect');}finally{setBusy(false);}
 }
 async function disconnect(){
  if(!window.confirm('Disconnect this ER:LC server from Nexify?'))return;
  setBusy(true);setError('');setNotice('');
  try{await fetch(url,{method:'DELETE'}).then(parse);await load();setNotice('Server disconnected.');}
  catch(e){setError(e instanceof Error?e.message:'Could not disconnect');}finally{setBusy(false);}
 }
 async function refresh(){setBusy(true);setError('');try{await load();}catch(e){setError(e instanceof Error?e.message:'Unable to refresh');}finally{setBusy(false);}}
 const live=data?.live;
 const players=live?.players||[];
 const teams=[...new Set(players.map(p=>p.team))].sort();
 const filtered=players.filter(p=>(team==='ALL'||p.team===team)&&[p.username,p.userId,p.team,p.callsign].some(x=>x.toLowerCase().includes(query.toLowerCase())));
 return <div className="app"><NexifySidebar communityId={id}/><main className="cm-page cm-content"><div className="cm-container">
  <Link className="cm-back" href={'/dashboard/communities/'+id}>← Back to community</Link>
  <header className="cm-hero"><div className="cm-logo"><RadioTower size={38}/></div><div><span className="muted">NEXIFY / ER:LC INTEGRATION</span><h1>ER:LC Server Center</h1><p>Connect your private server and view live player information</p></div></header>
  {loading?<section className="panel"><p>Loading ER:LC connection…</p></section>:!data?<section className="panel"><h2>Access unavailable</h2><p>{error||'You must be active community staff to use this section.'}</p></section>:<>
   {!data.connected?<section className="panel cm-panel erlc-connect">
    <h2><KeyRound size={19}/> Connect your private server</h2>
    <p>Owners and admins can connect the community's ER:LC private server. A valid Server Key is required. The key is encrypted before it is saved and is never shown again.</p>
    {data.manager?<><label htmlFor="erlc-key">ER:LC Server Key</label><input id="erlc-key" type="password" autoComplete="off" spellCheck={false} value={serverKey} onChange={e=>setServerKey(e.target.value)} placeholder="Paste your private server API key"/><div className="erlc-actions"><button className="cm-button" disabled={busy||serverKey.trim().length<8} onClick={connect}>{busy?'Connecting…':'Connect Server'}</button></div></>:<p>Ask your community owner or an admin to connect the server.</p>}
    <p className="erlc-help">Find the Server Key in your ER:LC private server settings under Integrations. Only use a key from a server you manage or have permission to connect.</p>
   </section>:<>
    <div className="erlc-topline"><div><span className="erlc-online"><span/> Connected</span><h2>{live?.name||data.serverName||'ER:LC Private Server'}</h2><small>Last checked: {live?new Date(live.checkedAt).toLocaleString():'Live status unavailable'}</small></div><div className="erlc-actions"><Link className="cm-button" href={'/dashboard/communities/'+id+'/erlc/controls'}><ShieldCheck size={16}/> Server Controls</Link><button className="staff-mutedbtn" disabled={busy} onClick={refresh}><RefreshCw size={16}/> Refresh</button>{data.manager&&<button className="cm-remove" disabled={busy} onClick={disconnect}><Unplug size={15}/> Disconnect</button>}</div></div>
    {data.error&&<div className="cm-alert error" role="alert">{data.error}{data.apiStatus===429?' Avoid refreshing repeatedly until the API limit resets.':''}</div>}
    <div className="erlc-stats">
      <div className="stat"><div className="muted"><Users size={15}/> PLAYERS ONLINE</div><div className="statnum">{live?live.playerCount:'—'}{live?.maxPlayers!=null&&<span className="erlc-stat-sub"> / {live.maxPlayers}</span>}</div><p>Current server population</p></div>
      <div className="stat"><div className="muted"><ShieldCheck size={15}/> STAFF ONLINE</div><div className="statnum">{live?live.staffCount:'—'}</div><p>Server staff assignments</p></div>
      <div className="stat"><div className="muted"><Clock3 size={15}/> QUEUE</div><div className="statnum">{live?live.queueCount:'—'}</div><p>Players waiting to join</p></div>
      <div className="stat"><div className="muted"><Server size={15}/> JOIN CODE</div><div className="erlc-stat-code">{live?.joinCode||'Not supplied'}</div><p>From ER:LC server settings</p></div>
    </div>
    <section className="panel erlc-roster"><div className="panelhead"><div><h2>Live player roster</h2><p>Players and teams reported by the ER:LC API. Refresh to get a new snapshot.</p></div><span className="pill">{players.length} listed</span></div>
     <div className="erlc-filters"><div className="mod-search"><Search size={16}/><input aria-label="Search players" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search username, Roblox ID, team, callsign…"/></div><select aria-label="Filter team" value={team} onChange={e=>setTeam(e.target.value)}><option value="ALL">All teams</option>{teams.map(v=><option value={v} key={v}>{v}</option>)}</select></div>
     {!live?<p>Live data cannot be displayed right now. Check the server key or refresh later.</p>:<div className="erlc-playerlist">{filtered.map((p,i)=><div className="erlc-player" key={p.userId||p.username+'-'+i}><div className="erlc-avatar">{p.username.slice(0,1).toUpperCase()}</div><div className="erlc-playername"><strong>{p.username}</strong><small>{p.userId?'Roblox ID: '+p.userId:'Roblox ID unavailable'}</small></div><div className="erlc-playerdetails"><strong>{p.team}</strong><small>{p.permission}{p.callsign?' · '+p.callsign:''}</small></div></div>)}</div>}
     {live&&filtered.length===0&&<p>{players.length?'No players match your search.':'No players currently reported by the API.'}</p>}
    </section>
    <section className="panel erlc-footnote"><h2>Connection management</h2><p>The server key remains encrypted in Nexify's database. Only active owners and admins can connect, replace, or disconnect a key. Authorized staff can use Server Controls to send supported in-game commands. Every command submitted through Nexify is logged.</p>{data.manager&&<><button className="staff-mutedbtn" disabled={busy} onClick={()=>setReplaceOpen(v=>!v)}>{replaceOpen?'Cancel key change':'Replace server key'}</button>{replaceOpen&&<div className="erlc-replace"><label htmlFor="erlc-new-key">New Server Key</label><input id="erlc-new-key" type="password" autoComplete="off" spellCheck={false} value={serverKey} onChange={e=>setServerKey(e.target.value)} placeholder="Paste the replacement key"/><button className="cm-button" disabled={busy||serverKey.trim().length<8} onClick={connect}>{busy?'Validating…':'Validate and replace connection'}</button><small>Your current connection remains active if the new key fails validation.</small></div>}</>}</section>
   </>}
  </>}
  {notice&&<div className="cm-alert" role="status">{notice}</div>}{error&&data&&<div className="cm-alert error" role="alert">{error}</div>}
 </div></main></div>;
}
