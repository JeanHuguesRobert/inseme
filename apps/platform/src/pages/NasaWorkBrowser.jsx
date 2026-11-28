import {useEffect,useState} from 'react';
import {readNasaWorkObservation} from './nasaWorkObservation.js';

const terminal=new Set(['completed','failed','cancelled','blocked','unassessed']);
const labels={completed:'Completed',failed:'Failed',cancelled:'Cancelled',created:'Created',in_progress:'In progress',
  input_required:'Awaiting input',reconciliation_required:'Needs reconciliation',cancel_requested:'Cancellation requested',
  blocked:'Blocked — work not completed',unassessed:'Transport closed — work not assessed',unknown:'Unknown'};
const val=x=>x??'—';
const safeIssue=x=>typeof x==='string'&&/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/[1-9][0-9]*$/.test(x);
const state=x=>labels[x]||'Unknown';
function Budget({budget:b}){
  return <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
    {[['Allocated',b?.allocated_steps],['Consumed',b?.consumed_steps],['Reserved',b?.reserved_steps],['Returned',b?.returned_steps]].map(([label,v])=>
      <div key={label}><span className="block text-xs text-slate-400">{label}</span>{val(v)} Steps</div>)}
    <p className="col-span-full text-xs text-slate-400">Accounting: {val(b?.status)}</p>
  </div>;
}
function Detail({item:x}){
  return <div className="mt-4 space-y-3 border-t border-slate-700 pt-4">
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-slate-400">Responsible agent</dt><dd>{val(x.responsible_agent_ref)}</dd></div>
      <div><dt className="text-slate-400">Commissioned by</dt><dd>{val(x.commissioned_by_agent_ref||x.commissioned_by_principal_ref)}</dd></div>
      <div><dt className="text-slate-400">Assignment revision</dt><dd>{val(x.assignment_revision)}</dd></div>
      <div><dt className="text-slate-400">Transport phase</dt><dd>{val(x.phase)}</dd></div>
      <div><dt className="text-slate-400">Result assessment</dt><dd>{val(x.result?.postcondition_status)}</dd></div>
    </dl>
    <Budget budget={x.budget}/>
    <p className="break-all text-xs text-slate-400">{x.packet_ref}</p>
    {safeIssue(x.source_ref)&&<a className="text-sm text-emerald-400 underline" href={x.source_ref} target="_blank" rel="noreferrer">Source work / GitHub Issue</a>}
    <h4 className="font-medium">Evidence</h4>
    <ul className="space-y-2 text-sm">
      {['packet','budget','parent_budget'].map(k=><li key={k}>{k}: {val(x.proofs?.[k]?.status)} · {val(x.proofs?.[k]?.events)} events
        {x.proofs?.[k]?.head&&<code className="block break-all text-xs text-slate-400">{x.proofs[k].head}</code>}</li>)}
    </ul>
    <h4 className="font-medium">Recent packet events</h4>
    <ol className="space-y-1 text-sm text-slate-300">{(x.timeline||[]).map(e=><li key={e.seq}>{e.seq} · {val(e.phase)}</li>)}</ol>
  </div>;
}
export default function NasaWorkBrowser({token}){
  const [view,setView]=useState(null),[error,setError]=useState(null),[filter,setFilter]=useState('all');
  const [selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[detailError,setDetailError]=useState(null);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();let live=true;
    setView(null);setError(null);setSelected(null);
    readNasaWorkObservation({token,signal:controller.signal}).then(v=>{if(live)setView(v)})
      .catch(e=>{if(live)setError(e.message)});
    return ()=>{live=false;controller.abort()};
  },[token,revision]);
  useEffect(()=>{
    setDetail(null);setDetailError(null);
    if(!selected)return;
    const controller=new AbortController();let live=true;
    readNasaWorkObservation({token,packetRef:selected,signal:controller.signal}).then(v=>{if(live){setDetail(v.items[0]||null);if(!v.items.length)setDetailError('Work detail unavailable')}})
      .catch(e=>{if(live)setDetailError(e.message)});
    return ()=>{live=false;controller.abort()};
  },[token,selected,revision]);
  const rows=(view?.items||[]).filter(x=>filter==='all'||(filter==='closed'?terminal.has(x.work_status):!terminal.has(x.work_status)&&x.work_status!=='unknown'));
  return <section className="mt-8 space-y-4" aria-label="Commissioned work">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-semibold">Commissioned work</h2>
      <button onClick={()=>setRevision(r=>r+1)} className="rounded border border-slate-600 px-3 py-2 text-sm">Refresh work</button>
    </div>
    <p className="text-sm text-slate-400">COP packet-local observations, not GitHub issues or continuation counts.</p>
    {error&&<p className="text-amber-200" role="alert">Work source unavailable: {error}</p>}
    {!view&&!error&&<p className="text-slate-400">Reading COP journals…</p>}
    {view&&<><p className="text-xs text-slate-400">Observed {val(view.generated_at)} · Work: {val(view.sources?.work)} · Root budget: {val(view.sources?.root)}</p>
      {view.sources?.work!=='available'&&<p className="text-amber-200">Work source unavailable; total unknown.</p>}
      {view.sources?.root!=='available'&&<p className="text-amber-200">Root accounting unavailable; local results remain visible.</p>}
      <div className="flex flex-wrap gap-2" aria-label="Filter work">
        {[['all','All'],['open','Open transports'],['closed','Closed transports']].map(([k,label])=><button key={k} aria-pressed={filter===k}
          className={'rounded border border-slate-600 px-3 py-1 text-sm '+(filter===k?'bg-slate-700':'')} onClick={()=>{setFilter(k);setSelected(null)}}>{label}</button>)}
      </div>
      <p className="text-sm text-slate-400">{rows.length} displayed · {val(view.total)} observed in locality{view.total>view.items.length?' · bounded sample':''}</p>
      {rows.map(x=><article key={x.packet_ref} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <button className="flex w-full flex-wrap justify-between gap-2 text-left" aria-expanded={selected===x.packet_ref}
          onClick={()=>setSelected(s=>s===x.packet_ref?null:x.packet_ref)}>
          <span className="font-medium">{x.purpose||x.packet_ref}</span><span className="text-sm text-slate-400">{state(x.work_status)}</span>
        </button>
        <p className="mt-2 text-xs text-slate-400">{val(x.responsible_agent_ref)} · {val(x.created_at)}</p>
        <Budget budget={x.budget}/>
        {selected===x.packet_ref&&(detail?.packet_ref===x.packet_ref?<Detail item={detail}/>:<p className="mt-3 text-sm text-slate-400">{detailError||'Reading detail…'}</p>)}
      </article>)}
    </>}
  </section>;
}
