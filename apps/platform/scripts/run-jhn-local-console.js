import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { createJhnLocalOperationalAgent } from "../mcp/cop/jhnLocalOperationalAgent.js";
import { createOpenAIJhnReasoner } from "../mcp/cop/jhnReasoner.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const stateDirectory = path.resolve(scriptDirectory, "..", "instances", "jhn-cop-local");
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
const page = `<!doctype html><meta charset="utf-8"><title>John local</title><style>body{max-width:48rem;margin:2rem auto;font:16px system-ui}#log{white-space:pre-wrap}form{display:flex;gap:.5rem}input{flex:1}</style><h1>John local</h1><div id="log"></div><form><input autofocus placeholder="Parlez à John"><button>Envoyer</button></form><script>const log=document.querySelector('#log'),form=document.querySelector('form'),input=document.querySelector('input');form.onsubmit=async e=>{e.preventDefault();const message=input.value.trim();if(!message)return;log.textContent+='Vous> '+message+'\\n';input.value='';const r=await fetch('/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message,conversationId:'john'})});const b=await r.json();log.textContent+='John> '+(b.text||b.error)+'\\n';};</script>`;
const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/") {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(page);
    return;
  }
  if (request.method === "POST" && request.url === "/chat") {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const { message, conversationId = "john" } = JSON.parse(
        Buffer.concat(chunks).toString("utf8")
      );
      const result = await agent.turn({ message, conversationId });
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify({ text: result.text }));
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  response.writeHead(404).end();
});
server.listen(8788, "127.0.0.1", () => console.log("John local console: http://127.0.0.1:8788"));
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () =>
    server.close(() => {
      agent.close();
      process.exit(0);
    })
  );
