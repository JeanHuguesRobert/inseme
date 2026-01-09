import React, { useEffect } from "react";
import { useSocialAvatar } from "../hooks/useSocialAvatar.js";

export default function SocialAvatarButton({ provider, label, userId, onAvatarSuccess }) {
  const { avatarUrl, loading, error, start, completeIfCallback } = useSocialAvatar(provider);

  useEffect(() => {
    if (userId) {
      completeIfCallback(userId).then((url) => {
        if (url && onAvatarSuccess) {
          onAvatarSuccess(url);
        }
      });
    }
  }, [userId]); // Run once on mount/userId availability

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className={`px-4 py-2 text-white font-semibold transition-colors flex items-center gap-2 ${
          provider === "github"
            ? "bg-gray-800 hover:bg-gray-900"
            : provider === "facebook"
              ? "bg-[#1877F2] hover:brightness-90"
              : "bg-red-600 hover:bg-red-700"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {loading ? "Chargement..." : `Utiliser mon avatar ${label}`}
      </button>

      {error && <span className="text-red-500 text-xs">{error}</span>}

      {/* Preview is handled by parent usually, but we can show it here if needed for debug */}
      {/* {avatarUrl && (
        <div className="mt-2">
          <img src={avatarUrl} alt={`${label} Avatar`} width={64} height={64} className="rounded-full" />
        </div>
      )} */}
    </div>
  );
}
