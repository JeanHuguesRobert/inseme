import {
  handleInstanceResolution,
  INSTANCE_RESOLVER_EDGE_CONFIG,
} from "../../../../packages/cop-host/src/runtime/edge.js";

export default async function (request, context) {
  const resolutionResponse = await handleInstanceResolution(request, context);

  if (resolutionResponse instanceof Response) {
    return resolutionResponse;
  }

  return await context.next();
}

export const config = INSTANCE_RESOLVER_EDGE_CONFIG;
