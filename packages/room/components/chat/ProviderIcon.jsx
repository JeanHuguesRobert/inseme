import React from "react";

// Small, decorative SVG icons for known providers.
// Keep shapes simple so they render well at small sizes and inherit color.
export default function ProviderIcon({ provider, size = 16 }) {
  const s = Number(size) || 16;
  const common = {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch ((provider || "").toLowerCase()) {
    case "openai":
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path
            d="M7 12c1-3 5-5 9-3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "huggingface":
      return (
        <svg {...common} aria-hidden>
          <rect
            x="3"
            y="6"
            width="18"
            height="12"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
          />
          <path
            d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "mistral":
      return (
        <svg {...common} aria-hidden>
          <path
            d="M3 18c4-8 10-12 18-14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case "anthropic":
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path
            d="M5 20c3-6 9-8 14-7"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case "grok":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="M8 10h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "gemini":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M12 4v16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common} aria-hidden>
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      );
  }
}
