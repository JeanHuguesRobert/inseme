// src/pages/Social.jsx

import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "@inseme/cop-host";
import { GroupList } from "@inseme/brique-group";
import PostList from "../components/social/PostList";
import { getSupabase } from "../lib/supabase.js";
import { GROUP_TYPES, POST_TYPES } from "../../../../packages/cop-host/src/lib/socialMetadata.js";
import { canWrite } from "@inseme/cop-host";
import SiteFooter from "../components/layout/SiteFooter";
import { MOVEMENT_NAME } from "../constants.js";
import { detectGazetteAssignments } from "../lib/gazetteAssignments.js";

/**
 * Page principale Social - Vue d'ensemble groupes + posts
 */
export default function Social() {
  const { currentUser, userStatus } = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "all"); // all | groups | posts
  const [filterType, setFilterType] = useState(null);
  const gazetteParam = searchParams.get("gazette");
  const [gazettes, setGazettes] = useState([]);
  const [selectedGazette, setSelectedGazette] = useState(gazetteParam || "");
  const linkedTypeParam = searchParams.get("linkedType");
  const linkedIdParam = searchParams.get("linkedId");
  const groupIdParam = searchParams.get("groupId");
  const [contextTitle, setContextTitle] = useState(null);
  const [contextGroup, setContextGroup] = useState(null);
  const [groupMembership, setGroupMembership] = useState({ isMember: false, loading: false });
  const [groupGazettes, setGroupGazettes] = useState([]);
  const searchParamsString = searchParams.toString();
  const isGroupScoped = Boolean(groupIdParam);
  const effectiveGazetteFilter = isGroupScoped ? null : gazetteParam;

  function getGazetteSummary(name) {
    if (!name) return null;
    if (name === "global") {
      return {
        title: "La Gazette",
        description: "Les meilleures contributions sélectionnées par l'équipe du mouvement.",
      };
    }
    return {
      title: `Gazette : ${name}`,
      description: "Actualités et billets rédigés par la communauté.",
    };
  }

  const refreshContext = useCallback(async () => {
    try {
      if (groupIdParam) {
        setContextTitle(null);
        setGroupMembership((prev) => ({ ...prev, loading: true }));
        const { data: group, error: groupError } = await getSupabase()
          .from("groups")
          .select("id,name,description,metadata")
          .eq("id", groupIdParam)
          .single();
        if (groupError) throw groupError;
        setContextGroup(group);
        const gazetteAssignments = await detectGazetteAssignments(group);
        setGroupGazettes(gazetteAssignments);

        if (currentUser?.id) {
          const { data: membershipData, error: membershipError } = await getSupabase()
            .from("group_members")
            .select("user_id")
            .eq("group_id", groupIdParam)
            .eq("user_id", currentUser.id)
            .limit(1);
          if (membershipError) throw membershipError;
          setGroupMembership({ loading: false, isMember: (membershipData || []).length > 0 });
        } else {
          setGroupMembership({ loading: false, isMember: false });
        }
        return;
      }

      setContextGroup(null);
      setGroupGazettes([]);
      setGroupMembership({ loading: false, isMember: false });

      if (linkedTypeParam === "post" && linkedIdParam) {
        const { data } = await getSupabase()
          .from("posts")
          .select("id,title,metadata")
          .eq("id", linkedIdParam)
          .single();
        setContextTitle(data ? data.title || `Article ${data.id}` : null);
      } else if (gazetteParam) {
        setContextTitle(`Gazette ${gazetteParam}`);
      } else {
        setContextTitle(null);
      }
    } catch (err) {
      console.error("Error loading social context:", err);
      if (groupIdParam) {
        setContextGroup(null);
        setGroupGazettes([]);
        setGroupMembership({ loading: false, isMember: false });
      } else {
        setContextTitle(null);
      }
    }
  }, [groupIdParam, currentUser?.id, linkedTypeParam, linkedIdParam, gazetteParam]);

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  useEffect(() => {
    if (isGroupScoped && gazetteParam) {
      const params = new URLSearchParams(searchParamsString);
      params.delete("gazette");
      setSearchParams(params);
    }
  }, [isGroupScoped, gazetteParam, searchParamsString, setSearchParams]);

  useEffect(() => {
    async function loadGazettes() {
      try {
        // Load gazette names from posts metadata
        const { data, error } = await getSupabase()
          .from("posts")
          .select("metadata->>gazette as gazette")
          .not("metadata->>gazette", "is", null)
          .limit(1000);
        if (error) throw error;
        const names = Array.from(new Set((data || []).map((d) => d.gazette).filter(Boolean)));
        // Ensure 'global' is present if not already
        if (!names.includes("global")) names.unshift("global");
        setGazettes(names);
        // sensible default: if no gazette param and 'global' exists, select it by default
        if (!isGroupScoped && !gazetteParam && names.includes("global")) {
          setSelectedGazette("global");
          const params = new URLSearchParams(searchParamsString);
          params.set("gazette", "global");
          setSearchParams(params);
        }
      } catch (err) {
        console.error("Error loading gazette names:", err);
      }
    }
    loadGazettes();
  }, [gazetteParam, isGroupScoped, searchParamsString, setSearchParams]);

  useEffect(() => {
    if (isGroupScoped) {
      setSelectedGazette("");
    } else {
      setSelectedGazette(gazetteParam || "");
    }
  }, [gazetteParam, isGroupScoped]);

  // Keep activeTab in sync with URL query param `tab`
  useEffect(() => {
    const tab = searchParams.get("tab") || "all";
    setActiveTab(tab);
  }, [searchParams]);

  function setTab(tab) {
    setActiveTab(tab);
    // update URL param without removing other params
    const params = new URLSearchParams(searchParams);
    if (tab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    setSearchParams(params);
    // reset filters when switching tabs
    setFilterType(null);
  }

  async function handleJoinGroup() {
    if (!groupIdParam) return;
    if (!currentUser) {
      alert("Vous devez être connecté pour rejoindre un groupe");
      return;
    }
    if (!canWrite(currentUser)) {
      alert("Votre compte ne peut pas publier pour le moment");
      return;
    }
    try {
      const { error } = await getSupabase()
        .from("group_members")
        .insert({
          group_id: groupIdParam,
          user_id: currentUser.id,
          metadata: { schemaVersion: 1 },
        });
      if (error) throw error;
      refreshContext();
    } catch (err) {
      console.error("Error joining group:", err);
      alert("Erreur lors de l'adhésion : " + err.message);
    }
  }

  async function handleLeaveGroup() {
    if (!groupIdParam || !currentUser) return;
    try {
      const { error } = await getSupabase()
        .from("group_members")
        .delete()
        .eq("group_id", groupIdParam)
        .eq("user_id", currentUser.id);
      if (error) throw error;
      refreshContext();
    } catch (err) {
      console.error("Error leaving group:", err);
      alert("Erreur lors de la sortie : " + err.message);
    }
  }

  function handleWritePost() {
    if (!groupIdParam) return;
    navigate(`/posts/new?groupId=${groupIdParam}`);
  }

  const isGroupContextActive = Boolean(contextGroup && isGroupScoped);
  const isGazetteContextActive = Boolean(!isGroupContextActive && gazetteParam);
  const gazetteSummary = isGazetteContextActive ? getGazetteSummary(gazetteParam) : null;

  function handleWriteGazetteArticle() {
    if (!gazetteParam) return;
    if (!currentUser) {
      alert("Vous devez être connecté pour publier");
      return;
    }
    if (!canWrite(currentUser)) {
      alert("Votre compte ne peut pas publier pour le moment");
      return;
    }
    const target = `/posts/new?gazette=${encodeURIComponent(gazetteParam)}`;
    navigate(target);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-5xl font-bold text-gray-100 mb-2 font-brand  tracking-tighter">
          Café {MOVEMENT_NAME}
        </h1>
        <p className="text-gray-400">Forums, blogs, gazettes, quartiers, associations, etc.</p>
      </div>

      {/* Actions */}
      {userStatus === "signed_in" && currentUser && canWrite(currentUser) && (
        <div className="mb-6 flex gap-3">
          <button onClick={() => navigate("/groups/new")} className="btn btn-primary  text-sm">
            + Créer un groupe
          </button>
          <button onClick={() => navigate("/posts/new")} className="btn btn-success  text-sm">
            + Nouvelle publication
          </button>
        </div>
      )}

      {/* Gazette quick link (hidden when scoped to a group) */}
      {!isGroupScoped && (
        <div className="mb-6">
          <Link
            to={
              gazetteParam
                ? gazetteParam === "global"
                  ? "/gazette"
                  : `/gazette/${gazetteParam}`
                : "/gazette"
            }
            className="inline-block btn btn-ghost text-sm"
          >
            📰 La Gazette
          </Link>
          <select
            value={selectedGazette}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedGazette(value);
              const params = new URLSearchParams(searchParams);
              if (!value) {
                params.delete("gazette");
              } else {
                params.set("gazette", value);
              }
              setSearchParams(params);
              if (value) setTab("posts");
            }}
            className="ml-3 inline-block border px-2 py-1"
          >
            <option value="">Toutes</option>
            {gazettes.map((g) => (
              <option key={g} value={g}>
                {g === "global" ? "LA GAZETTE (global)" : g}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <nav className="tabs-nav">
        <button
          onClick={() => setTab("all")}
          className={`tab-item ${activeTab === "all" ? "active" : ""}`}
        >
          Tout
        </button>
        <button
          onClick={() => setTab("groups")}
          className={`tab-item ${activeTab === "groups" ? "active" : ""}`}
        >
          Groupes
        </button>
        <button
          onClick={() => setTab("posts")}
          className={`tab-item ${activeTab === "posts" ? "active" : ""}`}
        >
          Publications
        </button>
      </nav>

      {/* Filters (conditional based on tab) */}
      {activeTab === "groups" && (
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterType(null)}
              className={`filter-chip ${filterType === null ? "active" : ""}`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterType(GROUP_TYPES.NEIGHBORHOOD)}
              className={`filter-chip filter-chip--blue ${filterType === GROUP_TYPES.NEIGHBORHOOD ? "active" : ""}`}
            >
              🏘️ Quartiers
            </button>
            <button
              onClick={() => setFilterType(GROUP_TYPES.ASSOCIATION)}
              className={`filter-chip filter-chip--yellow ${filterType === GROUP_TYPES.ASSOCIATION ? "active" : ""}`}
            >
              🤝 Associations
            </button>
            <button
              onClick={() => setFilterType(GROUP_TYPES.FORUM)}
              className={`filter-chip ${filterType === GROUP_TYPES.FORUM ? "active" : ""}`}
            >
              💬 Forums
            </button>
            <button
              onClick={() => setFilterType(GROUP_TYPES.GAZETTE)}
              className={`filter-chip ${filterType === GROUP_TYPES.GAZETTE ? "active" : ""}`}
            >
              📰 Gazettes
            </button>
          </div>
        </div>
      )}

      {activeTab === "posts" && (
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterType(null)}
              className={`filter-chip ${filterType === null ? "active" : ""}`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterType(POST_TYPES.BLOG)}
              className={`filter-chip ${filterType === POST_TYPES.BLOG ? "active" : ""}`}
            >
              📝 Blogs
            </button>
            <button
              onClick={() => setFilterType(POST_TYPES.FORUM)}
              className={`filter-chip filter-chip--yellow ${filterType === POST_TYPES.FORUM ? "active" : ""}`}
            >
              💬 Discussions
            </button>
            <button
              onClick={() => setFilterType(POST_TYPES.ANNOUNCEMENT)}
              className={`filter-chip ${filterType === POST_TYPES.ANNOUNCEMENT ? "active" : ""}`}
            >
              📢 Annonces
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {isGroupContextActive ? (
        <div className="mb-6 theme-card p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-primary-300 mb-2">
                Groupe focalisé
              </p>
              <h2 className="text-2xl font-semibold text-gray-100">{contextGroup.name}</h2>
              {contextGroup.description && (
                <p className="text-gray-400 mt-2 text-sm leading-relaxed line-clamp-3">
                  {contextGroup.description}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 min-w-[220px]">
              {!groupMembership.isMember ? (
                <button
                  onClick={handleJoinGroup}
                  disabled={groupMembership.loading}
                  className="btn btn-primary text-sm disabled:opacity-60"
                >
                  Rejoindre le groupe
                </button>
              ) : (
                <button
                  onClick={handleLeaveGroup}
                  disabled={groupMembership.loading}
                  className="btn btn-ghost text-sm border"
                >
                  Quitter le groupe
                </button>
              )}
              {groupMembership.isMember && currentUser && canWrite(currentUser) && (
                <button onClick={handleWritePost} className="btn btn-success text-sm">
                  ✍️ Écrire dans ce groupe
                </button>
              )}
              <Link
                to={`/groups/${groupIdParam}`}
                className="btn btn-secondary text-sm text-center"
              >
                Voir le groupe
              </Link>
            </div>
          </div>
        </div>
      ) : isGazetteContextActive && gazetteSummary ? (
        <div className="mb-6 theme-card p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-primary-300 mb-2">Gazette</p>
              <h2 className="text-2xl font-semibold text-gray-100">{gazetteSummary.title}</h2>
              <p className="text-gray-400 mt-2 text-sm leading-relaxed">
                {gazetteSummary.description}
              </p>
            </div>
            <div className="flex flex-col gap-2 min-w-[220px]">
              <Link
                to={gazetteParam === "global" ? "/gazette" : `/gazette/${gazetteParam}`}
                className="btn btn-primary text-sm text-center"
              >
                📰 Ouvrir la Gazette
              </Link>
              {currentUser && canWrite(currentUser) && (
                <button onClick={handleWriteGazetteArticle} className="btn btn-success text-sm">
                  ✍️ Proposer un article
                </button>
              )}
              <Link to="/gazette" className="btn btn-ghost text-sm border text-center">
                Voir toutes les Gazettes
              </Link>
            </div>
          </div>
        </div>
      ) : (
        contextTitle && (
          <div className="mb-6 theme-card p-4 text-sm">
            <strong>Contexte : </strong> {contextTitle}
            {linkedTypeParam === "post" && linkedIdParam && (
              <Link className="ml-3 text-primary hover:underline" to={`/posts/${linkedIdParam}`}>
                Voir l'article
              </Link>
            )}
            {gazetteParam && (
              <Link
                className="ml-3 text-primary hover:underline"
                to={gazetteParam === "global" ? "/gazette" : `/gazette/${gazetteParam}`}
              >
                Voir la Gazette
              </Link>
            )}
          </div>
        )
      )}
      <div>
        {activeTab === "all" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-between text-gray-100">
                <span>Groupes</span>
                <Link
                  to="/social?tab=groups"
                  className="text-sm text-primary hover:underline font-normal"
                >
                  Voir tout →
                </Link>
              </h2>
              <GroupList currentUserId={currentUser?.id} gazette={selectedGazette} />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-between text-gray-100">
                <span>Publications récentes</span>
                <Link
                  to="/social?tab=posts"
                  className="text-sm text-primary hover:underline font-normal"
                >
                  Voir tout →
                </Link>
              </h2>
              <PostList
                currentUserId={currentUser?.id}
                tag={searchParams.get("tag")}
                gazette={effectiveGazetteFilter}
                linkedType={linkedTypeParam}
                linkedId={linkedIdParam}
                groupId={groupIdParam}
                relatedGazettes={groupGazettes}
              />
            </div>
          </div>
        )}

        {activeTab === "groups" && (
          <GroupList
            filterType={filterType}
            currentUserId={currentUser?.id}
            gazette={selectedGazette}
          />
        )}

        {activeTab === "posts" && (
          <PostList
            postType={filterType}
            currentUserId={currentUser?.id}
            tag={searchParams.get("tag")}
            gazette={effectiveGazetteFilter}
            linkedType={linkedTypeParam}
            linkedId={linkedIdParam}
            groupId={groupIdParam}
            relatedGazettes={groupGazettes}
          />
        )}
      </div>

      <div className="mt-12">
        <SiteFooter />
      </div>
    </div>
  );
}
