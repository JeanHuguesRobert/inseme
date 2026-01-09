import { assertEquals, assert } from "jsr:@std/assert";
import { createDenoSqliteConnection } from "../../sqlite/deno-sqlite.js";

// Mock the Worker and its interactions
class MockWorker {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.onmessage = null;
    this.postMessageCalls = [];
  }

  postMessage(message) {
    this.postMessageCalls.push(message);
    // Simulate worker response for init, run, get, all, exec, close
    if (message.method === "init") {
      this.onmessage({ data: { id: message.id, result: { ok: true } } });
    } else if (message.method === "run") {
      this.onmessage({ data: { id: message.id, result: { rowsAffected: 1, lastInsertId: 1 } } });
    } else if (message.method === "get") {
      this.onmessage({ data: { id: message.id, result: { id: 1, name: "test" } } });
    } else if (message.method === "all") {
      this.onmessage({
        data: {
          id: message.id,
          result: [
            { id: 1, name: "test" },
            { id: 2, name: "test2" },
          ],
        },
      });
    } else if (message.method === "exec") {
      this.onmessage({ data: { id: message.id, result: { ok: true } } });
    } else if (message.method === "close") {
      this.onmessage({ data: { id: message.id, result: { ok: true } } });
    }
  }

  terminate() {
    // Simulate worker termination
  }
}

// Override global Worker for testing
const OriginalWorker = globalThis.Worker;
globalThis.Worker = MockWorker;

let connection;
let mockWorker;

Deno.test.beforeEach(async () => {
  // Reset mockWorker before each test
  globalThis.Worker = MockWorker;
  connection = await createDenoSqliteConnection({ uri: ":memory:" });
  mockWorker = connection.worker;
  mockWorker.postMessageCalls = []; // Clear calls for each test
});

Deno.test.afterEach(() => {
  // Restore original Worker after each test
  globalThis.Worker = OriginalWorker;
});

Deno.test("DenoSqliteConnection", async () => {
  Deno.test("should connect and close", async () => {
    await connection.close();
    assert(mockWorker.postMessageCalls.some((call) => call.method === "close"));
  });

  Deno.test("should execute run operations", async () => {
    const sql = "INSERT INTO users (name) VALUES (?)";
    const params = ["John Doe"];
    const result = await connection.run(sql, params);
    assert(
      mockWorker.postMessageCalls.some(
        (call) => call.method === "run" && call.sql === sql && call.params[0] === params[0]
      )
    );
    assert.strictEqual(result.rowsAffected, 1);
    assert.strictEqual(result.lastInsertId, 1);
  });

  Deno.test("should execute get operations", async () => {
    const sql = "SELECT * FROM users WHERE id = ?";
    const params = [1];
    const result = await connection.get(sql, params);
    assert(
      mockWorker.postMessageCalls.some(
        (call) => call.method === "get" && call.sql === sql && call.params[0] === params[0]
      )
    );
    assert.deepStrictEqual(result, { id: 1, name: "test" });
  });

  Deno.test("should execute all operations", async () => {
    const sql = "SELECT * FROM users";
    const result = await connection.all(sql);
    assert(mockWorker.postMessageCalls.some((call) => call.method === "all" && call.sql === sql));
    assert.deepStrictEqual(result, [
      { id: 1, name: "test" },
      { id: 2, name: "test2" },
    ]);
  });

  Deno.test("should execute exec operations", async () => {
    const sql = "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)";
    await connection.exec(sql);
    assert(mockWorker.postMessageCalls.some((call) => call.method === "exec" && call.sql === sql));
  });

  Deno.test("should throw error for transaction method", async () => {
    let error;
    try {
      await connection.transaction(async (trx) => {});
    } catch (e) {
      error = e;
    }
    assert(error instanceof Error);
    assert.strictEqual(
      error.message,
      "La méthode 'transaction' doit être implémentée par l'adaptateur spécifique."
    );
  });
});
