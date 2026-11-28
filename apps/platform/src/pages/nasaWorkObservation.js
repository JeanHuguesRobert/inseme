const base='/api/cop/principal-consent/work-observation';
const packetPattern=/^packet:pkt-mcp-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
export async function readNasaWorkObservation({token,packetRef=null,signal,fetchImpl=fetch}={}){
  if(!token)throw Error('principal_session_required');
  const suffix=packetRef?packetPattern.exec(packetRef)?.[1]:null;
  if(packetRef&&!suffix)throw Error('invalid_packet_reference');
  const response=await fetchImpl(base+(suffix?'-'+suffix:''),{
    method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal,cache:'no-store'});
  if(!response.ok)throw Error('work_observation_http_'+response.status);
  const view=await response.json();
  if(view?.schema!=='cogentia.nasa.work/v1'||!Array.isArray(view.items))
    throw Error('work_observation_invalid');
  if(packetRef&&(view.items.length>1||view.items.some(x=>x.packet_ref!==packetRef)))
    throw Error('work_observation_reference_mismatch');
  return view;
}
