import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmbeddingServiceConfig,
  handleEmbeddingRequest,
  publicEmbeddingStatus,
} from "../pilots/reference-js/src/embedding-service.js";

const config = createEmbeddingServiceConfig({
  MAGISTRAL_EMBEDDINGS_ENABLED: "true",
  MAGISTRAL_EMBEDDING_PROVIDER: "openai",
  MAGISTRAL_EMBEDDING_MODEL: "text-embedding-3-small",
  MAGISTRAL_EMBEDDING_DIMENSIONS: "3",
  OPENAI_API_KEY: "test-key",
});

test("Deno embedding service advertises only non-secret operational status", () => {
  const status = publicEmbeddingStatus(config);
  assert.equal(status.configured, true);
  assert.equal(JSON.stringify(status).includes("test-key"), false);
});

test("Deno embedding service returns an OpenAI-compatible vector response", async () => {
  const result = await handleEmbeddingRequest(
    { model: "text-embedding-3-small", input: "public query", dimensions: 3 },
    config,
    async () =>
      new Response(
        JSON.stringify({
          model: "text-embedding-3-small",
          data: [{ embedding: [0.1, 0.2, 0.3] }],
          usage: { prompt_tokens: 2, total_tokens: 2 },
        }),
        { status: 200 },
      ),
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data[0].embedding, [0.1, 0.2, 0.3]);
});

test("Deno embedding service exposes safe provider diagnostics", async () => {
  const result = await handleEmbeddingRequest(
    { input: "public query" },
    config,
    async () => new Response("upstream failure", { status: 429 }),
  );
  assert.equal(result.status, 429);
  assert.deepEqual(result.body.error, {
    code: "embedding_provider_http_error",
    provider: "openai",
    model: "text-embedding-3-small",
    dimensions: 3,
    retryable: true,
    upstream_status: 429,
  });
});

test("Deno embedding service classifies a safe network failure reason", async () => {
  const networkError = new TypeError("fetch failed");
  networkError.cause = { code: "ENETUNREACH" };
  const result = await handleEmbeddingRequest(
    { input: "public query" },
    config,
    async () => {
      throw networkError;
    },
  );
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, "embedding_provider_unreachable");
  assert.equal(result.body.error.reason, "ENETUNREACH");
});

test("Cloudflare free profile refuses unverified plan, missing account and unknown models before network", async () => {
  const base = {
    MAGISTRAL_EMBEDDINGS_ENABLED:"true", MAGISTRAL_EMBEDDING_PROVIDER:"cloudflare",
    MAGISTRAL_EMBEDDING_MAX_BILLABLE_USD:"0", CLOUDFLARE_API_TOKEN:"fake-test-secret",
    CLOUDFLARE_ACCOUNT_ID:"0123456789abcdef0123456789abcdef",
  };
  let calls=0;
  const fake = async () => { calls++; throw new Error("must never call"); };
  let cfg = createEmbeddingServiceConfig(base);
  assert.equal((await handleEmbeddingRequest({input:"public text"},cfg,fake)).body.error.code,"cloudflare_free_plan_unverified");
  cfg = createEmbeddingServiceConfig({...base,MAGISTRAL_CLOUDFLARE_FREE_PLAN_VERIFIED:"true",CLOUDFLARE_ACCOUNT_ID:""});
  assert.equal((await handleEmbeddingRequest({input:"public text"},cfg,fake)).body.error.code,"cloudflare_account_unconfigured");
  cfg = createEmbeddingServiceConfig({...base,MAGISTRAL_CLOUDFLARE_FREE_PLAN_VERIFIED:"true",MAGISTRAL_EMBEDDING_MODEL:"made-up-model"});
  assert.equal((await handleEmbeddingRequest({input:"public text"},cfg,fake)).body.error.code,"cloudflare_model_profile_unsupported");
  assert.equal(calls,0);
});

test("Cloudflare mocked REST adapter prefixes Gemma documents and queries and never exposes credentials", async () => {
  const cfg = createEmbeddingServiceConfig({
    MAGISTRAL_EMBEDDINGS_ENABLED:"true",
    MAGISTRAL_EMBEDDING_PROVIDER:"cloudflare",
    MAGISTRAL_EMBEDDING_MAX_BILLABLE_USD:"0",
    MAGISTRAL_CLOUDFLARE_FREE_PLAN_VERIFIED:"1",
    CLOUDFLARE_ACCOUNT_ID:"0123456789abcdef0123456789abcdef",
    CLOUDFLARE_API_TOKEN:"fake-test-secret",
  });
  assert.equal(cfg.model,"@cf/google/embeddinggemma-2");
  assert.equal(cfg.dimensions,768);
  assert.equal(JSON.stringify(publicEmbeddingStatus(cfg)).includes("fake-test-secret"),false);
  const requests=[];
  const fake=async (url,init)=>{
    const payload=JSON.parse(init.body);
    requests.push({url,payload});
    return new Response(JSON.stringify({success:true,result:{
      model:cfg.model,
      data:payload.input.map((_,index)=>({index,embedding:Array(768).fill(index===0 ? 0.1 : 0.2)})),
      usage:{prompt_tokens:19},
    }}),{status:200});
  };
  const doc=await handleEmbeddingRequest({input:["Bonjour","Hello"],embedding_role:"document"},cfg,fake);
  assert.equal(doc.status,200);
  assert.equal(doc.body.data.length,2);
  assert.equal(doc.body.usage.prompt_tokens,19);
  assert.equal(requests[0].url,"https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/run/@cf/google/embeddinggemma-2");
  assert.equal(requests[0].payload.input[0],"title: none | text: Bonjour");
  assert.equal(Object.hasOwn(requests[0].payload,"dimensions"),false);
  const query=await handleEmbeddingRequest({input:"Bonjour",embedding_role:"query"},cfg,fake);
  assert.equal(query.status,200);
  assert.equal(requests[1].payload.input[0],"task: search result | query: Bonjour");
});

test("Cloudflare 429 carries bounded Retry-After without exposing sensitive response", async () => {
  const cfg = createEmbeddingServiceConfig({
    MAGISTRAL_EMBEDDINGS_ENABLED:"1",
    MAGISTRAL_EMBEDDING_PROVIDER:"cloudflare",
    MAGISTRAL_EMBEDDING_MAX_BILLABLE_USD:"0",
    MAGISTRAL_CLOUDFLARE_FREE_PLAN_VERIFIED:"1",
    CLOUDFLARE_ACCOUNT_ID:"0123456789abcdef0123456789abcdef",
    CLOUDFLARE_API_TOKEN:"fake-test-secret",
  });
  const result=await handleEmbeddingRequest({input:"text"},cfg,
    async()=>new Response("sensitive upstream text",{status:429,headers:{"Retry-After":"31"}}));
  assert.equal(result.status,429);
  assert.equal(result.body.error.retry_after_seconds,31);
  assert.equal(result.body.error.retryable,true);
  assert.equal(JSON.stringify(result).includes("sensitive upstream text"),false);
});

test("OpenAI route refuses any request under zero monetary ceiling", async () => {
  const cfg=createEmbeddingServiceConfig({
    MAGISTRAL_EMBEDDINGS_ENABLED:"true",
    MAGISTRAL_EMBEDDING_PROVIDER:"openai",
    OPENAI_API_KEY:"fake-test-secret",
    MAGISTRAL_EMBEDDING_MAX_BILLABLE_USD:"0",
  });
  const result=await handleEmbeddingRequest({input:"text"},cfg,
    async()=>{throw new Error("should not call");});
  assert.equal(result.body.error.code,"monetary_budget_exhausted");
});
