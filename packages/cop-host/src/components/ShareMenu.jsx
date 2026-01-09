import { useState, useRef, useEffect } from "react";
import { Icon } from "lucide-react";  
// import { sharePost } from "../../../../apps/platform/src/lib/sharePost"; // Supprimé pour éviter les dépendances circulaires trop lourdes
import { getConfig } from "../client/supabase.js";

/**
 * Enhanced ShareMenu - Mobile-first dropdown for sharing content
 * Supports: Internal gazette sharing, Facebook, Twitter, LinkedIn, Email, Native share
 */
export default function ShareMenu({
  entityType = "post", // "post", "wiki_page", "proposition"
  entityId,
  title,
  url = window.location.href,
  description = "",
  currentUserId,
}) {
  const botName = getConfig("bot_name", "Ophélia");
  const [isOpen, setIsOpen] = useState(false);
  const [showGazetteDialog, setShowGazetteDialog] = useState(false);
  const [showOpheliaModal, setShowOpheliaModal] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Clean URL (replace netlify with lepp.fr if needed)
  // TODO: jhr, should use APP_URL from env
  const cleanUrl = url.includes(".netlify.app")
    ? url.replace(/https?:\/\/[^\/]+\.netlify\.app/, "https://lepp.fr")
    : url;

  const shareText = description || `Découvrez "${title}" sur LePP.fr`;

  async function handleShareToGazette() {
    alert(
      "Fonctionnalité de partage interne désactivée dans ce module autonome."
    );
    setIsOpen(false);
  }

  function handleFacebookShare() {
    if (window.FB) {
      window.FB.ui(
        {
          method: "share",
          href: cleanUrl,
          quote: title,
        },
        function (response) {}
      );
    } else {
      const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(cleanUrl)}&quote=${encodeURIComponent(title)}`;
      window.open(shareUrl, "facebook-share-dialog", "width=626,height=436");
    }
    setIsOpen(false);
  }

  function handleTwitterShare() {
    const text = `${title}\n${shareText}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(cleanUrl)}`;
    window.open(twitterUrl, "twitter-share-dialog", "width=550,height=420");
    setIsOpen(false);
  }

  function handleLinkedInShare() {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(cleanUrl)}`;
    window.open(linkedInUrl, "linkedin-share-dialog", "width=550,height=420");
    setIsOpen(false);
  }

  function handleEmailShare() {
    const subject = encodeURIComponent(`Je partage : ${title}`);
    const body = encodeURIComponent(`${shareText}\n\n${cleanUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setIsOpen(false);
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(cleanUrl);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
    setTimeout(() => setIsOpen(false), 1500);
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: cleanUrl,
        });
        setIsOpen(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    }
  }

  const menuItems = [
    // Internal sharing (only for logged-in users)
    currentUserId && {
      icon: <Icon name="share-2" size={20} />,
      label: "Partager à une Gazette",
      onClick: handleShareToGazette,
      color: "text-primary-500",
    },
    // Share with Ophélia (Logged in users only)
    currentUserId && {
      icon: <Icon name="brain" size={20} />,
      label: `Partager avec ${botName}`,
      onClick: () => {
        setShowOpheliaModal(true);
        setIsOpen(false);
      },
      color: "text-indigo-600",
    },
    // Native share (mobile-first)
    navigator.share && {
      icon: <Icon name="share" size={20} />,
      label: "Partager...",
      onClick: handleNativeShare,
      color: "text-blue-500",
    },
    // Copy link
    {
      icon: <Icon name="link" size={20} />,
      label: copiedFeedback ? "✓ Copié!" : "Copier le lien",
      onClick: handleCopyLink,
      color: copiedFeedback ? "text-green-500" : "text-gray-600",
    },
    // Social platforms
    {
      icon: <Icon name="facebook" size={20} />,
      label: "Facebook",
      onClick: handleFacebookShare,
      color: "text-[#1877F2]",
    },
    {
      icon: <Icon name="x" size={20} />,
      label: "Twitter / X",
      onClick: handleTwitterShare,
      color: "text-gray-900",
    },
    {
      icon: <Icon name="linkedin" size={20} />,
      label: "LinkedIn",
      onClick: handleLinkedInShare,
      color: "text-[#0A66C2]",
    },
    // Email
    {
      icon: <Icon name="mail" size={20} />,
      label: "Email",
      onClick: handleEmailShare,
      color: "text-gray-700",
    },
  ].filter(Boolean); // Remove null items

  return (
    <div className="relative" ref={menuRef}>
      {/* Share Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded transition-colors"
        aria-label="Partager"
      >
        <Icon name="share-2" size={20} />
        <span className="hidden sm:inline">Partager</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border-2 border-gray-900 shadow-xl z-50  overflow-hidden">
          <div className="py-1">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-left"
              >
                <span className={`flex-shrink-0 ${item.color}`}>
                  {typeof item.icon === "string" ? (
                    <span className="text-xl">{item.icon}</span>
                  ) : (
                    item.icon
                  )}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gazette Share Dialog (reuses existing ShareDialog for posts) */}
      {showGazetteDialog && entityType === "post" && (
        <GazetteShareDialog
          entityId={entityId}
          currentUserId={currentUserId}
          onClose={() => setShowGazetteDialog(false)}
        />
      )}

      {/* Feed Ophélia Modal */}
      {showOpheliaModal && (
        <FeedOpheliaModal
          isOpen={showOpheliaModal}
          onClose={() => setShowOpheliaModal(false)}
          entityType={entityType}
          entityId={entityId}
          title={title}
          content={description} // Using description as content for now, might need full content
          url={cleanUrl}
        />
      )}
    </div>
  );
}

// Simple inline gazette dialog for posts
function GazetteShareDialog({ entityId, currentUserId, onClose }) {
  const [gazettes] = useState(["global", "quartiers", "associations"]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    if (!selected) {
      alert("Sélectionnez une gazette");
      return;
    }
    setLoading(true);
    try {
      await sharePost(entityId, { gazette: selected }, { id: currentUserId });
      alert("Partagé avec succès!");
      onClose();
    } catch (err) {
      alert("Erreur: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white  p-6 max-w-sm w-full">
        <h3 className="text-lg font-bold mb-4">Partager à une Gazette</h3>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full border-2 border-gray-300 rounded px-3 py-2 mb-4"
        >
          <option value="">-- Choisir --</option>
          {gazettes.map((g) => (
            <option key={g} value={g}>
              {g === "global" ? "LA GAZETTE (global)" : g}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-gray-300 rounded hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleShare}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? "..." : "Partager"}
          </button>
        </div>
      </div>
    </div>
  );
}
