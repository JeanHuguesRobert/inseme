//
//
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase.js";
import { AuthModal } from "@inseme/room";
import { InsemeRoom, InsemeProvider } from "@inseme/room";
import { SaaSDashboard } from "./components/SaaS/SaaSDashboard";
import { LandingPage } from "./components/SaaS/LandingPage";
import { LegalPage } from "@inseme/ui";
import { LEGAL_PATHS } from "@inseme/brique-kudocracy";
import { LogOut, UserCheck } from "lucide-react";
import { CurrentUserProvider, useCurrentUser } from "@inseme/cop-host";

function AppContent() {
  const { currentUser: user, loading } = useCurrentUser();
  const [roomName, setRoomName] = useState("Général");
  const [showAuth, setShowAuth] = useState(false);
  const [view, setView] = useState("landing"); // 'landing', 'dashboard', 'participation', 'terms', 'privacy'
  const [isSpectator, setIsSpectator] = useState(false);
  const [showGuestReconnect, setShowGuestReconnect] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState(null);

  useEffect(() => {
    const handleOpenAuth = (e) => {
      if (e?.detail?.mode) {
        setAuthInitialMode(e.detail.mode);
      }
      setShowAuth(true);
    };
    const handleStopSpectating = () => setIsSpectator(false);
    window.addEventListener("inseme-open-auth", handleOpenAuth);
    window.addEventListener("inseme-stop-spectating", handleStopSpectating);

    // Determine initial view based on user status
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");

    if (user?.is_anonymous) {
      setShowGuestReconnect(true);
    }

    if (room) {
      setRoomName(room);
      setView("participation");
      setIsSpectator(!user);
    } else if (user) {
      setRoomName("Général");
      setView("dashboard");
    } else if (!loading) {
      setRoomName("Général");
      setView("landing");
    }

    return () => {
      window.removeEventListener("inseme-open-auth", handleOpenAuth);
      window.removeEventListener("inseme-stop-spectating", handleStopSpectating);
    };
  }, [user, loading]);

  // Sync view on auth events
  useEffect(() => {
    if (user) {
      setIsSpectator(false);
      if (view === "landing") {
        if (user.is_anonymous) {
          setView("participation");
        } else {
          setView("dashboard");
        }
      }
    } else if (!loading && view !== "landing") {
      setView("landing");
      setIsSpectator(false);
    }
  }, [user, loading, view]);

  if (loading) return null;

  const handleAuthSuccess = () => {
    setShowAuth(false);
  };

  return (
    <InsemeProvider roomName={roomName} user={user} supabase={supabase} isSpectator={isSpectator}>
      <div className="min-h-screen bg-[#0A0A0B] text-white selection:bg-emerald-500/30">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0B]/80 backdrop-blur-md border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => setView("landing")}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20 group-hover:border-emerald-500/40 transition-colors">
                  <div className="w-4 h-4 rounded-sm bg-emerald-500" />
                </div>
                <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                  Inseme
                </span>
              </div>

              <div className="flex items-center gap-4">
                {user ? (
                  <>
                    <button
                      onClick={() => setView("dashboard")}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        view === "dashboard"
                          ? "bg-white/10 text-white"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      Dashboard
                    </button>
                    <button
                      onClick={() => supabase.auth.signOut()}
                      className="p-2 rounded-full text-white/40 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                      title="Déconnexion"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowAuth(true)}
                    className="px-6 py-2 rounded-full bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 transition-all"
                  >
                    Connexion
                  </button>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="pt-16">
          {view === "landing" && (
            <LandingPage
              onStart={() => {
                if (user) setView("dashboard");
                else setShowAuth(true);
              }}
              onParticipate={() => {
                setRoomName("Général");
                setView("participation");
              }}
            />
          )}

          {view === "dashboard" && user && (
            <SaaSDashboard
              user={user}
              onJoinRoom={(name) => {
                setRoomName(name);
                setView("participation");
              }}
            />
          )}

          {view === "participation" && (
            <InsemeRoom
              roomName={roomName}
              user={user}
              supabase={supabase}
              isSpectator={isSpectator}
              onBack={() => setView(user ? "dashboard" : "landing")}
            />
          )}

          {(view === "terms" || view === "privacy") && (
            <div className="max-w-4xl mx-auto px-4 py-12">
              <button
                onClick={() => setView("landing")}
                className="mb-8 text-emerald-500 hover:text-emerald-400 flex items-center gap-2"
              >
                ← Retour à l'accueil
              </button>
              <LegalPage
                title={
                  view === "terms" ? "Conditions d'utilisation" : "Politique de confidentialité"
                }
                url={view === "terms" ? LEGAL_PATHS.TERMS_OF_USE : LEGAL_PATHS.PRIVACY_POLICY}
              />
            </div>
          )}
        </main>

        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
          initialMode={authInitialMode}
        />

        {/* Reconnect Prompt for Guests */}
        {showGuestReconnect && !user && view === "participation" && (
          <div className="fixed bottom-6 right-6 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#161618] border border-white/10 p-4 rounded-2xl shadow-2xl max-w-xs backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Bon retour !</h4>
                  <p className="text-xs text-white/40">Session invité détectée</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowGuestReconnect(false);
                  setShowAuth(true);
                }}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all"
              >
                Reprendre ma session
              </button>
            </div>
          </div>
        )}
      </div>
    </InsemeProvider>
  );
}

function App() {
  return (
    <CurrentUserProvider>
      <AppContent />
    </CurrentUserProvider>
  );
}

export default App;
