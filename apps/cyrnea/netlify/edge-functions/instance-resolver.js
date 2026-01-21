import {
  handleInstanceResolution,
  INSTANCE_RESOLVER_EDGE_CONFIG,
} from "../../../../packages/cop-host/src/runtime/edge.js";
import { checkAndWarn } from "../../../../packages/cop-host/src/utils/tunnel-connectivity.js";

export default async function (request, context) {
  console.log("Before instance resolver");

  // Self-check for proxy connectivity on cold start (Deno version)
  await checkAndWarn();

  const resolutionResponse = await handleInstanceResolution(request, context);
  console.log("After instance resolver");

  if (resolutionResponse instanceof Response) {
    return resolutionResponse;
  }

  console.log("Instance resolver did not return a response");
  return; // vs context.next();
}

// export const config = INSTANCE_RESOLVER_EDGE_CONFIG;
