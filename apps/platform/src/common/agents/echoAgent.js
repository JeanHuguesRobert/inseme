// echoAgent.js
import { createAgentContext } from "../../../../../packages/cop-kernel/src/agentContext.js";

export async function echoAgentHandler(msg, runtimeOptions) {
  const ctx = createAgentContext({ msg, ...runtimeOptions });

  await ctx.log("received", "in", { payload: msg.payload });

  await ctx.reply({
    intent: "echo.response",
    payload: { echo: msg.payload },
  });
}
