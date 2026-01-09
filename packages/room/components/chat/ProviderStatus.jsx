import React, { useState } from "react";

const ProviderStatus = ({ providersData, onSelectProvider, displayMode = "compact" }) => {
  const [expandedProviders, setExpandedProviders] = useState(new Set());

  // Toggle expansion d'un provider
  const toggleProvider = (providerName) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(providerName)) {
      newExpanded.delete(providerName);
    } else {
      newExpanded.add(providerName);
    }
    setExpandedProviders(newExpanded);
  };

  // Select a provider (optionally with a model/mode)
  const selectProvider = (providerName, mode = null) => {
    const p = providersData?.providers?.find((x) => x.name === providerName);
    if (!p || p.status === "not_configured") return;
    if (onSelectProvider) onSelectProvider(providerName, mode);
  };

  // Icons pour status
  const getStatusIcon = (status) => {
    switch (status) {
      case "available":
        return "🟢";
      case "degraded":
        return "🟡";
      case "rate_limited":
        return "⏳";
      case "error":
        return "🔴";
      case "not_configured":
        return "🔒";
      default:
        return "⚪";
    }
  };

  // Format temps
  const formatTime = (ms) => {
    if (!ms) return "";
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case "available":
        return "Disponible";
      case "degraded":
        return "Dégradé";
      case "rate_limited":
        return "Limité";
      case "error":
        return "Erreur";
      case "not_configured":
        return "Non configuré";
      default:
        return "Inconnu";
    }
  };

  if (!providersData?.providers || providersData.providers.length === 0) {
    return <div className="provider-status-empty">Aucun fournisseur disponible</div>;
  }

  // Grid mode for modal
  if (displayMode === "grid") {
    return (
      <div className="provider-grid">
        {providersData.providers.map((provider) => {
          const mainModel = provider.models?.[0];
          const isAvailable = provider.status === "available";
          const isConfigured = provider.status !== "not_configured";

          return (
            <button
              key={provider.name}
              className={`provider-card provider-card--${provider.status} ${!isConfigured ? "provider-card--disabled" : ""}`}
              onClick={() => isConfigured && selectProvider(provider.name)}
              disabled={!isConfigured}
              title={isConfigured ? `Sélectionner ${provider.name}` : "Non configuré"}
            >
              <div className="provider-card__header">
                <span className="provider-card__icon">{getStatusIcon(provider.status)}</span>
                <span className="provider-card__name">{provider.name}</span>
              </div>

              <div className="provider-card__status">{getStatusLabel(provider.status)}</div>

              {isConfigured && mainModel && (
                <div className="provider-card__metrics">
                  {mainModel.avgResponseTime && (
                    <div className="metric">
                      <span className="metric-icon">⚡</span>
                      <span className="metric-value">{formatTime(mainModel.avgResponseTime)}</span>
                    </div>
                  )}
                  {mainModel.successRate !== undefined && (
                    <div className="metric">
                      <span className="metric-icon">✓</span>
                      <span className="metric-value">{Math.round(mainModel.successRate)}%</span>
                    </div>
                  )}
                  {mainModel.recentlyUsed && (
                    <div className="metric metric--hot">
                      <span className="metric-icon">🔥</span>
                      <span className="metric-value">Récent</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Compact/List mode (legacy)
  return (
    <div className={`provider-status provider-status--${displayMode}`}>
      <div className="provider-status__list">
        {providersData.providers.map((provider) => {
          const isExpanded = expandedProviders.has(provider.name);
          const hasModels = provider.models && provider.models.length > 0;

          return (
            <div key={provider.name} className={`provider-item provider-item--${provider.status}`}>
              <div className="provider-item__header">
                <span className="provider-item__icon">{getStatusIcon(provider.status)}</span>
                <span className="provider-item__name">{provider.name}</span>

                {displayMode === "compact" && hasModels && (
                  <span className="provider-item__quick-stats">
                    {provider.models.find((m) => m.recentlyUsed) && "🔥"}
                    {provider.models[0]?.avgResponseTime && (
                      <span className="stat">
                        ⚡{formatTime(provider.models[0].avgResponseTime)}
                      </span>
                    )}
                  </span>
                )}

                <button
                  className="provider-item__use"
                  onClick={() =>
                    selectProvider(
                      provider.name,
                      provider.models?.[0]?.mode || provider.models?.[0]?.name || null
                    )
                  }
                  title={
                    provider.status === "not_configured"
                      ? "Non configuré"
                      : `Sélectionner ${provider.name}`
                  }
                  aria-disabled={provider.status === "not_configured"}
                >
                  {provider.status === "not_configured" ? "🔒" : "Sélectionner"}
                </button>

                {hasModels && (
                  <button
                    className="provider-item__expand"
                    onClick={() => toggleProvider(provider.name)}
                  >
                    {isExpanded ? "−" : "+"}
                  </button>
                )}
              </div>

              {hasModels && (displayMode === "detailed" || isExpanded) && (
                <div className="provider-item__models">
                  {provider.models.map((model) => (
                    <div
                      key={model.name || model.mode}
                      className={`model-item model-item--${model.status} ${model.recentlyUsed ? "model-item--recent" : ""}`}
                      onClick={() =>
                        onSelectProvider && onSelectProvider(provider.name, model.mode || null)
                      }
                    >
                      <div className="model-item__header">
                        <span className="model-item__name">{model.mode || model.name}</span>
                        {model.recentlyUsed && <span className="model-item__badge">🔥</span>}
                      </div>

                      <div className="model-item__stats">
                        {model.avgResponseTime && (
                          <span className="stat stat--time" title="Temps de réponse moyen">
                            ⚡ {formatTime(model.avgResponseTime)}
                          </span>
                        )}
                        {model.successRate !== undefined && (
                          <span
                            className={`stat stat--success ${model.successRate < 90 ? "stat--warning" : ""}`}
                            title="Taux de succès"
                          >
                            ✓ {model.successRate}%
                          </span>
                        )}
                        {model.retryAfter && (
                          <span className="stat stat--retry" title="Réessayer dans...">
                            ⏳ {model.retryAfter}s
                          </span>
                        )}
                        {model.consecutiveErrors > 0 && (
                          <span className="stat stat--errors" title="Erreurs consécutives">
                            ⚠️ {model.consecutiveErrors}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {provider.status === "not_configured" && displayMode === "detailed" && (
                <div className="provider-item__not-configured">API key manquante</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProviderStatus;
