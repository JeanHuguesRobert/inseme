// File: src/pages/admin/CopAdmin.jsx
// Description:
//   Page d'admin/test COP (React).
//   1) Envoi de COP_MESSAGE vers un agent (par défaut: echo) via /cop.
//   2) Streaming des COP_EVENT d'un canal via /cop-stream (SSE).
//   3) Visualisation du registre COP (cop_nodes, cop_agents) via /cop-admin-registry.

import React, { useCallback, useEffect, useRef, useState } from "react";

// Trace state moved inside component

// Helpers locaux (on ne dépend pas de cop-kernel côté navigateur)

// COP_ADDR: cop://{networkId}/{nodeId}/{instanceId}/{agentName}
function mkCopAddr({ networkId, nodeId, instanceId, agentName }) {
  if (!networkId || !nodeId || !instanceId || !agentName) {
    throw new Error("mkCopAddr: missing component(s)");
  }
  return `cop://${networkId}/${nodeId}/${instanceId}/${agentName}`;
}

// COPCHAN_ADDR: copchan://{networkId}/{nodeId}/{instanceId}/{channelId}
function mkChanAddr({ networkId, nodeId, instanceId, channelId }) {
  if (!networkId || !nodeId || !instanceId || !channelId) {
    throw new Error("mkChanAddr: missing component(s)");
  }
  return `copchan://${networkId}/${nodeId}/${instanceId}/${channelId}`;
}

// Génère un identifiant simple
function genId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

export default function CopAdmin() {
  // Valeurs par défaut à adapter
  const [networkId, setNetworkId] = useState("localnet");
  const [nodeId, setNodeId] = useState("localnode");
  const [instanceId, setInstanceId] = useState("default");
  const [agentName, setAgentName] = useState("echo");

  const [intent, setIntent] = useState("echo.request");
  const [channelId, setChannelId] = useState("test-channel");

  const [payloadText, setPayloadText] = useState('{"text": "Hello COP"}');

  const [sending, setSending] = useState(false);
  const [lastRequest, setLastRequest] = useState(null);
  const [lastResponse, setLastResponse] = useState(null);
  const [sendError, setSendError] = useState(null);

  // Streaming
  const [streamChannelId, setStreamChannelId] = useState("test-channel");
  const [streamEvents, setStreamEvents] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef(null);
  const lastEventIdRef = useRef(null);

  // Registry viewer
  const [nodesData, setNodesData] = useState(null);
  const [agentsData, setAgentsData] = useState(null);
  const [registryError, setRegistryError] = useState(null);
  const [registryLoading, setRegistryLoading] = useState(false);

  // Trace state
  const [traceCorrelationId, setTraceCorrelationId] = useState("");
  const [traceData, setTraceData] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState(null);

  const loadTrace = useCallback(async () => {
    setTraceError(null);
    setTraceData(null);

    const cid = traceCorrelationId.trim();
    if (!cid) {
      setTraceError("Veuillez saisir un correlation_id.");
      return;
    }

    setTraceLoading(true);
    try {
      const res = await fetch(
        `/cop-admin-registry?resource=trace&correlation_id=${encodeURIComponent(cid)}`
      );
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }

      if (!res.ok || body.status === "error") {
        setTraceError("Erreur trace : " + (body.error?.message || `HTTP ${res.status}`));
        return;
      }

      setTraceData(body);
    } catch (err) {
      setTraceError("Erreur réseau (trace) : " + err.message);
    } finally {
      setTraceLoading(false);
    }
  }, [traceCorrelationId]);

  // loadTrace moved inside component

  // Envoi d'un COP_MESSAGE vers /cop
  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      setSendError(null);
      setLastResponse(null);

      let payload;
      try {
        payload = payloadText.trim() ? JSON.parse(payloadText) : {};
      } catch (err) {
        setSendError("Payload JSON invalide : " + err.message);
        return;
      }

      let toAddr;
      let chanAddr;
      try {
        toAddr = mkCopAddr({ networkId, nodeId, instanceId, agentName });
        chanAddr = mkChanAddr({ networkId, nodeId, instanceId, channelId });
      } catch (err) {
        setSendError("Erreur d'adresse COP : " + err.message);
        return;
      }

      const messageId = genId();
      const msg = {
        cop_version: "0.2.0",
        message_id: messageId,
        correlation_id: null,
        from: toAddr, // pour les tests, on se met soi-même en from
        to: toAddr,
        intent,
        payload,
        channel: chanAddr,
        metadata: {
          test: true,
          ui: "CopAdmin",
        },
        auth: null,
      };

      setLastRequest(msg);
      setSending(true);

      try {
        const res = await fetch("/cop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg),
        });

        const text = await res.text();
        let body = null;
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }

        setLastResponse({
          status: res.status,
          body,
        });
      } catch (err) {
        setSendError("Erreur réseau /cop : " + err.message);
      } finally {
        setSending(false);
      }
    },
    [networkId, nodeId, instanceId, agentName, intent, channelId, payloadText]
  );

  // Gestion du streaming SSE depuis /cop-stream
  const startStreaming = useCallback(() => {
    if (isStreaming) return;

    let chanAddr;
    try {
      chanAddr = mkChanAddr({
        networkId,
        nodeId,
        instanceId,
        channelId: streamChannelId,
      });
    } catch (err) {
      alert("Erreur d'adresse de canal: " + err.message);
      return;
    }

    const params = new URLSearchParams();
    params.set("channel", chanAddr);
    if (lastEventIdRef.current != null) {
      params.set("since_id", String(lastEventIdRef.current));
    }

    const es = new EventSource(`/cop-stream?${params.toString()}`);

    es.onopen = () => {
      setIsStreaming(true);
    };

    es.onmessage = (evt) => {
      let data;
      try {
        data = JSON.parse(evt.data);
      } catch {
        data = evt.data;
      }

      const id = evt.lastEventId ? Number(evt.lastEventId) : null;
      if (id != null) {
        lastEventIdRef.current = id;
      }

      setStreamEvents((prev) => [
        {
          id,
          type: evt.type || "message",
          rawType: evt.type,
          data,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    };

    es.onerror = () => {
      es.close();
      setIsStreaming(false);
    };

    eventSourceRef.current = es;
  }, [isStreaming, networkId, nodeId, instanceId, streamChannelId]);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Chargement du registre (nodes / agents) via /cop-admin-registry
  const loadRegistry = useCallback(async (resource) => {
    setRegistryError(null);
    setRegistryLoading(true);

    try {
      const res = await fetch(`/cop-admin-registry?resource=${resource}`);
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }

      if (!res.ok || body.status === "error") {
        setRegistryError(`Erreur ${resource}: ` + (body.error?.message || `HTTP ${res.status}`));
        if (resource === "nodes") setNodesData(null);
        if (resource === "agents") setAgentsData(null);
        return;
      }

      if (resource === "nodes") setNodesData(body);
      if (resource === "agents") setAgentsData(body);
    } catch (err) {
      setRegistryError(`Erreur réseau (${resource}) : ` + err.message);
    } finally {
      setRegistryLoading(false);
    }
  }, []);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>COP Admin / Test</h1>

      {/* 1. Envoi de COP_MESSAGE */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>1. Envoi de COP_MESSAGE</h2>

        <form onSubmit={handleSendMessage} style={styles.form}>
          <div style={styles.row}>
            <label style={styles.label}>networkId</label>
            <input
              style={styles.input}
              value={networkId}
              onChange={(e) => setNetworkId(e.target.value)}
            />
          </div>

          <div style={styles.row}>
            <label style={styles.label}>nodeId</label>
            <input
              style={styles.input}
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
            />
          </div>

          <div style={styles.row}>
            <label style={styles.label}>instanceId</label>
            <input
              style={styles.input}
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
            />
          </div>

          <div style={styles.row}>
            <label style={styles.label}>agentName</label>
            <input
              style={styles.input}
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
            />
          </div>

          <div style={styles.row}>
            <label style={styles.label}>intent</label>
            <input
              style={styles.input}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
            />
          </div>

          <div style={styles.row}>
            <label style={styles.label}>channelId</label>
            <input
              style={styles.input}
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            />
          </div>

          <div style={styles.row}>
            <label style={styles.label}>payload (JSON)</label>
            <textarea
              style={styles.textarea}
              rows={4}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
            />
          </div>

          <div style={styles.row}>
            <button type="submit" style={styles.button} disabled={sending}>
              {sending ? "Envoi en cours…" : "Envoyer /cop"}
            </button>
          </div>
        </form>

        {sendError && <div style={styles.error}>Erreur d&apos;envoi : {sendError}</div>}

        <div style={styles.subSection}>
          <h3 style={styles.subTitle}>Dernier message envoyé</h3>
          <pre style={styles.pre}>
            {lastRequest ? JSON.stringify(lastRequest, null, 2) : "(aucun)"}
          </pre>
        </div>

        <div style={styles.subSection}>
          <h3 style={styles.subTitle}>
            Dernier message envoyé{" "}
            {lastRequest && (
              <button
                type="button"
                style={{
                  ...styles.buttonSecondary,
                  padding: "2px 6px",
                  fontSize: "11px",
                  marginLeft: "8px",
                }}
                onClick={() =>
                  setTraceCorrelationId(lastRequest.correlation_id || lastRequest.message_id)
                }
              >
                Utiliser comme correlation_id
              </button>
            )}
          </h3>
          <pre style={styles.pre}>
            {lastRequest ? JSON.stringify(lastRequest, null, 2) : "(aucun)"}
          </pre>
        </div>

        <div style={styles.subSection}>
          <h3 style={styles.subTitle}>Dernière réponse /cop</h3>
          <pre style={styles.pre}>
            {lastResponse ? JSON.stringify(lastResponse, null, 2) : "(aucune)"}
          </pre>
        </div>
      </section>

      {/* 2. Streaming COP_EVENT */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>2. Streaming COP_EVENT (/cop-stream)</h2>

        <div style={styles.row}>
          <label style={styles.label}>stream channelId</label>
          <input
            style={styles.input}
            value={streamChannelId}
            onChange={(e) => setStreamChannelId(e.target.value)}
          />
        </div>

        <div style={styles.row}>
          {!isStreaming ? (
            <button style={styles.button} onClick={startStreaming}>
              Démarrer le streaming
            </button>
          ) : (
            <button style={styles.buttonSecondary} onClick={stopStreaming}>
              Arrêter le streaming
            </button>
          )}
        </div>

        <div style={styles.subSection}>
          <h3 style={styles.subTitle}>Événements reçus (dernier en premier)</h3>
          <div style={styles.eventsContainer}>
            {streamEvents.length === 0 ? (
              <div style={styles.empty}>Aucun événement reçu pour l’instant.</div>
            ) : (
              streamEvents.map((ev) => (
                <div key={ev.timestamp + "-" + ev.id} style={styles.eventCard}>
                  <div style={styles.eventHeader}>
                    <span style={styles.eventType}>{ev.data.event_type || ev.type}</span>
                    <span style={styles.eventTime}>{ev.timestamp}</span>
                  </div>
                  <pre style={styles.preSmall}>{JSON.stringify(ev.data, null, 2)}</pre>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 3. Registry viewer */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>3. Registry COP (cop_nodes / cop_agents)</h2>

        <div style={styles.row}>
          <button
            style={styles.button}
            onClick={() => loadRegistry("nodes")}
            disabled={registryLoading}
          >
            Charger cop_nodes
          </button>
          <button
            style={{ ...styles.buttonSecondary, marginLeft: 8 }}
            onClick={() => loadRegistry("agents")}
            disabled={registryLoading}
          >
            Charger cop_agents
          </button>
        </div>

        {registryError && <div style={styles.error}>Erreur registre : {registryError}</div>}

        <div style={styles.subSection}>
          <h3 style={styles.subTitle}>cop_nodes</h3>
          <pre style={styles.pre}>
            {nodesData ? JSON.stringify(nodesData, null, 2) : "(non chargé)"}
          </pre>
        </div>

        <div style={styles.subSection}>
          <h3 style={styles.subTitle}>cop_agents</h3>
          <pre style={styles.pre}>
            {agentsData ? JSON.stringify(agentsData, null, 2) : "(non chargé)"}
          </pre>
        </div>
      </section>

      {/* 4. Trace COP par correlation_id */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>4. Trace COP (cop_debug_logs)</h2>

        <div style={styles.row}>
          <label style={styles.label}>correlation_id</label>
          <input
            style={styles.input}
            placeholder="UUID (correlation_id ou message_id)"
            value={traceCorrelationId}
            onChange={(e) => setTraceCorrelationId(e.target.value)}
          />
        </div>

        <div style={styles.row}>
          <button style={styles.button} onClick={loadTrace} disabled={traceLoading}>
            {traceLoading ? "Chargement…" : "Charger la trace"}
          </button>
        </div>

        {traceError && <div style={styles.error}>Erreur trace : {traceError}</div>}

        {traceData && (
          <div style={styles.subSection}>
            <h3 style={styles.subTitle}>Résultats ({traceData.count} entrées)</h3>
            {traceData.count === 0 ? (
              <div style={styles.empty}>Aucune entrée pour ce correlation_id.</div>
            ) : (
              <div style={styles.eventsContainer}>
                {traceData.items.map((row) => (
                  <div key={row.id} style={styles.eventCard}>
                    <div style={styles.eventHeader}>
                      <span style={styles.eventType}>
                        {row.location} / {row.stage}
                      </span>
                      <span style={styles.eventTime}>{row.created_at}</span>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        marginBottom: "4px",
                        color: "#6b7280",
                      }}
                    >
                      correlation_id: {row.correlation_id || "∅"} | message_id:{" "}
                      {row.message_id || "∅"} | event_id: {row.event_id || "∅"} | direction:{" "}
                      {row.direction || "∅"}
                    </div>
                    <pre style={styles.preSmall}>{JSON.stringify(row.metadata, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Nouvelle section pour l'état civil des agents */}
      <AgentIdentityAdmin />
    </div>
  );
}

function AgentIdentityAdmin() {
  const [identities, setIdentities] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedIdentity, setSelectedIdentity] = useState(null);

  // Formulaire d'édition / création
  const [form, setForm] = useState({
    agent_id: "",
    agent_name: "",
    agent_class: "",
    description: "",
    owner_human_id: "",
    owner_group_id: "",
    operator_id: "",
    domains: "[]",
    permissions: "{}",
    constraints: "{}",
    issued_by: "",
    valid_until: "",
    profile: "{}",
    status: "active",
    metadata: "{}",
  });

  useEffect(() => {
    loadIdentities();
  }, [statusFilter]);

  async function loadIdentities() {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/cop-agent-identity", window.location.origin);
      if (statusFilter) {
        url.searchParams.set("status", statusFilter);
      }
      const res = await fetch(url.toString());
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      setIdentities(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function onSelectIdentity(identity) {
    setSelectedIdentity(identity || null);
    if (!identity) {
      setForm({
        agent_id: "",
        agent_name: "",
        agent_class: "",
        description: "",
        owner_human_id: "",
        owner_group_id: "",
        operator_id: "",
        domains: "[]",
        permissions: "{}",
        constraints: "{}",
        issued_by: "",
        valid_until: "",
        profile: "{}",
        status: "active",
        metadata: "{}",
      });
      return;
    }

    setForm({
      agent_id: identity.agent_id || "",
      agent_name: identity.agent_name || "",
      agent_class: identity.agent_class || "",
      description: identity.description || "",
      owner_human_id: identity.owner_human_id || "",
      owner_group_id: identity.owner_group_id || "",
      operator_id: identity.operator_id || "",
      domains: JSON.stringify(identity.domains || [], null, 2),
      permissions: JSON.stringify(identity.permissions || {}, null, 2),
      constraints: JSON.stringify(identity.constraints || {}, null, 2),
      issued_by: identity.issued_by || "",
      valid_until: identity.valid_until || "",
      profile: JSON.stringify(identity.profile || {}, null, 2),
      status: identity.status || "active",
      metadata: JSON.stringify(identity.metadata || {}, null, 2),
    });
  }

  function updateFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleUpsert(e) {
    e.preventDefault();
    setError(null);
    try {
      let domains = [];
      let permissions = {};
      let constraints = {};
      let profile = {};
      let metadata = {};

      if (form.domains.trim()) {
        domains = JSON.parse(form.domains);
      }
      if (form.permissions.trim()) {
        permissions = JSON.parse(form.permissions);
      }
      if (form.constraints.trim()) {
        constraints = JSON.parse(form.constraints);
      }
      if (form.profile.trim()) {
        profile = JSON.parse(form.profile);
      }
      if (form.metadata.trim()) {
        metadata = JSON.parse(form.metadata);
      }

      const payload = {
        action: "upsert",
        agent_id: form.agent_id || undefined,
        agent_name: form.agent_name,
        agent_class: form.agent_class,
        description: form.description || undefined,
        owner_human_id: form.owner_human_id || undefined,
        owner_group_id: form.owner_group_id || undefined,
        operator_id: form.operator_id || undefined,
        domains,
        permissions,
        constraints,
        issued_by: form.issued_by || undefined,
        valid_until: form.valid_until || undefined,
        profile,
        status: form.status || undefined,
        metadata,
      };

      const res = await fetch("/cop-agent-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
      }

      const updated = await res.json();
      // Rafraîchir la liste + sélection
      await loadIdentities();
      onSelectIdentity(updated);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function handleStatusChange(newStatus) {
    if (!selectedIdentity || !selectedIdentity.agent_id) return;
    setError(null);
    try {
      const payload = {
        action: "status",
        agent_id: selectedIdentity.agent_id,
        status: newStatus,
      };

      const res = await fetch("/cop-agent-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status} – ${txt.slice(0, 200)}`);
      }

      const updated = await res.json();
      await loadIdentities();
      onSelectIdentity(updated);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  return (
    <div style={{ border: "1px solid #ccc", padding: "1rem", marginTop: "1rem" }}>
      <h2>Agent Identities (état civil)</h2>

      <div style={{ marginBottom: "0.5rem" }}>
        <label>
          Status filter:&nbsp;
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">(all)</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="revoked">revoked</option>
            <option value="expired">expired</option>
          </select>
        </label>
        <button type="button" onClick={loadIdentities} style={{ marginLeft: "0.5rem" }}>
          Refresh
        </button>
      </div>

      {loading && <div>Loading identities…</div>}
      {error && <div style={{ color: "red", marginBottom: "0.5rem" }}>{error}</div>}

      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        {/* Liste des identités */}
        <div style={{ flex: 1, maxHeight: "300px", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Name</th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Class</th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Status</th>
                <th style={{ borderBottom: "1px solid #ccc", textAlign: "left" }}>Issued by</th>
              </tr>
            </thead>
            <tbody>
              {identities.map((idn) => (
                <tr
                  key={idn.agent_id}
                  style={{
                    cursor: "pointer",
                    backgroundColor:
                      selectedIdentity && selectedIdentity.agent_id === idn.agent_id
                        ? "#eef"
                        : "transparent",
                  }}
                  onClick={() => onSelectIdentity(idn)}
                >
                  <td style={{ borderBottom: "1px solid #eee" }}>{idn.agent_name}</td>
                  <td style={{ borderBottom: "1px solid #eee" }}>{idn.agent_class}</td>
                  <td style={{ borderBottom: "1px solid #eee" }}>{idn.status}</td>
                  <td style={{ borderBottom: "1px solid #eee" }}>{idn.issued_by || ""}</td>
                </tr>
              ))}
              {identities.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} style={{ padding: "0.5rem" }}>
                    No identities found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <button
            type="button"
            style={{ marginTop: "0.5rem" }}
            onClick={() => onSelectIdentity(null)}
          >
            New identity
          </button>
        </div>

        {/* Formulaire détail / édition */}
        <div style={{ flex: 1 }}>
          <h3>{form.agent_id ? "Edit identity" : "New identity"}</h3>
          <form onSubmit={handleUpsert}>
            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Agent ID (read-only):
                <br />
                <input type="text" value={form.agent_id} readOnly style={{ width: "100%" }} />
              </label>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Agent name:
                <br />
                <input
                  type="text"
                  value={form.agent_name}
                  onChange={(e) => updateFormField("agent_name", e.target.value)}
                  style={{ width: "100%" }}
                  required
                />
              </label>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Agent class:
                <br />
                <input
                  type="text"
                  value={form.agent_class}
                  onChange={(e) => updateFormField("agent_class", e.target.value)}
                  style={{ width: "100%" }}
                  required
                />
              </label>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Description:
                <br />
                <textarea
                  value={form.description}
                  onChange={(e) => updateFormField("description", e.target.value)}
                  style={{ width: "100%", minHeight: "60px" }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                <label>
                  Owner human ID:
                  <br />
                  <input
                    type="text"
                    value={form.owner_human_id}
                    onChange={(e) => updateFormField("owner_human_id", e.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
              <div style={{ flex: 1 }}>
                <label>
                  Owner group ID:
                  <br />
                  <input
                    type="text"
                    value={form.owner_group_id}
                    onChange={(e) => updateFormField("owner_group_id", e.target.value)}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>
            </div>

            <div style={{ marginBottom: "0.5rem", marginTop: "0.5rem" }}>
              <label>
                Operator ID:
                <br />
                <input
                  type="text"
                  value={form.operator_id}
                  onChange={(e) => updateFormField("operator_id", e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Domains (JSON array):
                <br />
                <textarea
                  value={form.domains}
                  onChange={(e) => updateFormField("domains", e.target.value)}
                  style={{ width: "100%", minHeight: "60px", fontFamily: "monospace" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Permissions (JSON object):
                <br />
                <textarea
                  value={form.permissions}
                  onChange={(e) => updateFormField("permissions", e.target.value)}
                  style={{ width: "100%", minHeight: "60px", fontFamily: "monospace" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Constraints (JSON object):
                <br />
                <textarea
                  value={form.constraints}
                  onChange={(e) => updateFormField("constraints", e.target.value)}
                  style={{ width: "100%", minHeight: "60px", fontFamily: "monospace" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Issued by:
                <br />
                <input
                  type="text"
                  value={form.issued_by}
                  onChange={(e) => updateFormField("issued_by", e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Valid until (ISO):
                <br />
                <input
                  type="text"
                  value={form.valid_until}
                  onChange={(e) => updateFormField("valid_until", e.target.value)}
                  style={{ width: "100%" }}
                  placeholder="2026-12-31T23:59:59Z"
                />
              </label>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Profile (JSON object):
                <br />
                <textarea
                  value={form.profile}
                  onChange={(e) => updateFormField("profile", e.target.value)}
                  style={{ width: "100%", minHeight: "60px", fontFamily: "monospace" }}
                />
              </label>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Status:
                <br />
                <select
                  value={form.status}
                  onChange={(e) => updateFormField("status", e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="revoked">revoked</option>
                  <option value="expired">expired</option>
                </select>
              </label>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Metadata (JSON object):
                <br />
                <textarea
                  value={form.metadata}
                  onChange={(e) => updateFormField("metadata", e.target.value)}
                  style={{ width: "100%", minHeight: "60px", fontFamily: "monospace" }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button type="submit">Save / Upsert</button>
              {selectedIdentity && (
                <>
                  <button type="button" onClick={() => handleStatusChange("active")}>
                    Set active
                  </button>
                  <button type="button" onClick={() => handleStatusChange("suspended")}>
                    Suspend
                  </button>
                  <button type="button" onClick={() => handleStatusChange("revoked")}>
                    Revoke
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: "24px",
    maxWidth: "960px",
    margin: "0 auto",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#111827",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    marginBottom: "24px",
  },
  section: {
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "16px 20px",
    marginBottom: "24px",
    background: "#f9fafb",
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: 600,
    marginBottom: "12px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  row: {
    display: "flex",
    flexDirection: "column",
    marginBottom: "8px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 500,
    marginBottom: "2px",
  },
  input: {
    fontSize: "14px",
    padding: "6px 8px",
    borderRadius: "4px",
    border: "1px solid #d1d5db",
    fontFamily: "inherit",
  },
  textarea: {
    fontSize: "14px",
    padding: "6px 8px",
    borderRadius: "4px",
    border: "1px solid #d1d5db",
    fontFamily: "monospace",
  },
  button: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#2563eb",
    color: "white",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  buttonSecondary: {
    padding: "8px 12px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#6b7280",
    color: "white",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  error: {
    marginTop: "8px",
    padding: "8px",
    borderRadius: "4px",
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    fontSize: "13px",
  },
  subSection: {
    marginTop: "16px",
  },
  subTitle: {
    fontSize: "15px",
    fontWeight: 600,
    marginBottom: "4px",
  },
  pre: {
    fontSize: "12px",
    background: "#111827",
    color: "#e5e7eb",
    padding: "8px",
    borderRadius: "4px",
    maxHeight: "260px",
    overflow: "auto",
  },
  preSmall: {
    fontSize: "11px",
    background: "#111827",
    color: "#e5e7eb",
    padding: "6px",
    borderRadius: "4px",
    maxHeight: "160px",
    overflow: "auto",
  },
  eventsContainer: {
    marginTop: "8px",
    maxHeight: "400px",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  eventCard: {
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
    background: "white",
    padding: "8px",
  },
  eventHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
    fontSize: "11px",
    color: "#6b7280",
  },
  eventType: {
    fontWeight: 600,
  },
  eventTime: {
    fontFamily: "monospace",
  },
  empty: {
    fontSize: "13px",
    color: "#6b7280",
  },
};
