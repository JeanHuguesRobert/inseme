import { useCurrentUser } from "@inseme/cop-host";
import { GroupDetail } from "@inseme/brique-group";

/**
 * Page détail d'un groupe
 */
export default function GroupPage() {
  const { currentUser, userStatus } = useCurrentUser();

  // If you want to add auth-required UI, you can use userStatus here
  return <GroupDetail currentUser={currentUser} />;
}
