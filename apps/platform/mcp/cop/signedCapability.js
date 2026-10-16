const TOKEN_PREFIX = "copcap.v1";
const ED25519 = { name: "Ed25519" };

export class CopCapabilityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CopCapabilityError";
    this.code = code;
  }
}

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new CopCapabilityError("COP_INVALID_CAPABILITY", "Capability encoding is invalid");
  }
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    const decoded = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    if (base64UrlEncode(decoded) !== value) {
      throw new CopCapabilityError(
        "COP_INVALID_CAPABILITY",
        "Capability encoding is not canonical"
      );
    }
    return decoded;
  } catch {
    throw new CopCapabilityError("COP_INVALID_CAPABILITY", "Capability encoding is invalid");
  }
}

function parseJson(bytes, description) {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new CopCapabilityError("COP_INVALID_CAPABILITY", `${description} is not valid JSON`);
  }
}

function epochSeconds(clock) {
  return Math.floor(clock().getTime() / 1000);
}

async function verificationKey(key) {
  if (key?.kty) return globalThis.crypto.subtle.importKey("jwk", key, ED25519, false, ["verify"]);
  return key;
}

function validateClaims(claims, { audience, clock }) {
  requireText(claims?.issuer, "capability issuer");
  requireText(claims?.subject, "capability subject");
  requireText(claims?.mandateRef, "capability mandateRef");
  if (claims.audience !== audience) {
    throw new CopCapabilityError(
      "COP_CAPABILITY_AUDIENCE_MISMATCH",
      "Capability audience is not accepted here"
    );
  }
  if (!Number.isInteger(claims.mandateVersion)) {
    throw new CopCapabilityError("COP_INVALID_CAPABILITY", "Capability mandateVersion is invalid");
  }
  if (![claims.issuedAt, claims.notBefore, claims.expiresAt].every(Number.isFinite)) {
    throw new CopCapabilityError("COP_INVALID_CAPABILITY", "Capability times are invalid");
  }
  const now = epochSeconds(clock);
  if (claims.issuedAt > now || claims.notBefore > now) {
    throw new CopCapabilityError("COP_CAPABILITY_NOT_YET_VALID", "Capability is not valid yet");
  }
  if (claims.expiresAt <= now) {
    throw new CopCapabilityError("COP_CAPABILITY_EXPIRED", "Capability has expired");
  }
}

/** Sign a short-lived, audience-bound reference to a current mandate. */
export async function signCopCapability({
  privateKey,
  keyId,
  issuer,
  subject,
  mandateRef,
  mandateVersion,
  audience,
  issuedAt,
  notBefore = issuedAt,
  expiresAt,
  nonce,
} = {}) {
  if (!privateKey) throw new TypeError("privateKey is required");
  const header = { alg: "Ed25519", kid: requireText(keyId, "keyId"), typ: "COPCAP" };
  const claims = {
    issuer: requireText(issuer, "issuer"),
    subject: requireText(subject, "subject"),
    mandateRef: requireText(mandateRef, "mandateRef"),
    mandateVersion,
    audience: requireText(audience, "audience"),
    issuedAt,
    notBefore,
    expiresAt,
    nonce: requireText(nonce, "nonce"),
  };
  validateClaims(claims, { audience, clock: () => new Date(issuedAt * 1000) });
  const encoder = new TextEncoder();
  const signed = `${TOKEN_PREFIX}.${base64UrlEncode(encoder.encode(JSON.stringify(header)))}.${base64UrlEncode(
    encoder.encode(JSON.stringify(claims))
  )}`;
  const signature = await globalThis.crypto.subtle.sign(
    ED25519,
    privateKey,
    encoder.encode(signed)
  );
  return `${signed}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Verify a capability signature and its local, time and audience constraints. */
export async function verifyCopCapability(
  token,
  { publicKeys, audience, clock = () => new Date() } = {}
) {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 5 || `${parts[0]}.${parts[1]}` !== TOKEN_PREFIX) {
    throw new CopCapabilityError("COP_INVALID_CAPABILITY", "Capability format is invalid");
  }
  const header = parseJson(base64UrlDecode(parts[2]), "Capability header");
  const claims = parseJson(base64UrlDecode(parts[3]), "Capability payload");
  if (header.alg !== "Ed25519" || header.typ !== "COPCAP" || typeof header.kid !== "string") {
    throw new CopCapabilityError("COP_INVALID_CAPABILITY", "Capability header is not supported");
  }
  const publicKey = publicKeys?.[header.kid];
  if (!publicKey)
    throw new CopCapabilityError("COP_UNKNOWN_CAPABILITY_KEY", "Capability signing key is unknown");
  const verified = await globalThis.crypto.subtle.verify(
    ED25519,
    await verificationKey(publicKey),
    base64UrlDecode(parts[4]),
    new TextEncoder().encode(parts.slice(0, 4).join("."))
  );
  if (!verified)
    throw new CopCapabilityError("COP_INVALID_CAPABILITY", "Capability signature is invalid");
  validateClaims(claims, { audience: requireText(audience, "audience"), clock });
  return { header, claims };
}

function bearerToken(request) {
  const authorization = request?.headers?.get?.("authorization") ?? request?.headers?.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length);
}

/**
 * Resolve an HTTP request to COP context without trusting its network path.
 * `resolveMandate` is the instance's authoritative current-state lookup: a
 * revoked, suspended, reassigned, or version-changed mandate invalidates an
 * otherwise authentic token immediately.
 */
export function createSignedCapabilityContextResolver({
  publicKeys,
  audience,
  resolveMandate,
  clock,
} = {}) {
  if (!publicKeys || typeof publicKeys !== "object") throw new TypeError("publicKeys are required");
  requireText(audience, "audience");
  if (typeof resolveMandate !== "function")
    throw new TypeError("resolveMandate(mandateRef) is required");

  return async (request) => {
    const token = bearerToken(request);
    if (!token) return null;
    const { claims } = await verifyCopCapability(token, { publicKeys, audience, clock });
    const mandate = await resolveMandate(claims.mandateRef);
    if (!mandate || mandate.status !== "active") {
      throw new CopCapabilityError("COP_MANDATE_INACTIVE", "Mandate is no longer active");
    }
    if (mandate.version !== claims.mandateVersion) {
      throw new CopCapabilityError(
        "COP_MANDATE_VERSION_MISMATCH",
        "Mandate version is no longer current"
      );
    }
    if (mandate.granteeRef && mandate.granteeRef !== claims.subject) {
      throw new CopCapabilityError(
        "COP_MANDATE_GRANTEE_MISMATCH",
        "Mandate no longer belongs to this principal"
      );
    }
    return { principal: { id: claims.subject, issuer: claims.issuer }, mandate, mandateRef: claims.mandateRef, mandateVersion: claims.mandateVersion };
  };
}
