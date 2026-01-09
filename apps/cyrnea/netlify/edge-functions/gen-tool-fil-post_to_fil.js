// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import { defineEdgeFunction } from "../../../../packages/cop-host/src/runtime/edge.js";
import handler from "../../../../packages/brique-fil/src/edge/tool-post-to-fil.js";

// Tool wrappers always use defineEdgeFunction for consistent runtime access
export default defineEdgeFunction(async (runtime, args) => {
  return await handler(runtime, args);
});

export const config = {
  path: "/api/tools/fil/post_to_fil"
};
