import { defineEdgeFunction } from "../../../../packages/cop-host/src/runtime/edge.js";
import { handleUpload } from "../../../../packages/cop-host/src/runtime/upload.js";

export default defineEdgeFunction(async (request, runtime) => {
  return handleUpload(request, runtime);
});

export const config = { path: "/api/upload" };
