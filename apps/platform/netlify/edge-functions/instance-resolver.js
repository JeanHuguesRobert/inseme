import {
  handleInstanceResolution,
  INSTANCE_RESOLVER_EDGE_CONFIG,
} from "../../../../packages/cop-host/src/runtime/edge.js";

export default async function (request, context) {
  console.log("Before instance resolver");
  const resolutionResponse = await handleInstanceResolution(request, context);
  console.log("After instance resolver");

  if (resolutionResponse instanceof Response) {
    return resolutionResponse;
  }

  return context.next();
}

export const config = INSTANCE_RESOLVER_EDGE_CONFIG;
