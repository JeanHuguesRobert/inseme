import { useCurrentUser } from "@inseme/cop-host";
import { OpheliaChat as ChatWindow } from "@inseme/brique-ophelia";

function App() {
  const { currentUser, userStatus } = useCurrentUser();

  // If you want to add auth-required UI, you can use userStatus here
  return (
    <div className="App">
      {
        // jhr
        currentUser?.is_admin ? (
          "Pour l'instant la modération est manuelle, via l'UI de Supabase"
        ) : (
          <ChatWindow useV2={true} user={currentUser} />
        )
      }
    </div>
  );
  // <AdminDashboard user={user} />
}

export default App;
