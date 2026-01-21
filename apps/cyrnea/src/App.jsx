import { useEffect, useState } from "react";
import { Routes, Route, useLocation, useParams } from "react-router-dom";
import BarmanDashboard from "@inseme/brique-cyrnea/pages/BarmanDashboard";
import ClientMiniApp from "@inseme/brique-cyrnea/pages/ClientMiniApp";
import VocalConversation from "@inseme/brique-cyrnea/pages/VocalConversation";
import RadioView from "@inseme/brique-cyrnea/pages/RadioView";
import LegalPage from "./pages/LegalPage";
import { useCurrentUser, isDeleted } from "@inseme/cop-host";
import { InsemeProvider } from "@inseme/room";
import { getSupabase } from "@inseme/cop-host/client/supabase.js";

function App() {
  const { currentUser: user } = useCurrentUser();
  const location = useLocation();
  const route = location.pathname;
  const supabase = getSupabase();

  const roomId = getRoomIdFromPath(route);

  return (
    <InsemeProvider
      roomName={roomId}
      user={user}
      supabase={supabase}
      config={{
        enableSemantic: true,
        defaultSessionStatus: "open",
        showLifecycleOverlay: false,
      }}
    >
      <Routes>
        <Route path="/bar/:roomId" element={<BarmanDashboard roomId={roomId} />} />
        <Route path="/vocal/:roomId" element={<VocalConversation />} />
        <Route path="/radio/:roomId" element={<RadioView />} />
        <Route path="/gazette" element={<GazetteView />} />
        <Route path="/gazette/:name" element={<GazetteView />} />
        <Route path="/legal/terms" element={<LegalPage type="terms" />} />
        <Route path="/legal/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/app/:roomId" element={<ClientMiniApp roomId={roomId} />} />
        <Route path="*" element={<ClientMiniApp roomId={roomId} />} />
      </Routes>
    </InsemeProvider>
  );
}

function getRoomIdFromPath(pathname) {
  const parts = pathname.split("/");
  if (
    parts.length >= 3 &&
    (parts[1] === "bar" || parts[1] === "app" || parts[1] === "vocal" || parts[1] === "radio")
  ) {
    return parts[2] || "cyrnea";
  }
  return "cyrnea";
}

function GazetteView() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { name } = useParams();
  const gazetteName = name || "global";
  const supabase = getSupabase();

  useEffect(() => {
    let isMounted = true;

    async function loadGazette() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .ilike("metadata->>gazette", gazetteName)
          .order("created_at", { ascending: false })
          .limit(20);

        if (!isMounted) return;

        if (error) {
          console.error("Error loading gazette posts:", error);
          setPosts([]);
        } else {
          const activePosts = (data || []).filter((p) => !isDeleted(p));
          setPosts(activePosts);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Unexpected error loading gazette posts:", err);
        setPosts([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadGazette();

    return () => {
      isMounted = false;
    };
  }, [gazetteName, supabase]);

  const title = gazetteName === "global" ? "LA GAZETTE" : `GAZETTE ${gazetteName.toUpperCase()}`;

  return (
    <div className="min-h-screen bg-[#f4e4bc] text-[#2c241b] px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-8 border-b border-[#d4c49c] pb-4">
          <h1 className="text-3xl font-black tracking-[0.25em] uppercase mb-2">{title}</h1>
          <p className="text-xs uppercase tracking-[0.18em] opacity-70">
            Journal du bar et de la commune
          </p>
        </header>

        {loading ? (
          <div className="text-center text-sm italic">Chargement des nouvelles...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-sm italic">Aucun article publié pour cette gazette.</div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article key={post.id} className="border-b border-[#d4c49c] pb-6 last:border-0">
                {post.title && (
                  <h2 className="text-xl font-bold mb-2 leading-snug">{post.title}</h2>
                )}
                <div className="text-[10px] uppercase tracking-wide opacity-60 mb-3">
                  {new Date(post.created_at).toLocaleString("fr-FR")}
                </div>
                {post.content && (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
