import test from "node:test";
import assert from "node:assert/strict";
import {
  getConfig,
  getAllConfigKeys,
  resolveHostChain,
  resolveInstanceId,
  setCurrentInstance,
  initializeInstanceCore,
} from "../src/config/instanceConfig.core.js";

// Helper to set up mock cache state for testing without real Supabase connection
function setupMockConfigState({
  instances = [],
  aliases = [],
  configs = {},
  flatConfig = {},
  envVars = {},
}) {
  const rootInstanceId = "00000000-0000-0000-0000-000000000001";
  const GLOBAL_CACHE_KEY = "__INSTANCE_DATA_CACHE_V1__";

  const instancesMeta = Object.create(null);
  const aliasesMap = Object.create(null);
  const instancesConfig = Object.create(null);

  for (const inst of instances) {
    if (inst?.id) {
      instancesMeta[inst.id] = inst;
      if (inst.slug) aliasesMap[inst.slug.toLowerCase()] = inst.id;
      if (inst.canonical_slug) aliasesMap[inst.canonical_slug.toLowerCase()] = inst.id;
    }
  }

  for (const a of aliases) {
    if (a?.alias && a?.instance_id) {
      aliasesMap[a.alias.toLowerCase()] = a.instance_id;
    }
  }

  for (const [instId, entries] of Object.entries(configs)) {
    instancesConfig[instId] = Object.create(null);
    for (const [k, v] of Object.entries(entries)) {
      instancesConfig[instId][k.toLowerCase()] =
        typeof v === "object" && v !== null && !v.value
          ? { key: k, value: null, value_json: v }
          : { key: k, value: String(v), value_json: null };
    }
  }

  const flatMap = Object.create(null);
  for (const [k, v] of Object.entries(flatConfig)) {
    flatMap[k.toLowerCase()] = { key: k, value: String(v), value_json: null };
  }

  globalThis[GLOBAL_CACHE_KEY] = {
    config: flatMap,
    instancesConfig,
    aliasesMap,
    instancesMeta,
    currentInstanceId: rootInstanceId,
    inFlight: null,
    loadedAt: Date.now(),
    supabase: {},
    factory: () => ({}),
    getenv: (k) => envVars[k],
    data: {},
  };
}

test("1. A hosted instance with no local value for MODEL resolves the host value", () => {
  const rootId = "00000000-0000-0000-0000-000000000001";
  const hostId = "11111111-1111-1111-1111-111111111111";
  const childId = "22222222-2222-2222-2222-222222222222";

  setupMockConfigState({
    instances: [
      { id: rootId, slug: "root" },
      { id: hostId, slug: "host-agent", host_instance_id: rootId },
      { id: childId, slug: "provisional-twin", host_instance_id: hostId },
    ],
    configs: {
      [hostId]: {
        MODEL: "gemini-3.7-flash",
      },
      [childId]: {
        // No local MODEL set
      },
    },
  });

  const resolvedModel = getConfig("MODEL", undefined, childId);
  assert.equal(resolvedModel, "gemini-3.7-flash");
});

test("2. A hosted instance overriding MODEL gets its own value without altering the host", () => {
  const rootId = "00000000-0000-0000-0000-000000000001";
  const hostId = "11111111-1111-1111-1111-111111111111";
  const childId = "22222222-2222-2222-2222-222222222222";

  setupMockConfigState({
    instances: [
      { id: rootId, slug: "root" },
      { id: hostId, slug: "host-agent", host_instance_id: rootId },
      { id: childId, slug: "provisional-twin", host_instance_id: hostId },
    ],
    configs: {
      [hostId]: {
        MODEL: "gemini-3.7-flash",
      },
      [childId]: {
        MODEL: "claude-3-5-sonnet",
      },
    },
  });

  assert.equal(getConfig("MODEL", undefined, childId), "claude-3-5-sonnet");
  assert.equal(getConfig("MODEL", undefined, hostId), "gemini-3.7-flash");
});

test("3. A grandchild instance inherits through two host levels", () => {
  const rootId = "00000000-0000-0000-0000-000000000001";
  const parentId = "11111111-1111-1111-1111-111111111111";
  const childId = "22222222-2222-2222-2222-222222222222";
  const grandchildId = "33333333-3333-3333-3333-333333333333";

  setupMockConfigState({
    instances: [
      { id: rootId, slug: "root" },
      { id: parentId, slug: "jhn-twin", host_instance_id: rootId },
      { id: childId, slug: "corsica-twin", host_instance_id: parentId },
      { id: grandchildId, slug: "oleole-actor-provisional", host_instance_id: childId },
    ],
    configs: {
      [parentId]: {
        EMBEDDING_PROVIDER: "voyage-ai",
        BASE_TIMEOUT_MS: "5000",
      },
      [childId]: {
        BASE_TIMEOUT_MS: "8000", // Child overrides timeout
      },
      [grandchildId]: {
        LOCAL_FLAG: "active",
      },
    },
  });

  // Grandchild resolves EMBEDDING_PROVIDER from grandparent (parentId)
  assert.equal(getConfig("EMBEDDING_PROVIDER", undefined, grandchildId), "voyage-ai");
  // Grandchild resolves BASE_TIMEOUT_MS from parent (childId) override
  assert.equal(getConfig("BASE_TIMEOUT_MS", undefined, grandchildId), "8000");
  // Grandchild resolves its own local flag
  assert.equal(getConfig("LOCAL_FLAG", undefined, grandchildId), "active");
});

test("4. A host cycle is rejected and fails closed safely", () => {
  const instA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const instB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const instC = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  setupMockConfigState({
    instances: [
      { id: instA, slug: "a", host_instance_id: instB },
      { id: instB, slug: "b", host_instance_id: instC },
      { id: instC, slug: "c", host_instance_id: instA }, // Circular reference A -> B -> C -> A
    ],
    configs: {
      [instA]: { KEY_A: "valA" },
      [instB]: { KEY_B: "valB" },
      [instC]: { KEY_C: "valC" },
    },
  });

  const chainA = resolveHostChain(instA);
  assert.deepEqual(chainA, [instA, instB, instC]);

  // Looking for missing key should safely return default, never hang or throw
  assert.equal(getConfig("NON_EXISTENT_KEY", "fallback_default", instA), "fallback_default");
  // Existing keys in the chain resolve correctly
  assert.equal(getConfig("KEY_B", undefined, instA), "valB");
});

test("5. Sibling instances cannot read each other's config", () => {
  const rootId = "00000000-0000-0000-0000-000000000001";
  const sibling1 = "11111111-1111-1111-1111-111111111111";
  const sibling2 = "22222222-2222-2222-2222-222222222222";

  setupMockConfigState({
    instances: [
      { id: rootId, slug: "root" },
      { id: sibling1, slug: "sibling-1", host_instance_id: rootId },
      { id: sibling2, slug: "sibling-2", host_instance_id: rootId },
    ],
    configs: {
      [sibling1]: {
        PRIVATE_SIBLING_DATA: "secret_1",
      },
      [sibling2]: {
        OTHER_DATA: "secret_2",
      },
    },
  });

  // sibling2 cannot resolve PRIVATE_SIBLING_DATA from sibling1
  assert.equal(getConfig("PRIVATE_SIBLING_DATA", undefined, sibling2), undefined);
  assert.equal(getConfig("PRIVATE_SIBLING_DATA", "none", sibling2), "none");
});

test("6. Non-inheritable keys do NOT leak from host to child instances", () => {
  const rootId = "00000000-0000-0000-0000-000000000001";
  const hostId = "11111111-1111-1111-1111-111111111111";
  const childId = "22222222-2222-2222-2222-222222222222";

  setupMockConfigState({
    instances: [
      { id: rootId, slug: "root" },
      { id: hostId, slug: "host-twin", host_instance_id: rootId },
      { id: childId, slug: "provisional-child", host_instance_id: hostId },
    ],
    configs: {
      [hostId]: {
        bot_name: "Agent John",
        community_name: "Mariani Village",
        MODEL: "deepseek-r1",
      },
      [childId]: {
        bot_name: "Provisional Actor Twin",
      },
    },
  });

  // bot_name is non-inheritable: child gets its own, doesn't get parent's if not set
  assert.equal(getConfig("bot_name", undefined, childId), "Provisional Actor Twin");
  // community_name is not set on child, and being non-inheritable, host's community_name is NOT inherited
  assert.equal(getConfig("community_name", undefined, childId), undefined);
  // inheritable MODEL key is inherited
  assert.equal(getConfig("MODEL", undefined, childId), "deepseek-r1");
});

test("7. getAllConfigKeys gathers inheritable keys across host chain", () => {
  const rootId = "00000000-0000-0000-0000-000000000001";
  const parentId = "11111111-1111-1111-1111-111111111111";
  const childId = "22222222-2222-2222-2222-222222222222";

  setupMockConfigState({
    instances: [
      { id: rootId, slug: "root" },
      { id: parentId, slug: "parent", host_instance_id: rootId },
      { id: childId, slug: "child", host_instance_id: parentId },
    ],
    configs: {
      [parentId]: {
        PARENT_KEY: "p_val",
        bot_name: "ParentBot", // non-inheritable
      },
      [childId]: {
        CHILD_KEY: "c_val",
        bot_name: "ChildBot",
      },
    },
  });

  const keys = getAllConfigKeys(childId);
  assert.ok(keys.includes("child_key"));
  assert.ok(keys.includes("bot_name"));
  assert.ok(keys.includes("parent_key"));
});


test("8. JHN Principal and delegate subjects are instance-local", () => {
  const rootId = "00000000-0000-0000-0000-000000000001";
  const childId = "22222222-2222-2222-2222-222222222222";
  const keys = [
    "nasa_principal_subject",
    "nasa_operator_subjects",
    "interactions_desk_principal_subject",
    "interactions_desk_operator_subjects",
  ];
  const parentConfig = Object.fromEntries(keys.map((key) => [key, "root-subject"]));
  setupMockConfigState({
    instances: [
      { id: rootId, canonical_slug: "jhn" },
      { id: childId, canonical_slug: "child", host_instance_id: rootId },
    ],
    configs: { [rootId]: parentConfig },
    flatConfig: parentConfig,
  });

  for (const key of keys) {
    assert.equal(getConfig(key, undefined, "jhn"), "root-subject");
    assert.equal(getConfig(key, undefined, "child"), undefined);
    assert.ok(!getAllConfigKeys("child").includes(key));
  }

  setupMockConfigState({
    instances: [
      { id: rootId, canonical_slug: "jhn" },
      { id: childId, canonical_slug: "child", host_instance_id: rootId },
    ],
    configs: {
      [rootId]: parentConfig,
      [childId]: { nasa_principal_subject: "child-subject" },
    },
    flatConfig: parentConfig,
  });
  assert.equal(getConfig("nasa_principal_subject", undefined, "child"), "child-subject");
  assert.equal(getConfig("nasa_principal_subject", undefined, "jhn"), "root-subject");
});
