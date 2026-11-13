/**
 * JHN COP consent display: Supabase-authenticated human interaction only.
 * Requires trusted same-origin canonical consent backend. No local override,
 * fake issuer, fallback approval, or effect execution on browser errors.
 */
import {useCallback,useEffect,useState} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import AuthModal from '../components/common/AuthModal';
import {useSupabase} from '../contexts/SupabaseContext';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^sha256:[a-f0-9]{64}$/;
export default function CopPrincipalConsentPage(){
  const {challengeId}=useParams();
  const navigate=useNavigate();
  const creating=challengeId==='continuation';
  const {session,loading}=useSupabase();
  const [showAuth,setShowAuth]=useState(false);
  const [request,setRequest]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [receipt,setReceipt]=useState(null);
  const token=session?.access_token;
  const ratification=request?.proposal?.kind==='cop.mandate-ratification.proposal/v1';
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
  async function createContinuationRequest(){
    if(!creating||!token||busy)return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/cop/principal-consent/continuation-request',{
        method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',
          Accept:'application/json'},body:'{}',cache:'no-store'
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.ok!==true)throw Error(data.error||`HTTP ${response.status}`);
      if(data.already_authorized_in_scope===true){setReceipt({already_authorized:true});return;}
      if(!UUID.test(data.challenge_id||''))throw Error('invalid_consent_response');
      navigate('/cop/consent/'+data.challenge_id,{replace:true});
    }catch(e){setError(e.message||'consent_service_unavailable');}
    finally{setBusy(false);}
  }
  async function decide(decision){
    if(!request||request.status!=='pending'||!token||busy||!validId)return;
    setBusy(true);setError('');
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({payload_hash:request.payload_hash,decision}),cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      const applied=data.mandate_amendment_applied===true&&data.grants_mandate_authority===true&&
        decision==='approve'&&data.mandate_ref===request.proposal?.mandate_ref&&
        data.mandate_version===request.proposal?.new_version;
      const recordedOnly=data.grants_mandate_authority===false&&data.mandate_amendment_applied!==true;
      if(!response.ok||data.ok!==true||data.decision!==decision||(!recordedOnly&&!applied))
        throw Error(data.apply_error||data.error||'consent_not_confirmed');
      setReceipt(data);setRequest(r=>({...r,status:applied?'consumed':decision==='approve'?'approved':'refused'}));
    }catch(e){setError(e.message||'consent_service_unavailable');}
    finally{setBusy(false);}
  }
  return <main style={{maxWidth:720,margin:'2rem auto',padding:'1rem'}}>
    <h1>Consentement COP — Principal JHN</h1>
    <p>Cette interface recueille votre décision dans votre session Supabase authentifiée. Pour une extension de mandat explicitement activable, la décision favorable peut aussi appliquer cet amendement canonique après vérification. Elle n’envoie aucun courrier et ne dispense pas des contrôles COP lors des actions futures.</p>
    {creating?<section>
      <p>Ajouter uniquement la capacité <code>continuation.resolve</code> au mandat de John,
        sans modifier les interdictions ni le budget. La demande et la décision sont
        vérifiées avec votre session Supabase JHN.</p>
      {!loading&&!token?<button type="button" onClick={()=>setShowAuth(true)}>Connexion</button>:null}
      {!!token?<button type="button" disabled={busy} onClick={createContinuationRequest}>
        {busy?'Création…':'Créer la demande de consentement'}
      </button>:null}
      {receipt?.already_authorized?<p role="status">Cette capacité figure déjà dans le mandat.</p>:null}
    </section>:null}
    {!creating&&!validId?<p role="alert">Référence de demande invalide.</p>:null}
    {!creating&&!loading&&!token?<><p>Connectez-vous avec votre compte Supabase JHN pour consulter la proposition.</p><button type="button" onClick={()=>setShowAuth(true)}>Connexion</button></>:null}
    {showAuth?<AuthModal onClose={()=>setShowAuth(false)} onSuccess={()=>{setShowAuth(false);load();}}/>:null}
    {error?<p role="alert">Service de consentement indisponible ou demande refusée : {error}</p>:null}
    {request?<section aria-label="Proposition COP" style={{border:'1px solid #888',borderRadius:8,padding:'1rem',marginTop:'1rem'}}>
      {ratification?<p style={{fontWeight:600}}>Ratification d'un mandat existant : aucun nouveau pouvoir, aucune modification de version et aucun budget supplémentaire.</p>:null}
      <dl>
        <dt>Mandat</dt><dd>{request.proposal?.mandate_ref}</dd>
        <dt>Version</dt><dd>{ratification?request.proposal?.version:`${request.proposal?.previous_version} → ${request.proposal?.new_version}`}</dd>
        <dt>Motif</dt><dd>{request.proposal?.reason}</dd>
        <dt>{ratification?'Actions actuellement autorisées':'Actions autorisées proposées'}</dt><dd>{(request.proposal?.scope?.allowed_actions||[]).join(', ')||'Aucune'}</dd>
        <dt>Actions interdites</dt><dd>{(request.proposal?.scope?.forbidden_actions||[]).join(', ')||'Non précisées'}</dd>
        <dt>Expiration</dt><dd>{request.expires_at}</dd>
        <dt>Empreinte</dt><dd style={{overflowWrap:'anywhere'}}><code>{request.payload_hash}</code></dd>
        <dt>État</dt><dd>{request.status}</dd>
      </dl>
      {request.status==='pending'?<div style={{display:'flex',gap:12,marginTop:16}}>
        <button disabled={busy} type="button" onClick={()=>decide('approve')}>{ratification?'Ratifier le mandat existant':'Confirmer cette proposition'}</button>
        <button disabled={busy} type="button" onClick={()=>decide('refuse')}>Refuser</button>
      </div>:null}
      {receipt?<p role="status">{receipt.mandate_amendment_applied===true
        ?`Décision favorable authentifiée, amendement du mandat ${receipt.mandate_ref} appliqué en ${receipt.mandate_version}. Aucun courrier envoyé par cette approbation.`
        :`Décision ${receipt.decision==='approve'?'favorable':'défavorable'} enregistrée, reçu ${receipt.confirmation_event_id}. Aucun amendement de mandat appliqué par cette décision.`}</p>:null}
    </section>:null}
  </main>;
}
