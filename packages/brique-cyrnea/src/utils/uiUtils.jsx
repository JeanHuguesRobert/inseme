/**
 * Fonctions utilitaires pour le traitement des liens
 */

/**
 * Normalise un lien public en ajoutant les protocoles et formatant les URLs
 */
export const normalizePublicLink = (link) => {
  if (!link) return link;
  const label = typeof link.label === "string" ? link.label.trim() : "";
  let url = typeof link.url === "string" ? link.url.trim() : "";
  if (!url) return { ...link, label, url };

  const lowerUrl = url.toLowerCase();
  const lowerLabel = label.toLowerCase();

  const isFacebook =
    lowerLabel.includes("facebook") ||
    lowerLabel === "fb" ||
    lowerUrl.includes("facebook.com") ||
    lowerUrl.includes("fb.com");
  const isInstagram =
    lowerLabel.includes("instagram") ||
    lowerLabel.includes("insta") ||
    lowerUrl.includes("instagram.com");

  if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
    const looksLikeEmail =
      lowerUrl.includes("@") && !lowerUrl.includes(" ") && !lowerUrl.startsWith("mailto:");
    const digits = url.replace(/[\s().-]/g, "").replace(/^\+/, "");
    const looksLikePhone =
      !lowerUrl.startsWith("tel:") && digits.length >= 6 && /^\d+$/.test(digits);

    if (looksLikeEmail) {
      url = `mailto:${url}`;
      return {
        ...link,
        label: label || "Email",
        url,
      };
    }

    if (looksLikePhone) {
      const compact = url.replace(/\s+/g, "");
      url = `tel:${compact}`;
      return {
        ...link,
        label: label || "Téléphone",
        url,
      };
    }

    if (isFacebook) {
      const handle = url
        .replace(/^@/, "")
        .replace(/^facebook\.com\//i, "")
        .replace(/^fb\.com\//i, "")
        .replace(/^www\.facebook\.com\//i, "");
      url = `https://www.facebook.com/${handle}`;
      return {
        ...link,
        label: label || "Facebook",
        url,
      };
    }

    if (isInstagram) {
      const handle = url
        .replace(/^@/, "")
        .replace(/^instagram\.com\//i, "")
        .replace(/^www\.instagram\.com\//i, "");
      const stripped = handle.replace(/\/+$/, "");
      url = `https://www.instagram.com/${stripped}/`;
      return {
        ...link,
        label: label || "Instagram",
        url,
      };
    }

    if (/[a-z0-9-]+\.[a-z]{2,}/.test(lowerUrl)) {
      url = `https://${url}`;
      return {
        ...link,
        label,
        url,
      };
    }

    return { ...link, label, url };
  }

  if (isFacebook) {
    url = url
      .replace(/^https?:\/\/facebook\.com\//i, "https://www.facebook.com/")
      .replace(/^https?:\/\/m\.facebook\.com\//i, "https://www.facebook.com/")
      .replace(/^https?:\/\/fb\.com\//i, "https://www.facebook.com/");
    return {
      ...link,
      label: label || "Facebook",
      url,
    };
  }

  if (isInstagram) {
    url = url
      .replace(/^https?:\/\/instagram\.com\//i, "https://www.instagram.com/")
      .replace(/^https?:\/\/www\.instagram\.com\//i, "https://www.instagram.com/");
    if (!url.endsWith("/")) {
      url = `${url}/`;
    }
    return {
      ...link,
      label: label || "Instagram",
      url,
    };
  }

  return { ...link, label, url };
};

/**
 * Composants UI Mondrian de base
 */
export const MondrianTabTrigger = ({ isActive, onClick, color, icon: Icon, label }) => {
  const colorClasses = {
    white: "bg-white",
    yellow: "bg-mondrian-yellow",
    blue: "bg-mondrian-blue",
    red: "bg-mondrian-red",
  };

  return (
    <button
      type="button"
      className={`
        ${isActive ? colorClasses[color] || "bg-white" : "bg-white"}
        flex flex-col items-center justify-center p-4 transition-all duration-300
        ${isActive ? "flex-1" : "hover:bg-black hover:text-white"}
        border-t-8 border-x-4 border-b-0 border-black
        active:bg-black active:text-white
        focus:outline-none
      `}
      onClick={onClick}
      style={{ pointerEvents: "auto" }}
    >
      {typeof Icon === "function" ? (
        <Icon
          className={`w-8 h-8 mb-2 ${isActive ? "scale-110" : "opacity-100"}`}
          strokeWidth={isActive ? 3 : 2}
        />
      ) : (
        <Icon
          className={`w-8 h-8 mb-2 ${isActive ? "scale-110" : "opacity-100"}`}
          strokeWidth={isActive ? 3 : 2}
        />
      )}
      <span className="font-black text-[10px] md:text-xs tracking-widest">{label}</span>
    </button>
  );
};

export const MondrianBlock = ({ color, className, children }) => {
  const colorClasses = {
    white: "bg-white",
    yellow: "bg-mondrian-yellow",
    blue: "bg-mondrian-blue",
    red: "bg-mondrian-red",
  };

  return <div className={`${colorClasses[color] || "bg-white"} ${className}`}>{children}</div>;
};
