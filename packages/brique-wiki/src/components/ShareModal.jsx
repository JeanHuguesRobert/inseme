import React, { useState, useEffect } from "react";

const SHARE_DESTINATIONS = ["Facebook", "X/Twitter", "Instagram", "LinkedIn", "Email", "Autre"];

const ShareModal = ({ isOpen, onClose, pageTitle, pageUrl, pageContent }) => {
  const [shareText, setShareText] = useState(
    `Découvrez la page "${pageTitle}" sur le Wiki de la consultation citoyenne: ${pageUrl}`
  );
  const [selectedDestinations, setSelectedDestinations] = useState(SHARE_DESTINATIONS[0]);
  const [loadingBob, setLoadingBob] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setShareText(
        `Découvrez la page "${pageTitle}" sur le Wiki de la consultation citoyenne: ${pageUrl}`
      );
      setSelectedDestinations(SHARE_DESTINATIONS[0]);
      setFeedbackMessage(null); // Réinitialiser le message de feedback à l'ouverture
    }
  }, [isOpen, pageTitle, pageUrl]);

  const handleDestinationChange = (e) => {
    setSelectedDestinations(e.target.value);
  };

  const handleGenerateTextWithBob = async () => {
    setLoadingBob(true);
    try {
      const response = await fetch("/api/generateShareText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pageTitle,
          pageUrl,
          pageContent,
          selectedDestinations,
          currentShareText: shareText,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setShareText(data.generatedText);
      } else {
        console.error("Erreur lors de la génération du texte par IA:", data.error);
        alert("Erreur lors de la génération du texte par IA.");
      }
    } catch (error) {
      console.error("Erreur réseau lors de la génération du texte par IA:", error);
      alert("Erreur réseau lors de la génération du texte par IA.");
    } finally {
      setLoadingBob(false);
    }
  };

  const handleShare = () => {
    let finalShareText = shareText;
    let finalPageUrl = pageUrl;

    // Substitution de l'adresse Netlify par LePP.fr
    if (finalPageUrl.includes(".netlify.app")) {
      finalPageUrl = finalPageUrl.replace(/https?:\/\/[^/]+\.netlify\.app/, "https://lepp.fr");
      finalShareText = finalShareText.replace(/https?:\/\/[^/]+\.netlify\.app/, "https://lepp.fr");
    }

    if (navigator.share) {
      navigator
        .share({
          title: pageTitle,
          text: finalShareText,
          url: finalPageUrl,
        })
        .catch((error) => console.error("Erreur de partage:", error));
    } else {
      navigator.clipboard
        .writeText(finalShareText)
        .then(() => {
          setFeedbackMessage("Lien de partage copié dans le presse-papiers !");
          setTimeout(() => setFeedbackMessage(null), 3000);
        })
        .catch((err) => {
          console.error("Erreur lors de la copie:", err);
          setFeedbackMessage("Erreur lors de la copie du lien.");
          setTimeout(() => setFeedbackMessage(null), 3000);
        });
    }
    onClose();
  };

  const handleCopyText = () => {
    navigator.clipboard
      .writeText(shareText)
      .then(() => {
        setFeedbackMessage("Texte copié dans le presse-papiers !");
        setTimeout(() => setFeedbackMessage(null), 3000);
      })
      .catch((err) => {
        console.error("Erreur lors de la copie:", err);
        setFeedbackMessage("Impossible de copier le texte.");
        setTimeout(() => setFeedbackMessage(null), 3000);
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
      <div className=" p-8   shadow-xl max-w-md w-full m-4">
        <h2 className="text-2xl font-bold mb-4">Partager la page Wiki</h2>
        {feedbackMessage && (
          <div
            className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 relative mb-4"
            role="alert"
          >
            <span className="block sm:inline">{feedbackMessage}</span>
          </div>
        )}
        <div className="mb-4">
          <label htmlFor="shareText" className="block text-gray-200 text-sm font-bold mb-2">
            Texte à partager:
          </label>
          <textarea
            id="shareText"
            className="shadow appearance-none border w-full py-2 px-3 text-gray-200 leading-tight focus:outline-none focus:shadow-outline"
            rows="5"
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
          ></textarea>
        </div>

        <div className="mb-4">
          <label className="block text-gray-200 text-sm font-bold mb-2">Destinations:</label>
          <div className="flex flex-wrap gap-2">
            {SHARE_DESTINATIONS.map((destination) => (
              <label key={destination} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="shareDestination"
                  value={destination}
                  checked={selectedDestinations === destination}
                  onChange={handleDestinationChange}
                  className="form-radio text-blue-600"
                />
                <span>{destination}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <button
            onClick={handleGenerateTextWithBob}
            className="bg-green-500 hover:bg-green-700 text-bauhaus-white font-bold py-2 px-4 focus:outline-none focus:shadow-outline"
            disabled={loadingBob}
          >
            {loadingBob ? "Génération..." : "IA"}
          </button>
          <button
            onClick={handleCopyText}
            className="bg-gray-500 hover:bg-gray-700 text-bauhaus-white font-bold py-2 px-4 focus:outline-none focus:shadow-outline"
          >
            Copier le texte
          </button>
          <button
            onClick={handleShare}
            className="bg-blue-500 hover:bg-blue-700 text-bauhaus-white font-bold py-2 px-4 focus:outline-none focus:shadow-outline"
          >
            Partager
          </button>
        </div>

        <button
          onClick={onClose}
          className="bg-gray-500 hover:bg-gray-700 text-bauhaus-white font-bold py-2 px-4 focus:outline-none focus:shadow-outline w-full"
        >
          Annuler
        </button>
      </div>
    </div>
  );
};

export default ShareModal;
