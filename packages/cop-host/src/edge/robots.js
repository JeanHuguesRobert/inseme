import { defineEdgeFunction } from "../runtime/edge.js";
import { handleRobotsTxt } from "../runtime/robots.js";

export default defineEdgeFunction(async (request, runtime) => {
  return handleRobotsTxt(request);
});
