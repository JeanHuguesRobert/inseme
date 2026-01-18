import React from "react";
import { Facebook } from "lucide-react";

export default function FacebookShareButton({ url, quote, className = "" }) {
  const handleShare = (e) => {
    e.preventDefault();

    if (window.FB) {
      window.FB.ui(
        {
          method: "share",
          href: url || window.location.href,
          quote: quote,
        },
        function (response) {}
      );
    } else {
      // Fallback if FB SDK is not loaded
      const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url || window.location.href)}&quote=${encodeURIComponent(quote || "")}`;
      window.open(shareUrl, "facebook-share-dialog", "width=626,height=436");
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-2 px-4 py-2 bg-[#1877F2] text-white font-bold border-2 border-bauhaus-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all ${className}`}
      aria-label="Partager sur Facebook"
    >
      <Facebook size={24} />
      <span>Partager</span>
    </button>
  );
}
