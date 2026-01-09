import React, { useState, useEffect } from "react";
import { Icon } from "@inseme/cop-host";
import { useCurrentUser } from "@inseme/cop-host";
import { getConfig } from "../../common/config/instanceConfig.client.js";

export default function FeedOpheliaModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  title,
  content,
  url,
}) {
  const { currentUser } = useCurrentUser();
  const botName = getConfig("bot_name", "Ophélia");
  const [step, setStep] = useState("initial"); // initial, analyzing, review, ingesting, success
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep("initial");
      setAnalysis(null);
      setError(null);
    }
  }, [isOpen]);

  const handleAnalyze = async () => {
    setStep("analyzing");
    setError(null);
    try {
      const response = await fetch("/api/analyze-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: content,
          title: title,
          type: entityType,
        }),
      });

      if (!response.ok) throw new Error("Analysis failed");
      const data = await response.json();
      setAnalysis(data);
      setStep("review");
    } catch (err) {
      setError(err.message);
      setStep("initial");
    }
  };

  const handleIngest = async () => {
    setStep("ingesting");
    setError(null);
    try {
      const response = await fetch("/api/ingest-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...analysis,
          title,
          type: entityType,
          url,
          ingestedBy: currentUser?.id,
        }),
      });

      if (!response.ok) throw new Error("Ingestion failed");
      setStep("success");
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message);
      setStep("review");
    }
  };

  // Helper to update analysis state
  const updateAnalysis = (field, value) => {
    setAnalysis((prev) => ({ ...prev, [field]: value }));
  };

  const removeChunk = (index) => {
    const newChunks = analysis.chunks.filter((_, i) => i !== index);
    updateAnalysis("chunks", newChunks);
  };

  const addChunk = () => {
    const newChunks = [...analysis.chunks, "New fact..."];
    updateAnalysis("chunks", newChunks);
  };

  const updateChunk = (index, text) => {
    const newChunks = [...analysis.chunks];
    newChunks[index] = text;
    updateAnalysis("chunks", newChunks);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-indigo-50">
          <div className="flex items-center gap-2 text-indigo-700">
            <Icon name="brain" size={24} />
            <h2 className="font-bold text-lg">Curator: Feed {botName}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <Icon name="x" size={24} /> 
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "initial" && (
            <div className="text-center py-10">
              <Icon name="brain" size={64} className="mx-auto text-indigo-300 mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Teach {botName} about "{title}"
              </h3>
              <p className="text-gray-600 mb-6">
                {botName} will read this content, extract key facts, and generate questions to help
                her understand it. You can review everything before saving.
              </p>
              {error && <div className="text-red-500 mb-4">{error}</div>}
              <button
                onClick={handleAnalyze}
                className="btn btn-primary flex items-center gap-2 mx-auto"
              >
                <Icon name="sparkles" size={20} />  
                Start Analysis
              </button>
            </div>
          )}

          {step === "analyzing" && (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-lg text-gray-600">{botName} is reading and thinking...</p>
            </div>
          )}

          {step === "review" && analysis && (
            <div className="space-y-6">
              {/* Summary Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Summary (The Abstract)
                </label>
                <textarea
                  value={analysis.summary}
                  onChange={(e) => updateAnalysis("summary", e.target.value)}
                  className="w-full p-3 border  focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
                />
              </div>

              {/* Chunks Section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Knowledge Chunks (Facts)
                  </label>
                  <button
                    onClick={addChunk}
                    className="text-indigo-600 text-sm hover:underline flex items-center gap-1"
                  >
                    <Icon name="plus" size={16} /> Add Fact
                  </button>
                </div>
                <div className="space-y-2">
                  {analysis.chunks.map((chunk, i) => (
                    <div key={i} className="flex gap-2 items-start group">
                      <textarea
                        value={chunk}
                        onChange={(e) => updateChunk(i, e.target.value)}
                        className="flex-1 p-2 border rounded text-sm focus:ring-1 focus:ring-indigo-500 min-h-[60px]"
                      />
                      <button
                        onClick={() => removeChunk(i)}
                        className="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Icon name="trash" size={18} /> 
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Questions Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Synthetic Q&A (Context)
                </label>
                <div className="bg-gray-50 p-4  space-y-2">
                  {analysis.questions.map((q, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-indigo-400 font-bold">?</span>
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => {
                          const newQ = [...analysis.questions];
                          newQ[i] = e.target.value;
                          updateAnalysis("questions", newQ);
                        }}
                        className="flex-1 bg-transparent border-b border-gray-200 focus:border-indigo-500 outline-none py-1"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex gap-4 text-sm text-gray-500">
                <div>
                  Domain: <span className="font-medium text-gray-700">{analysis.domain}</span>
                </div>
                <div>
                  Tags:{" "}
                  <span className="font-medium text-gray-700">{analysis.tags.join(", ")}</span>
                </div>
              </div>
            </div>
          )}

          {step === "ingesting" && (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-lg text-gray-600">Memorizing knowledge...</p>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-20 text-green-600">
              <Check size={64} className="mx-auto mb-4" />
              <h3 className="text-2xl font-bold">Knowledge Ingested!</h3>
              <p className="text-gray-600 mt-2">{botName} now knows about this.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "review" && (
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
            <button
              onClick={() => setStep("initial")}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 "
            >
              Cancel
            </button>
            <button
              onClick={handleIngest}
              className="px-6 py-2 bg-indigo-600 text-white  hover:bg-indigo-700 flex items-center gap-2 font-medium"
            >
              <Brain weight="fill" />
              Feed {botName}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
