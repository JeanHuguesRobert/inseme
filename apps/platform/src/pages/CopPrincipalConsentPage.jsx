/**
 * JHN COP consent display: Supabase-authenticated human interaction only.
 * Requires trusted same-origin canonical consent backend. No local override,
 * fake issuer, fallback approval, or effect execution on browser errors.
 */
import {useCallback,useEffect,useRef,useState} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import AuthModal from '../components/common/AuthModal';
import {useSupabase} from '../contexts/SupabaseContext';
import './CopPrincipalConsentPage.css';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^sha256:[a-f0-9]{64}$/;
export default function CopPrincipalConsentPage(){
  const {challengeId}=useParams();
  const navigate=useNavigate();
  const repositoryCreating=challengeId==='repository';
  const creating=challengeId==='continuation'||repositoryCreating;
  // Owner-authenticated direct activation: no expiring challenge or
  // second confirmation. A deliberate POST is the Principal's one act.
  const standingDirect=challengeId==='standing';
  const {session,loading}=useSupabase();
  const [showAuth,setShowAuth]=useState(false);
  const [request,setRequest]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [receipt,setReceipt]=useState(null);
  const directAttempted=useRef(false);
  const token=session?.access_token;
  const ratification=request?.proposal?.kind==='cop.mandate-ratification.proposal/v1';
  const consentComplete=request?.status==='consumed';
  const statusLabel={pending:'En attente de votre décision',approved:'Approbation enregistrée',consumed:'Traitée — consentement consommé',refused:'Refusée',expired:'Expirée'}[request?.status]||request?.status;
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
      const response=await fetch('/api/cop/principal-consent/'+(repositoryCreating?'repository-request':'continuation-request'),{
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
  async function activateStanding(){
    if(!standingDirect||!token||busy)return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/cop/principal-consent/standing-apply',{
        method:'POST',headers:{Authorization:`Bearer ${token}`,
          'Content-Type':'application/json',Accept:'application/json'},
        body:'{}',cache:'no-store'
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.ok!==true||
         !(data.already_authorized_in_scope===true||
           data.mandate_amendment_applied===true))
        throw Error(data.error||`HTTP ${response.status}`);
      setReceipt(data);
    }catch(e){setError(e.message||'standing_activation_unavailable');}
    finally{setBusy(false);}
  }
  // The Principal already requested this exact mandate. Opening the stable
  // route is the one intentional act: after current Supabase authentication
  // the server applies the deterministic mandate and returns its receipt.
  // There is no approval button, temporary challenge or confirmation step.
  useEffect(()=>{
    if(!standingDirect||loading||!token||directAttempted.current)return;
    directAttempted.current=true;
    void activateStanding();
  },[standingDirect,loading,token]);
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
    <h1>{standingDirect?'Mandat permanent JHN':'Consentement COP — Principal JHN'}</h1>
    {!standingDirect?<p>Cette interface recueille votre décision dans votre session Supabase authentifiée. Pour une extension de mandat explicitement activable, la décision favorable peut aussi appliquer cet amendement canonique après vérification. Elle n’envoie aucun courrier et ne dispense pas des contrôles COP lors des actions futures.</p>:null}
    {standingDirect?<section>
      <p>Activation du mandat permanent JHN et de son amendement préparé
      par le serveur. Votre session Supabase identifie le Principal.
      Aucun challenge, lien d'expiration ou deuxième approbation n'est nécessaire.</p>
      {!loading&&!token?<div role="status">
        <p><strong>Supabase : non connecté. Aucun mandat n'a été validé.</strong></p>
        <button type="button" onClick={()=>setShowAuth(true)}>Se connecter</button>
      </div>:null}
      {!!token&&!receipt&&!error?<p role="status">
        {busy?'Activation du mandat en cours…':'Vérification de votre session Supabase…'}
      </p>:null}
      {!!token&&error?<p role="alert">
        Session Supabase non reconnue ou opération indisponible :
        le mandat n'a pas été validé.
        <button type="button" disabled={busy}
          onClick={activateStanding}>Réessayer</button>
      </p>:null}
      {receipt?.already_authorized_in_scope||receipt?.mandate_amendment_applied?
        <div role="status">
          <p><strong>Supabase : connexion vérifiée. Mandat validé.</strong></p>
          <dl>
            <dt>Mandat</dt><dd>{receipt.mandate_ref}</dd>
            <dt>Version active</dt><dd>{receipt.mandate_version}</dd>
            <dt>Exécution autorisée</dt>
            <dd>Mode normal sur Fracta2 et le ThinkPad, selon le mandat COP.
              {receipt.mandate_version==='v8'?' Périmètre administratif super sur Fracta2 ratifié ; chaque acte reste soumis à son admission COP.':' '}
            </dd>
            <dt>Traçabilité</dt>
            <dd>{receipt.approval_evidence_ref||'Déjà enregistré dans COP'}</dd>
          </dl>
        </div>:null}
    </section>:null}
    {creating?<section>
      {repositoryCreating?<p>Étendre le mandat permanent de John aux opérations Git et GitHub, pour les dépôts accessibles avec les identifiants délégués. GitHub contrôle les permissions. Les interdictions et le budget COP existants sont conservés.</p>:<p>Ajouter uniquement la capacité <code>continuation.resolve</code> au mandat de John, sans modifier les interdictions ni le budget. La demande et la décision sont vérifiées avec votre session Supabase JHN.</p>}
      {!loading&&!token?<button type="button" onClick={()=>setShowAuth(true)}>Connexion</button>:null}
      {!!token?<button type="button" disabled={busy} onClick={createContinuationRequest}>
        {busy?'Création…':'Créer la demande de consentement'}
      </button>:null}
      {receipt?.already_authorized?<p role="status">Cette capacité figure déjà dans le mandat.</p>:null}
    </section>:null}
    {!creating&&!standingDirect&&!validId?<p role="alert">Référence de demande invalide.</p>:null}
    {!creating&&!standingDirect&&!loading&&!token?<><p>Connectez-vous avec votre compte Supabase JHN pour consulter la proposition.</p><button type="button" onClick={()=>setShowAuth(true)}>Connexion</button></>:null}
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
        {request.proposal?.scope?.repository_policy?<>
          <dt>Périmètre des dépôts</dt>
          <dd>{request.proposal.scope.repository_policy.provider==='github'?'GitHub — dépôts accessibles avec les identifiants délégués':`${request.proposal.scope.repository_policy.account||'Périmètre'} — ${request.proposal.scope.repository_policy.selection}`} ; dépôts futurs : {request.proposal.scope.repository_policy.include_future?'inclus':'exclus'} ; cible de l'opération : {request.proposal.scope.repository_policy.require_verified_target?'vérifiée':'non précisée'} ; permissions : {request.proposal.scope.repository_policy.ownership_check==='provider_enforced'?'contrôlées par GitHub':'selon politique du mandat'}</dd>
        </>:null}
        <dt>Expiration</dt><dd>{request.expires_at}</dd>
        <dt>Empreinte</dt><dd style={{overflowWrap:'anywhere'}}><code>{request.payload_hash}</code></dd>
        <dt>État</dt><dd>{statusLabel} <small>(COP : {request.status})</small></dd>
      </dl>
      {request.status==='pending'?<section className="cop-consent-decision" aria-label="Décision sur le mandat">
        <h2>Votre décision</h2>
        <p>Choisissez explicitement l’une des deux actions ci-dessous. Cette décision porte sur la proposition présentée ci-dessus.</p>
        <div className="cop-consent-decision-actions">
          <button className="cop-consent-action cop-consent-action-approve" disabled={busy} type="button" onClick={()=>decide('approve')}>
            {busy?'Traitement en cours…':ratification?'Ratifier le mandat existant':'Approuver le mandat'}
          </button>
          <button className="cop-consent-action cop-consent-action-refuse" disabled={busy} type="button" onClick={()=>decide('refuse')}>
            Refuser le mandat
          </button>
        </div>
      </section>:null}
      {consentComplete?<section className="cop-consent-resolved" role="status" aria-label="Consentement déjà traité">
        <h2>Consentement déjà traité</h2>
        <p>Cette demande a déjà été approuvée et consommée. Elle n’appelle aucune nouvelle décision. Pour modifier les autorisations, il faut une nouvelle proposition de mandat.</p>
      </section>:null}
      {request.status==='approved'?<p className="cop-consent-resolved" role="status">Approbation enregistrée. L’application éventuelle de l’amendement doit être confirmée séparément ; aucune nouvelle décision n’est attendue sur cette demande.</p>:null}
      {request.status==='refused'?<p className="cop-consent-resolved" role="status">Demande refusée : aucune décision supplémentaire n’est attendue.</p>:null}
      {request.status==='expired'?<p className="cop-consent-resolved" role="status">Demande expirée : aucune décision n’est possible sur cette proposition.</p>:null}
      {receipt?<p role="status">{receipt.mandate_amendment_applied===true
        ?`Décision favorable authentifiée, amendement du mandat ${receipt.mandate_ref} appliqué en ${receipt.mandate_version}. Aucun courrier envoyé par cette approbation.`
        :`Décision ${receipt.decision==='approve'?'favorable':'défavorable'} enregistrée, reçu ${receipt.confirmation_event_id}. Aucun amendement de mandat appliqué par cette décision.`}</p>:null}
    </section>:null}
  </main>;
}
