import React, { useState, useEffect } from "react";
import ProviderStatus from "./ProviderStatus";
import "./chat-v2.css";

export default function ModelSelectionModal({ logic, onClose, onSelect }) {
  const [activeTab, setActiveTab] = useState("presets"); // presets | advanced

  // Helper to get current model info
  const getCurrentModelInfo = () => {
    if (!logic.providerMeta) return null;
    return {
      provider: logic.providerMeta.provider || "Inconnu",
      model: logic.providerMeta.model || "—",
      latency: logic.providerMeta.avgResponseTime,
      success: logic.providerMeta.successRate,
    };
  };

  const currentInfo = getCurrentModelInfo();

  return (
    <div className="bob-modal" role="dialog" aria-modal="true">
      <div className="bob-modal-overlay" onClick={onClose}></div>
      <div className="bob-modal-dialog model-selection-modal">
        <header className="model-modal-header">
          <h3>Changer de modèle IA</h3>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="model-modal-body">
          {/* Current Context */}
          {currentInfo && (
            <div className="current-model-card">
              <div className="current-model-label">Dernier modèle utilisé</div>
              <div className="current-model-details">
                <span className="current-provider">{currentInfo.provider}</span>
                <span className="current-model-name">{currentInfo.model}</span>
                {currentInfo.latency && (
                  <span className="metric-badge metric-latency">
                    ⚡ {Math.round(currentInfo.latency)}ms
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="model-tabs">
            <button
              className={`model-tab ${activeTab === "presets" ? "active" : ""}`}
              onClick={() => setActiveTab("presets")}
            >
              ✨ Recommandés
            </button>
            <button
              className={`model-tab ${activeTab === "advanced" ? "active" : ""}`}
              onClick={() => setActiveTab("advanced")}
            >
              ⚙️ Avancé
            </button>
          </div>

          {/* Content Area */}
          <div className="model-tab-content">
            {activeTab === "presets" && (
              <div className="presets-grid">
                <button
                  className="preset-card automatic"
                  onClick={() => {
                    logic.setModalProvider?.("");
                    logic.setModalMode?.("");
                    logic.setDirectivePrefix?.("");
                    onSelect?.({ provider: "", mode: "" });
                  }}
                >
                  <div className="preset-icon">🤖</div>
                  <div className="preset-info">
                    <div className="preset-title">Automatique</div>
                    <div className="preset-desc">Laissez Bob choisir le meilleur modèle</div>
                  </div>
                </button>

                {logic.quickPresets
                  ?.filter((p) => logic.sortedAvailableProviders.includes(p.provider))
                  .map((preset, i) => (
                    <button
                      key={`${preset.provider}-${preset.mode}`}
                      className="preset-card"
                      onClick={() => {
                        logic.handleQuickPreset?.(preset);
                        // We might want to close immediately or let user confirm.
                        // For now let's just select and let user click 'Apply' or we can auto-apply.
                        // The logic.handleQuickPreset sets the modal state.
                      }}
                    >
                      <div className="preset-icon">
                        {preset.provider === "openai"
                          ? "🧠"
                          : preset.provider === "mistral"
                            ? "🌪️"
                            : preset.provider === "anthropic"
                              ? "🧠"
                              : "⚡"}
                      </div>
                      <div className="preset-info">
                        <div className="preset-title">{preset.label}</div>
                        <div className="preset-desc">
                          {preset.provider} • {preset.mode}
                        </div>
                      </div>
                      {logic.modalProvider === preset.provider &&
                        logic.modalMode === preset.mode && (
                          <div className="preset-selected-indicator">✓</div>
                        )}
                    </button>
                  ))}
              </div>
            )}

            {activeTab === "advanced" && (
              <div className="advanced-selection">
                <div className="form-group">
                  <label>Fournisseur</label>
                  <select
                    className="selector-select"
                    value={logic.modalProvider || ""}
                    onChange={(e) => logic.setModalProvider?.(e.target.value)}
                  >
                    {((logic.providersStatus?.providers || []).length
                      ? logic.providersStatus.providers
                      : logic.availableProviders || []
                    ).map((p) => {
                      const name = p.name || p;
                      const label = p.label || p.name || p;
                      return (
                        <option key={name} value={name} disabled={p.status === "not_configured"}>
                          {label} {p.status === "not_configured" ? "(non configuré)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group">
                  <label>Modèle</label>
                  <select
                    className="selector-select"
                    value={logic.modalMode || ""}
                    onChange={(e) => logic.setModalMode?.(e.target.value)}
                  >
                    {(logic.MODEL_MODES[logic.modalProvider]
                      ? Object.keys(logic.MODEL_MODES[logic.modalProvider])
                      : []
                    ).map((modeKey) => (
                      <option key={modeKey} value={modeKey}>
                        {logic.MODEL_MODES[logic.modalProvider][modeKey] || modeKey}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Availability Dashboard */}
          <div className="availability-section">
            <h4>Disponibilité des services</h4>
            <ProviderStatus
              providersData={logic.providersStatus}
              onSelectProvider={(p, m) => {
                logic.selectProvider?.(p, m);
                // Optionally switch to advanced tab to show selection
                setActiveTab("advanced");
              }}
              displayMode="grid" // New prop we will implement
            />
          </div>
        </div>

        <footer className="model-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              onSelect?.({
                provider: logic.modalProvider,
                mode: logic.modalMode,
                manualModel: logic.customModel || null,
              })
            }
          >
            Appliquer
          </button>
        </footer>
      </div>
    </div>
  );
}
