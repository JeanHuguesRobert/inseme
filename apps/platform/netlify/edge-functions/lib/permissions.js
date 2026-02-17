import {
  getUserRole,
  isAdmin,
  isModerator,
  canWrite,
} from "../../../../packages/cop-host/src/lib/permissions.js";

export default { getUserRole, isAdmin, isModerator, canWrite };
