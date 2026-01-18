import { defineEdgeFunction } from "../../../../packages/cop-host/src/runtime/edge.js";
import { handleRobotsTxt } from "../../../../packages/cop-host/src/runtime/robots.js";

export default defineEdgeFunction(async (request, runtime) => {
  return handleRobotsTxt(request);
});
