import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJhnLocalOperationalAgent } from "../mcp/cop/jhnLocalOperationalAgent.js";
import { createOpenAIJhnReasoner } from "../mcp/cop/jhnReasoner.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

async function loadLocalOpenAIKey() {
  if (process.env.OPENAI_API_KEY) return;
  const environmentPath = path.resolve(scriptDirectory, "..", "..", "..", ".env");
  const environment = await readFile(environmentPath, "utf8");
  const match = environment.match(/^\s*OPENAI_API_KEY\s*=\s*([^\r\n#]+)\s*$/m);
  if (match) process.env.OPENAI_API_KEY = match[1].trim().replace(/^['"]|['"]$/g, "");
}

await loadLocalOpenAIKey();

const messageIndex = process.argv.indexOf("--message");
const message = messageIndex === -1 ? null : process.argv[messageIndex + 1];
const conversationIndex = process.argv.indexOf("--conversation");
const conversationId = conversationIndex === -1 ? "john" : process.argv[conversationIndex + 1];
if (!message) throw new Error("Usage: node scripts/run-jhn-local-chat.js --message <text>");
if (!process.env.OPENAI_API_KEY)
  throw new Error("OPENAI_API_KEY is not available to the local agent process");

const reasoner = createOpenAIJhnReasoner({
  client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
});
const stateDirectory = path.resolve(scriptDirectory, "..", "instances", "jhn-cop-local");
const agent = createJhnLocalOperationalAgent({ stateDirectory, reasoner });

try {
  const result = await agent.turn({ message, conversationId });
  console.log(result.text);
} catch (error) {
  const status = error?.status;
  if (status === 401) console.error("OpenAI authentication failed; no key material was printed.");
  else if (status === 429) console.error("OpenAI quota or rate limit prevented the JHN test.");
  else console.error(`JHN local chat failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  agent.close();
}
