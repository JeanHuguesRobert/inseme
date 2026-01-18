import React from "react";

/**
 * IframeViewer - Display target website in an iframe
 * @param {string} url - URL to display
 */
export function IframeViewer({ url }) {
  if (!url) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Aucune URL spécifiée</p>
          <p className="text-sm">Entrez une URL pour commencer la collecte</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative bg-white">
      <iframe
        src={window.wrap ? window.wrap(url) : url}
        className="w-full h-full border-0"
        title="Site Web à analyser"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
}

export default IframeViewer;
