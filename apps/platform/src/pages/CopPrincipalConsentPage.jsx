/**
 * JHN COP consent display: Supabase-authenticated human interaction only.
 * Requires trusted same-origin canonical consent backend. No local override,
 * fake issuer, fallback approval, or effect execution on browser errors.
 */
import {useCallback,useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import AuthModal from '../components/common/AuthModal';
import {useSupabase} from '../contexts/SupabaseContext';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^sha256:[a-f0-9]{64}$/;
export default function CopPrincipalConsentPage(){
  const {challengeId}=useParams();
  const {session,loading}=useSupabase();
  const [showAuth,setShowAuth]=useState(false);
  const [request,setRequest]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [receipt,setReceipt]=useState(null);
  const token=session?.access_token;
  const validId=UUID.test(challengeId||'');
  const endpoint=`/api/cop/principal-consent/${encodeURIComponent(challengeId||'')}`;
  const load=useCallback(async()=>{
    if(!token||!validId)return;
    try{
      const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`,'Accept':'application/json'},cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);
      if(data.schema!=='cogentia.cop_consent_challenge.v1'||!SHA.test(data.payload_hash||''))throw Error('invalid_consent_response');
      setRequest(data);setError('');
    }catch(e){setError(e.message||'consent_service_unavailable');setRequest(null);}
  },[token,validId,endpoint]);
  useEffect(()=>{load();},[load]);
  async function decide(decision){
    if(!request||request.status!=='pending'||!token||busy||!validId)return;
    setBusy(true);setError('');
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({payload_hash:request.payload_hash,decision}),cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.ok!==true||data.decision!==decision||data.grants_mandate_authority!==false)throw Error(data.error||'consent_not_confirmed');
      setReceipt(data);setRequest(r=>({...r,status:decision==='approve'?'approved':'refused'}));
    }catch(e){setError(e.message||'consent_service_unavailable');}
    finally{setBusy(false);}
  }
  return <main style={{maxWidth:720,margin:'2rem auto',padding:'1rem'}}>
    <h1>Consentement COP — Principal JHN</h1>
    <p>Cette interface recueille une décision dans votre session Supabase authentifiée. Une décision favorable n’exécute aucun effet et ne dispense pas des contrôles COP.</p>
    {!validId?<p role="alert">Référence de demande invalide.</p>:null}
    {!loading&&!token?<><p>Connectez-vous avec votre compte Supabase JHN pour consulter la proposition.</p><button type="button" onClick={()=>setShowAuth(true)}>Connexion</button></>:null}
    {showAuth?<AuthModal onClose={()=>setShowAuth(false)} onSuccess={()=>{setShowAuth(false);load();}}/>:null}
    {error?<p role="alert">Service de consentement indisponible ou demande refusée : {error}</p>:null}
    {request?<section aria-label="Proposition COP" style={{border:'1px solid #888',borderRadius:8,padding:'1rem',marginTop:'1rem'}}>
      <dl>
        <dt>Mandat</dt><dd>{request.proposal?.mandate_ref}</dd>
        <dt>Version</dt><dd>{request.proposal?.previous_version} → {request.proposal?.new_version}</dd>
        <dt>Motif</dt><dd>{request.proposal?.reason}</dd>
        <dt>Actions autorisées proposées</dt><dd>{(request.proposal?.scope?.allowed_actions||[]).join(', ')||'Aucune'}</dd>
        <dt>Actions interdites</dt><dd>{(request.proposal?.scope?.forbidden_actions||[]).join(', ')||'Non précisées'}</dd>
        <dt>Expiration</dt><dd>{request.expires_at}</dd>
        <dt>Empreinte</dt><dd style={{overflowWrap:'anywhere'}}><code>{request.payload_hash}</code></dd>
        <dt>État</dt><dd>{request.status}</dd>
      </dl>
      {request.status==='pending'?<div style={{display:'flex',gap:12,marginTop:16}}>
        <button disabled={busy} type="button" onClick={()=>decide('approve')}>Confirmer cette proposition</button>
        <button disabled={busy} type="button" onClick={()=>decide('refuse')}>Refuser</button>
      </div>:null}
      {receipt?<p role="status">Décision {receipt.decision==='approve'?'favorable':'défavorable'} enregistrée, reçu {receipt.confirmation_event_id}. Aucun mandat ni budget n’a été créé par ce geste.</p>:null}
    </section>:null}
  </main>;
}
