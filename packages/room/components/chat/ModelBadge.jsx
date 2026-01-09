import React from "react";

export default function ModelBadge({ provider, mode, providersStatus }) {
  if (!providersStatus?.providers || !provider || !mode) return null;

  const providerData = providersStatus.providers.find((p) => p.name === provider);
  if (!providerData) return null;

  const modelData = providerData.models?.find((m) => m.mode === mode);
  if (!modelData) return null;

  return (
    <div className="provider-metrics-inline" style={{ marginTop: "8px" }}>
      {/* Status */}
      {modelData.status === "unknown" && (
        <span className="metric-badge" style={{ opacity: 0.5 }}>
          ⚪ Jamais utilisé
        </span>
      )}
      {modelData.status === "available" && (
        <span className="metric-badge metric-success">🟢 Disponible</span>
      )}
      {modelData.status === "degraded" && (
        <span className="metric-badge metric-warning">🟡 Dégradé</span>
      )}
      {modelData.status === "rate_limited" && (
        <span className="metric-badge metric-retry">⏳ Rate limited</span>
      )}

      {/* Performance metrics */}
      {modelData.avgResponseTime && (
        <span className="metric-badge metric-time">
          ⚡ {(modelData.avgResponseTime / 1000).toFixed(2)}s
        </span>
      )}
      {modelData.successRate != null && (
        <span
          className={`metric-badge metric-${modelData.successRate < 90 ? "warning" : "success"}`}
        >
          ✓ {modelData.successRate}%
        </span>
      )}
      {modelData.recentlyUsed && <span className="metric-badge metric-hot">🔥 Récent</span>}
      {modelData.retryAfter && (
        <span className="metric-badge metric-retry">dans {modelData.retryAfter}s</span>
      )}
      {modelData.consecutiveErrors > 0 && (
        <span
          className="metric-badge"
          style={{ background: "rgba(239, 83, 80, 0.2)", color: "#ef5350" }}
        >
          ⚠️ {modelData.consecutiveErrors} erreur(s)
        </span>
      )}
    </div>
  );
}
