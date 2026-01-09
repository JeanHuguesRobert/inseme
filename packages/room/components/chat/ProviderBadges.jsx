import React from "react";
import ProviderIcon from "./ProviderIcon";

export default function ProviderBadges({
  providers = [],
  onSelectProvider = () => {},
  providersStatus = null,
  selectedProvider = null,
}) {
  const list = Array.isArray(providers) ? providers : [];

  const getProviderMetrics = (providerName) => {
    if (!providersStatus?.providers) return null;
    const provider = providersStatus.providers.find((p) => p.name === providerName);
    if (!provider || provider.status === "not_configured") return null;
    const mainModel = provider.models?.[0] || {};
    return {
      status: provider.status,
      avgTime: mainModel?.avgResponseTime || null,
      successRate: mainModel?.successRate || null,
      recentlyUsed: mainModel?.recentlyUsed || false,
      retryAfter: mainModel?.retryAfter || null,
      consecutiveErrors: mainModel?.consecutiveErrors || 0,
    };
  };

  return (
    <div
      className="provider-badges-inline"
      style={{ display: "flex", gap: 8, alignItems: "center" }}
    >
      {list.map((p) => {
        const m = getProviderMetrics(p);
        const isNotConfigured = m?.status === "not_configured";
        const latencyMs = m?.avgTime != null ? Number(m.avgTime) : null; // expect ms
        const latencyLabel =
          latencyMs == null
            ? "—"
            : latencyMs < 1000
              ? `${Math.round(latencyMs)}ms`
              : `${(latencyMs / 1000).toFixed(2)}s`;
        const latencyClass =
          latencyMs == null
            ? "metric-latency-na"
            : latencyMs < 500
              ? "metric-latency-good"
              : latencyMs < 1500
                ? "metric-latency-warn"
                : "metric-latency-bad";

        const success = m?.successRate != null ? Number(m.successRate) : null;
        const successLabel = success == null ? "—" : `${Math.round(success)}%`;
        const successClass =
          success == null
            ? "metric-success-na"
            : success >= 90
              ? "metric-success-good"
              : success >= 70
                ? "metric-success-warn"
                : "metric-success-bad";
        return (
          <div
            key={p}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}
          >
            <button
              type="button"
              className={`provider-badge provider-${p} ${selectedProvider === p ? "active" : ""} ${isNotConfigured ? "not-configured" : ""}`}
              onClick={() => !isNotConfigured && onSelectProvider(p)}
              title={`Sélectionner ${p}`}
              aria-pressed={selectedProvider === p}
              aria-disabled={isNotConfigured}
            >
              <span className="provider-icon-wrap" aria-hidden>
                <ProviderIcon provider={p} size={18} />
              </span>
              <span className="provider-name">{p}</span>
            </button>
            {m && (
              <div
                className="provider-metrics-inline"
                style={{
                  fontSize: 12,
                  marginTop: 4,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                {m.status === "available" && (
                  <span className="metric-badge metric-success">🟢</span>
                )}
                {m.status === "degraded" && <span className="metric-badge metric-warning">🟡</span>}
                {m.status === "rate_limited" && (
                  <span className="metric-badge metric-retry">⏳</span>
                )}
                <span
                  className={`metric-badge metric-latency ${latencyClass}`}
                  title={`Latence : ${latencyLabel}`}
                >
                  ⚡ {latencyLabel}
                </span>
                <span
                  className={`metric-badge metric-success-rate ${successClass}`}
                  title={`Taux de succès : ${successLabel}`}
                >
                  ✓ {successLabel}
                </span>
                {m.recentlyUsed && (
                  <span className="metric-badge metric-hot" title="Récemment utilisé">
                    🔥
                  </span>
                )}
                {m.retryAfter && (
                  <span className="metric-badge metric-retry">dans {m.retryAfter}s</span>
                )}
                {m.consecutiveErrors > 0 && (
                  <span className="metric-badge">⚠️ {m.consecutiveErrors}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
