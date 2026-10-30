/** Pilot-only HTTP facade around local projection receiver; no Supabase dependency. */
export function createCheckpointBatchHandler({receiver,capability,maxRecords=100}={}) {
  if(typeof receiver?.receive!=='function'||typeof capability!=='string'||!capability)
    throw new TypeError('receiver and capability required');
  return async function handle(request,response) {
    if(request.method!=='POST'||request.url!=='/fractalog/checkpoints/batch') {
      response.writeHead(404);response.end();return;
    }
    if(request.headers.authorization!==`Bearer ${capability}`) {
      response.writeHead(401);response.end();return;
    }
    let raw='';
    try {
      for await (const piece of request) {
        raw+=piece;
        if(Buffer.byteLength(raw)>2*1024*1024) throw new RangeError('request_too_large');
      }
      const body=JSON.parse(raw);
      if(body?.schema!=='fractalog.batch/v1'||!Array.isArray(body.records)||
        body.records.length<1||body.records.length>maxRecords) throw new TypeError('invalid_batch');
      const receipts=body.records.map(doc=>receiver.receive(doc));
      response.writeHead(200,{'content-type':'application/json'});
      response.end(JSON.stringify({schema:'fractalog.batch-receipts/v1',receipts}));
    } catch(error) {
      response.writeHead(error instanceof RangeError?413:400,{'content-type':'application/json'});
      response.end(JSON.stringify({error:'invalid_batch_request'}));
    }
  };
}
