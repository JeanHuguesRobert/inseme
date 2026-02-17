import React, { useState } from "react";
import { AdvancedTalkButton } from "./AdvancedTalkButton";

export function VocalDemo() {
  const [transcriptions, setTranscriptions] = useState([]);
  const [currentMode, setCurrentMode] = useState("free");
  const [apiKey, setApiKey] = useState("");

  const handleTranscription = (text) => {
    setTranscriptions((prev) => [
      ...prev,
      {
        text,
        timestamp: new Date().toLocaleTimeString(),
        mode: currentMode,
      },
    ]);
  };

  const handleError = (error) => {
    console.error("Vocal error:", error);
    alert(`Erreur: ${error.message}`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🎤 Démo Voice Transcription</h1>

      {/* Mode Selection */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <h2 className="font-semibold mb-3">Mode de transcription:</h2>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="free"
              checked={currentMode === "free"}
              onChange={(e) => setCurrentMode(e.target.value)}
            />
            <span>FREE (Web Speech API)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="pro"
              checked={currentMode === "pro"}
              onChange={(e) => setCurrentMode(e.target.value)}
            />
            <span>PRO (Whisper API)</span>
          </label>
        </div>

        {currentMode === "pro" && (
          <div className="mt-3">
            <input
              type="password"
              placeholder="Clé API OpenAI (sk-...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <p className="text-xs text-gray-600 mt-1">
              Requis pour le mode PRO (Whisper API d'OpenAI)
            </p>
          </div>
        )}
      </div>

      {/* Advanced Talk Button */}
      <div className="mb-6 flex justify-center">
        <AdvancedTalkButton
          mode={currentMode}
          apiKey={apiKey}
          onTranscription={handleTranscription}
          onError={handleError}
          size="lg"
          language="fr-FR"
        />
      </div>

      {/* Transcriptions List */}
      <div className="space-y-3">
        <h2 className="font-semibold">Transcriptions:</h2>
        {transcriptions.length === 0 ? (
          <p className="text-gray-500 italic">Aucune transcription pour le moment...</p>
        ) : (
          transcriptions.map((item, index) => (
            <div key={index} className="p-3 bg-white border rounded-lg shadow-sm">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs text-gray-500">{item.timestamp}</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    item.mode === "free"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {item.mode.toUpperCase()}
                </span>
              </div>
              <p className="text-gray-800">{item.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-2">📖 Instructions:</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>
            • <strong>Bouton START</strong>: Commence l'enregistrement (mode continu)
          </li>
          <li>
            • <strong>Bouton STOP</strong>: Arrête manuellement l'enregistrement
          </li>
          <li>
            • <strong>Bouton PUSH-TO-TALK</strong>: Maintenir pour parler, relâcher pour arrêter
          </li>
          <li>
            • <strong>Mode FREE</strong>: Utilise l'API native du navigateur (gratuit)
          </li>
          <li>
            • <strong>Mode PRO</strong>: Utilise Whisper API (plus précis, payant)
          </li>
        </ul>
      </div>
    </div>
  );
}
