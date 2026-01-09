import React from "react";
import { getConfig } from "../../../cop-host/src/config/instanceConfig.client.js";

export default function Header({
  botName = "Ophélia",
  welcomeMessage = "Bonjour !",
  isMobile = false,
  user = null,
  onSignIn = () => {},
  onSignOut = () => {},
}) {
  const facebookPageUrl = getConfig("facebook_page_url");

  return (
    <div className={`chat-header ${isMobile ? "mobile" : ""}`}>
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center">
          <div className="chat-avatar">🤖</div>
          <div className="chat-info">
            <div className="chat-title">{botName}</div>
            {!isMobile && <div className="chat-subtitle">{welcomeMessage}</div>}
          </div>
        </div>
        {facebookPageUrl && (
          <a
            href={facebookPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#1877f2] text-white hover:bg-[#166fe5] transition-colors"
            title="Visitez notre page Facebook"
          >
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            {!isMobile && <span>Facebook</span>}
          </a>
        )}
      </div>
    </div>
  );
}
