/**
 * Provider-neutral, OpenAI-compatible embeddings capability for Magistral.
 *
 * Cloudflare is an opt-in transport. No default paid fallback, no account token
 * in status or logs. Provider availability is not COP authorization: the caller
 * must separately admit the semantic effect and reserve the applicable quota.
 */
const DEFAULT_OPENAI_URL = "https://api.openai.com/v1/embeddings";
const CLOUDFLARE_MODELS = Object.freeze({
  "@cf/google/embeddinggemma-2": 768,
  "@cf/qwen/qwen3-embedding-0.6b": 1024,
});

export function createEmbeddingServiceConfig(env = {}) {
  const provider = String(env.MAGISTRAL_EMBEDDING_PROVIDER || "openai").toLowerCase();
  const model = String(env.MAGISTRAL_EMBEDDING_MODEL || (
    provider === "cloudflare" ? "@cf/google/embeddinggemma-2" : "text-embedding-3-small"
  ));
  const defaultDimensions = provider === "cloudflare"
    ? CLOUDFLARE_MODELS[model] || 768 : 1536;
  return {
    enabled: parseBoolean(env.MAGISTRAL_EMBEDDINGS_ENABLED),
    provider,
    model,
    dimensions: boundedInteger(env.MAGISTRAL_EMBEDDING_DIMENSIONS, defaultDimensions, 1, 3072),
    policy: String(env.MAGISTRAL_EMBEDDING_POLICY ||
      (provider === "cloudflare" ? "cloudflare-document-prefix-v1" : "magistral-openai-embedding-v1")),
    timeout_ms: boundedInteger(env.MAGISTRAL_EMBEDDING_TIMEOUT_MS, 15000, 1000, 120000),
    openai_url: String(env.MAGISTRAL_EMBEDDING_OPENAI_URL || DEFAULT_OPENAI_URL),
    account_id: String(env.CLOUDFLARE_ACCOUNT_ID || "").trim(),
    // An operator's confirmation of the Free account, not a COP grant.
    free_plan_verified: parseBoolean(env.MAGISTRAL_CLOUDFLARE_FREE_PLAN_VERIFIED),
    max_billable_usd: String(env.MAGISTRAL_EMBEDDING_MAX_BILLABLE_USD ?? "").trim(),
    api_key: String(provider === "cloudflare"
      ? (env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_AUTH_TOKEN || "")
      : (env.OPENAI_API_KEY || env.COGENTIA_OPENAI_API_KEY || "")),
  };
}

export function publicEmbeddingStatus(config) {
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    dimensions: config.dimensions,
    policy: config.policy,
    configured: Boolean(config.api_key) && (
      config.provider !== "cloudflare" || validCloudflareAccount(config.account_id)
    ),
    free_plan_verified: config.provider === "cloudflare" ? config.free_plan_verified : null,
    budget_zero: config.max_billable_usd === "0",
    endpoint: "/v1/embeddings",
  };
}

export async function handleEmbeddingRequest(payload, config, fetchImpl = fetch) {
  if (!config.enabled) return failure(503, "embeddings_disabled", config);
  if (config.provider !== "openai" && config.provider !== "cloudflare") {
    return failure(503, "embedding_provider_unsupported", config);
  }
  // An unbounded OpenAI route cannot serve Cogentia's zero-money profile.
  if (config.provider === "openai" && config.max_billable_usd === "0") {
    return failure(503, "monetary_budget_exhausted", config);
  }
  if (config.provider === "cloudflare") {
    if (!Object.hasOwn(CLOUDFLARE_MODELS, config.model)
        || config.dimensions !== CLOUDFLARE_MODELS[config.model]) {
      return failure(503, "cloudflare_model_profile_unsupported", config);
    }
    // Cloudflare Workers Paid can charge automatically after the free daily
    // allocation; never dispatch with that uncertainty under a zero budget.
    if (config.max_billable_usd !== "0" || !config.free_plan_verified) {
      return failure(503, "cloudflare_free_plan_unverified", config);
    }
    if (!validCloudflareAccount(config.account_id)) {
      return failure(503, "cloudflare_account_unconfigured", config);
    }
  }
  if (!config.api_key) return failure(503, "embedding_provider_unconfigured", config);

  const input = payload?.input;
  const inputs = Array.isArray(input) ? input : input == null ? [] : [input];
  if (!inputs.length || !inputs.every(item => typeof item === "string" && item.trim())) {
    return failure(400, "invalid_embedding_input", config);
  }
  if (payload?.model && payload.model !== config.model) {
    return failure(400, "embedding_model_mismatch", config);
  }
  if (payload?.dimensions != null && Number(payload.dimensions) !== config.dimensions) {
    return failure(400, "embedding_dimensions_mismatch", config);
  }
  const role = payload?.embedding_role || "document";
  if (!["document", "query"].includes(role)) {
    return failure(400, "invalid_embedding_role", config);
  }

  const cloudflare = config.provider === "cloudflare";
  const target = cloudflare
    ? `https://api.cloudflare.com/client/v4/accounts/${config.account_id}/ai/v1/embeddings`
    : config.openai_url;
  const preparedInputs = cloudflare && config.model === "@cf/google/embeddinggemma-2"
    ? inputs.map(text => role === "query"
      ? `task: search result | query: ${text}`
      : `title: none | text: ${text}`)
    : inputs;

  let response;
  try {
    response = await fetchImpl(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: config.model, input: preparedInputs, dimensions: config.dimensions }),
      signal: AbortSignal.timeout(config.timeout_ms),
    });
  } catch (error) {
    return failure(503, "embedding_provider_unreachable", config, {
      retryable: true,
      reason: safeNetworkErrorReason(error),
    });
  }
  if (!response.ok) {
    const retryAfter = response.headers?.get?.("retry-after");
    const retrySeconds = /^\d+$/.test(String(retryAfter || ""))
      ? Math.min(Number(retryAfter), 86400) : null;
    return failure(response.status === 429 ? 429 : 502, "embedding_provider_http_error", config, {
      upstream_status: response.status,
      retryable: response.status === 429 || response.status >= 500,
      ...(retrySeconds != null ? { retry_after_seconds: retrySeconds } : {}),
    });
  }
  const body = await response.json().catch(() => null);
  if (body?.model && body.model !== config.model) {
    return failure(502, "embedding_response_model_mismatch", config);
  }
  const data = Array.isArray(body?.data) ? [...body.data] : [];
  if (data.length !== inputs.length) {
    return failure(502, "invalid_embedding_response", config);
  }
  // Provider responses may return the correct vectors out of order.
  if (data.some(item => item.index != null)) {
    if (!data.every(item => Number.isInteger(item.index) && item.index >= 0 && item.index < data.length)) {
      return failure(502, "invalid_embedding_index", config);
    }
    data.sort((a, b) => a.index - b.index);
    if (!data.every((item, index) => item.index === index)) {
      return failure(502, "invalid_embedding_index", config);
    }
  }
  if (data.some(item => !Array.isArray(item.embedding)
      || item.embedding.length !== config.dimensions
      || !item.embedding.every(value => typeof value === "number" && Number.isFinite(value)))) {
    return failure(502, "invalid_embedding_response", config);
  }
  return {
    status: 200,
    body: {
      object: "list",
      data: data.map((item, index) => ({ object: "embedding", index, embedding: item.embedding })),
      model: body.model || config.model,
      usage: body.usage || null,
    },
  };
}

function validCloudflareAccount(value) {
  return /^[a-f0-9]{32}$/i.test(value || "");
}

function safeNetworkErrorReason(error) {
  const causeCode = String(error?.cause?.code || "").trim();
  if (/^[A-Z][A-Z0-9_]{1,63}$/.test(causeCode)) return causeCode;
  const name = String(error?.name || "").trim();
  if (/^[A-Za-z][A-Za-z0-9_]{1,63}$/.test(name)) return name;
  return "network_error";
}

function failure(status, code, config, extra = {}) {
  return {
    status,
    body: {
      error: {
        code,
        provider: config.provider,
        model: config.model,
        dimensions: config.dimensions,
        retryable: false,
        ...extra,
      },
    },
  };
}

function parseBoolean(value) {
  return /^(?:1|true|yes)$/i.test(String(value || "").trim());
}

function boundedInteger(value, fallback, min, max) {
  const numeric = Number(value);
  return Number.isInteger(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
}
