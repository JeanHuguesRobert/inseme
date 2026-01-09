/**
 * packages/brique-ophelia/edge/lib/openai_compat.js
 * Couche de compatibilité pour exposer Ophélia comme une API OpenAI.
 */

import { runOperator } from "./operator_v2.js";
import { createAIClient, resolveModel } from "./providers.js";
import { resolveIdentity } from "../identity.js";
import { getRole } from "../roles/registry.js";

export async function handleOpenAIRequest(request, runtime) {
  const { json, error } = runtime;
  const body = await request.json();

  // Mapping OpenAI -> Ophélia
  const normalizedBody = {
    question: body.messages[body.messages.length - 1].content,
    messages: body.messages.slice(0, -1),
    model: body.model,
    stream: body.stream || false,
  };

  const identity = resolveIdentity(runtime);
  const role = getRole("analyst"); // Default for external API
  const provider = "openai"; // For external compat, we default to OpenAI
  const openai = createAIClient(runtime, provider);
  const encoder = new TextEncoder();

  if (normalizedBody.stream) {
    const readable = new ReadableStream({
      async start(controller) {
        await runOperator(runtime, normalizedBody, {
          openai,
          identity,
          role,
          encoder,
          controller,
        });
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream" },
    });
  } else {
    // Non-streaming handling (TODO)
    return error(
      "Non-streaming mode not yet implemented for compatibility layer",
      501
    );
  }
}
