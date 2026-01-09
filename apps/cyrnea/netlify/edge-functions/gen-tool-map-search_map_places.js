// GENERATED AUTOMATICALLY BY COP-HOST COMPILER
import { defineEdgeFunction } from "../../../../packages/cop-host/src/runtime/edge.js";
import handler from "../../../../packages/brique-map/src/edge/tool-search-map.js";

// Tool wrappers always use defineEdgeFunction for consistent runtime access
export default defineEdgeFunction(async (runtime, args) => {
  return await handler(runtime, args);
});

export const config = {
  path: "/api/tools/map/search_map_places"
};
