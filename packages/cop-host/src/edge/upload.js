import { defineEdgeFunction } from "../runtime/edge.js";
import { handleUpload } from "../runtime/upload.js";

export default defineEdgeFunction(async (request, runtime) => {
  return handleUpload(request, runtime);
});
