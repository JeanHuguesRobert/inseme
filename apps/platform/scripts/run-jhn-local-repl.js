import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import OpenAI from "openai";
import { createJhnLocalOperationalAgent } from "../mcp/cop/jhnLocalOperationalAgent.js";
import { createOpenAIJhnReasoner } from "../mcp/cop/jhnReasoner.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const stateDirectory = path.resolve(scriptDirectory, "..", "instances", "jhn-cop-local");
const conversationId = process.argv[2] ?? "john";

if (!process.env.OPENAI_API_KEY) {
  const env = await readFile(path.resolve(scriptDirectory, "..", "..", "..", ".env"), "utf8");
  const match = env.match(/^\s*OPENAI_API_KEY\s*=\s*([^\r\n#]+)\s*$/m);
  if (match) process.env.OPENAI_API_KEY = match[1].trim().replace(/^['"]|['"]$/g, "");
}
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is unavailable");

const reasoner = createOpenAIJhnReasoner({
  client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
});
const agent = createJhnLocalOperationalAgent({ stateDirectory, reasoner });
const readline = createInterface({ input: stdin, output: stdout });

console.log(`John local — conversation ${conversationId}. Type /exit to stop.`);
try {
  for (;;) {
    const message = (await readline.question("You> ")).trim();
    if (message === "/exit" || message === "/quit") break;
    if (!message) continue;
    const result = await agent.turn({ message, conversationId });
    console.log(`John> ${result.text}`);
  }
} finally {
  readline.close();
  agent.close();
}
