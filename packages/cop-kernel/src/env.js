// File: packages/cop-kernel/src/env.js
// Description:
//   Small helper to read environment variables in both Node (process.env)
//   and Deno (Deno.env.get).
// TODO: should be configurable, ie user should be able to provide the .get() function to use.
// at some "init" time.

export function getEnv(name) {
  // Deno (Netlify Edge, etc.)
  try {
    // Netlify first
    if (
      typeof globalThis !== "undefined" &&
      globalThis.Netlify &&
      globalThis.Netlify.env &&
      typeof globalThis.Netlify.env.get === "function"
    ) {
      const v = globalThis.Netlify.env.get(name);
      if (typeof v === "string") return v;
    }

    if (
      typeof globalThis !== "undefined" &&
      globalThis.Deno &&
      globalThis.Deno.env &&
      typeof globalThis.Deno.env.get === "function"
    ) {
      const v = globalThis.Deno.env.get(name);
      if (typeof v === "string") return v;
    }
  } catch (_err) {
    // ignore
  }

  // Node.js
  if (
    typeof process !== "undefined" &&
    process.env &&
    Object.prototype.hasOwnProperty.call(process.env, name)
  ) {
    return process.env[name];
  }

  return undefined;
}
