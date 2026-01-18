import React, { useEffect, useMemo, useState } from "react";

export default function AiProviderMetricsPanel({ supabase, autoRefreshMs = 30000 }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("ai_provider_status")
        .select("*")
        .order("provider", { ascending: true })
        .order("model", { ascending: true });
      if (err) {
        setError(err.message || String(err));
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      setError(e.message || String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [supabase]);

  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs <= 0 || !supabase) return;
    const id = setInterval(load, autoRefreshMs);
    return () => clearInterval(id);
  }, [autoRefreshMs, supabase]);

  const grouped = useMemo(() => {
    const byProvider = new Map();
    for (const row of rows) {
      if (!row || !row.provider) continue;
      if (!byProvider.has(row.provider)) byProvider.set(row.provider, []);
      byProvider.get(row.provider).push(row);
    }
    return Array.from(byProvider.entries()).map(([provider, items]) => ({
      provider,
      items,
    }));
  }, [rows]);

  const formatTime = (ms) => {
    if (!ms && ms !== 0) return "—";
    const value = Number(ms);
    if (!Number.isFinite(value)) return "—";
    if (value < 1000) return `${Math.round(value)} ms`;
    return `${(value / 1000).toFixed(2)} s`;
  };

  const formatPercent = (v) => {
    if (v == null) return "—";
    const value = Number(v);
    if (!Number.isFinite(value)) return "—";
    return `${Math.round(value)}%`;
  };

  const formatDateTime = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString();
    } catch {
      return "—";
    }
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 13,
        color: "#222",
        background: "#fafafa",
        border: "1px solid #ddd",
        borderRadius: 4,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div>
          <strong>AI Provider Metrics</strong>
          <span style={{ marginLeft: 8, color: "#666" }}>
            {loading ? "Loading…" : `Total entries: ${rows.length}`}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {autoRefreshMs > 0 && (
            <span style={{ fontSize: 11, color: "#888" }}>
              Auto-refresh: {Math.round(autoRefreshMs / 1000)}s
            </span>
          )}
          <button
            type="button"
            onClick={load}
            style={{
              fontSize: 12,
              padding: "4px 8px",
              borderRadius: 3,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {!supabase && (
        <div
          style={{
            padding: 8,
            borderRadius: 3,
            background: "#fff3cd",
            border: "1px solid #ffeeba",
            color: "#856404",
          }}
        >
          Supabase client not provided.
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 3,
            background: "#f8d7da",
            border: "1px solid #f5c6cb",
            color: "#721c24",
          }}
        >
          {error}
        </div>
      )}

      {grouped.length === 0 && !loading && supabase && !error && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            borderRadius: 3,
            background: "#fff",
            border: "1px dashed #ccc",
            color: "#666",
          }}
        >
          No metrics found in ai_provider_status.
        </div>
      )}

      {grouped.map(({ provider, items }) => (
        <div
          key={provider}
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: "1px solid #eee",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <span style={{ fontWeight: 600 }}>{provider}</span>
            <span style={{ fontSize: 11, color: "#888" }}>models: {items.length}</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 6px" }}>Model</th>
                  <th style={{ textAlign: "left", padding: "4px 6px" }}>Status</th>
                  <th style={{ textAlign: "right", padding: "4px 6px" }}>Success</th>
                  <th style={{ textAlign: "right", padding: "4px 6px" }}>Requests</th>
                  <th style={{ textAlign: "right", padding: "4px 6px" }}>Avg latency</th>
                  <th style={{ textAlign: "right", padding: "4px 6px" }}>Consecutive errors</th>
                  <th style={{ textAlign: "right", padding: "4px 6px" }}>Retry after</th>
                  <th style={{ textAlign: "left", padding: "4px 6px" }}>Last checked</th>
                  <th style={{ textAlign: "left", padding: "4px 6px" }}>Last error</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const metrics = row.metrics || {};
                  const lastError = row.last_error || {};
                  const successCount = metrics.success_count || 0;
                  const requestCount = metrics.request_count || 0;
                  const avgLatency = metrics.avg_latency || null;
                  const successRate = requestCount > 0 ? (successCount / requestCount) * 100 : null;
                  const retryAfter =
                    lastError.retryAfter != null ? Number(lastError.retryAfter) : null;
                  return (
                    <tr
                      key={`${row.provider}:${row.model}`}
                      style={{
                        background: "#fff",
                        borderTop: "1px solid #f0f0f0",
                      }}
                    >
                      <td style={{ padding: "4px 6px" }}>{row.model}</td>
                      <td style={{ padding: "4px 6px" }}>{row.status}</td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                        }}
                      >
                        {formatPercent(successRate)}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                        }}
                      >
                        {requestCount}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                        }}
                      >
                        {formatTime(avgLatency)}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                        }}
                      >
                        {metrics.consecutiveErrors || 0}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          textAlign: "right",
                        }}
                      >
                        {retryAfter != null ? `${retryAfter}s` : "—"}
                      </td>
                      <td style={{ padding: "4px 6px" }}>{formatDateTime(row.last_checked_at)}</td>
                      <td
                        style={{
                          padding: "4px 6px",
                          maxWidth: 260,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: "#a33",
                        }}
                        title={lastError && lastError.message ? String(lastError.message) : ""}
                      >
                        {lastError && lastError.message ? String(lastError.message) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
