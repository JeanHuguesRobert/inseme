import fs from "node:fs";
import { computeResourceSnapshot,admitComputeResources,computeResourceReceipt } from "./github-compute-resources.js";

const [mode,...args]=process.argv.slice(2);
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2));
const quota=()=> {
 const num=process.env.GITHUB_COMPUTE_AVAILABLE_MINUTES;
 return num && Number.isFinite(Number(num)) ? Number(num) : undefined;
};
if(mode==="before"){
 const [snapshotPath,admissionPath,outputPath,timeoutRaw]=args;
 const before=computeResourceSnapshot({available:{actions_minutes:quota()}});
 const estimate=Math.ceil(Number(timeoutRaw)/60);
 const reserve=Number(process.env.GITHUB_COMPUTE_RECOVERY_RESERVE_MINUTES||0);
 const policy=process.env.GITHUB_COMPUTE_UNKNOWN_QUOTA_POLICY==="conservative"?"conservative":"allow_unknown";
 const admission=admitComputeResources({before,required:{actions_minutes:estimate},reserve:{actions_minutes:reserve},policy});
 // The provider quota is not a mandate: do not claim COP budget admission.
 write(snapshotPath,before);write(admissionPath,admission);
 fs.appendFileSync(outputPath,`admission=${admission.decision}\n`);
} else if(mode==="after"){
 const [beforePath,admissionPath,resultPath]=args;
 const before=read(beforePath),admission=read(admissionPath);
 const result=read(resultPath);
 const status=result.execution_receipt?.status||"failed";
 const after=computeResourceSnapshot({available:{actions_minutes:quota()}});
 const resources=computeResourceReceipt({before,after,admission,
  executionStatus:admission.decision==="admitted"?status:"not_started",
  usage:{actions_minutes:undefined}});
 result.resource_accounting=resources;
 write(resultPath,result);
} else if(mode==="refuse"){
 const [requestPath,resultPath,admissionPath]=args;
 const request=read(requestPath),admission=read(admissionPath);
 const binding={schema:"magistral.execution-binding/v1",requirement_ref:`requirement:compute-request:${request.computation_id}`,
  offer_id:"offer:github-actions:typed-compute-v1",runtime_id:"runtime:github-actions:ubuntu-latest",
  handler_instance_ref:`handler:github-actions:${process.env.GITHUB_RUN_ID||"local"}`,
  execution_surface:"batch",provider_ref:"provider:github-actions",provider_execution_id:String(process.env.GITHUB_RUN_ID||"local")};
 write(resultPath,{schema:"cop.compute-result/v1",computation_id:request.computation_id,
 source:{repository:request.repository.name,ref:request.repository.ref},
 result:{operation:request.operation.kind,passed:false,error_class:"resource_admission",admission_decision:admission.decision},
 execution_binding:binding,execution_receipt:{schema:"magistral.execution-receipt/v1",binding,status:"refused",terminal:true,
  artifact_refs:[],result_refs:[],log_refs:[],error:"resource_admission_"+admission.decision}});
} else {
 throw Error("unknown_resource_command");
}
