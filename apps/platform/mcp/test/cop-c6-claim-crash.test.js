import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// C6 probes a real limitation of C5: a claim is not proof of an effect.
// Synthetic only: no external provider or irreversible side effects.
test("C6: crash after claim is uncertain, not completed or silently replayed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cop-c6-"));
  const claim = join(dir, "claim");
  const effect = join(dir, "effect");
  try {
    const first = await open(claim, "wx");
    await first.writeFile(JSON.stringify({ intent:"c6-same-intent", state:"claimed" }));
    await first.close();
    // Crash boundary: no effect and no completion receipt.
    await assert.rejects(readFile(effect), { code: "ENOENT" });
    const recovered = JSON.parse(await readFile(claim, "utf8"));
    assert.equal(recovered.state, "claimed");

    // Conservative recovery cannot infer completion from the surviving claim.
    const outcome = {
      schema:"cop.c6.outcome/v1", intent: recovered.intent,
      status:"indeterminate", reason:"claim exists without verified effect",
      automatic_retry_allowed:false,
    };
    await writeFile(join(dir, "outcome.json"), JSON.stringify(outcome));
    assert.equal(outcome.status, "indeterminate");
    assert.equal(outcome.automatic_retry_allowed, false);
    await assert.rejects(readFile(effect), { code: "ENOENT" });

    // A separately supplied authoritative observation can resolve uncertainty.
    await writeFile(effect, "synthetic provider-confirmed effect");
    const confirmed = (await readFile(effect, "utf8")).startsWith("synthetic provider-confirmed");
    assert.equal(confirmed, true);
    assert.equal(JSON.parse(await readFile(join(dir, "outcome.json"), "utf8")).status,
      "indeterminate", "history is preserved; later knowledge does not rewrite the first outcome");
  } finally {
    await rm(dir, { recursive:true, force:true });
  }
});
