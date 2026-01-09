import {
  assertEquals,
  assertStrictEquals,
  assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createBrowserSqliteConnection } from "../../sqlite/browser-sqlite.js";

// Mock the 'sql.js' library
class MockSqlJsDatabase {
  constructor() {
    this.calls = { run: [], exec: [], prepare: [], export: [], close: [] };
    this.results = {};
    this.inTransaction = false;
  }

  run(sql, params) {
    this.calls.run.push({ sql, params });
    if (sql.startsWith("BEGIN")) {
      this.inTransaction = true;
    } else if (sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
      this.inTransaction = false;
    }
    return { changes: 1, lastInsertRowId: 1 };
  }

  exec(sql) {
    this.calls.exec.push({ sql });
    if (sql.startsWith("BEGIN")) {
      this.inTransaction = true;
    } else if (sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
      this.inTransaction = false;
    }
  }

  prepare(sql) {
    this.calls.prepare.push({ sql });
    const self = this;
    return {
      get: (params) => {
        self.calls.run.push({ sql, params }); // sql.js prepare.get uses run internally
        return self.results[sql] || { id: 1, name: "test" };
      },
      all: (params) => {
        self.calls.run.push({ sql, params }); // sql.js prepare.all uses run internally
        return (
          self.results[sql] || [
            { id: 1, name: "test" },
            { id: 2, name: "test2" },
          ]
        );
      },
      free: () => {},
    };
  }

  export() {
    this.calls.export.push({});
    return new Uint8Array();
  }

  close() {
    this.calls.close.push({});
  }
}

class MockSqlJs {
  constructor() {
    this.Database = MockSqlJsDatabase;
  }

  async initSqlJs() {
    return this;
  }
}

Deno.test("BrowserSqliteConnection", async (t) => {
  let connection;
  let mockDb;

  const setup = async () => {
    connection = await createBrowserSqliteConnection();
    mockDb = connection.db; // Access the mocked database
    mockDb.calls = { run: [], exec: [], prepare: [], export: [], close: [] }; // Reset calls for each test
    mockDb.results = {};
    mockDb.inTransaction = false;
  };

  Deno.test("should connect and release", async () => {
    await setup();
    // connect is implicitly called during creation
    await connection.connect();
    await connection.release();
    assertStrictEquals(mockDb.calls.close.length, 1);
  });

  Deno.test("should execute run operations", async () => {
    await setup();
    const sql = "INSERT INTO users (name) VALUES (?)";
    const params = ["John Doe"];
    const result = await connection.run(sql, params);
    assertStrictEquals(mockDb.calls.run.length, 1);
    assertEquals(mockDb.calls.run[0], { sql, params });
    assertStrictEquals(result.rowsAffected, 1);
    assertStrictEquals(result.lastInsertId, 1);
  });

  Deno.test("should execute get operations", async () => {
    await setup();
    const sql = "SELECT * FROM users WHERE id = ? LIMIT 1";
    const params = [1];
    const expectedResult = { id: 1, name: "test" };
    mockDb.results[sql] = expectedResult;

    const result = await connection.get(sql, params);
    assertStrictEquals(mockDb.calls.prepare.length, 1);
    assertEquals(mockDb.calls.prepare[0], { sql });
    assertStrictEquals(mockDb.calls.run.length, 1); // prepare.get calls run
    assertEquals(mockDb.calls.run[0], { sql, params });
    assertEquals(result, expectedResult);
  });

  Deno.test("should execute all operations", async () => {
    await setup();
    const sql = "SELECT * FROM users";
    const params = [];
    const expectedResult = [
      { id: 1, name: "test" },
      { id: 2, name: "test2" },
    ];
    mockDb.results[sql] = expectedResult;

    const result = await connection.all(sql, params);
    assertStrictEquals(mockDb.calls.prepare.length, 1);
    assertEquals(mockDb.calls.prepare[0], { sql });
    assertStrictEquals(mockDb.calls.run.length, 1); // prepare.all calls run
    assertEquals(mockDb.calls.run[0], { sql, params });
    assertEquals(result, expectedResult);
  });

  Deno.test("should execute exec operations", async () => {
    await setup();
    const sql = "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)";
    await connection.exec(sql);
    assertStrictEquals(mockDb.calls.exec.length, 1);
    assertEquals(mockDb.calls.exec[0], { sql });
  });

  Deno.test("should handle transactions", async () => {
    await setup();
    const sql1 = "INSERT INTO accounts (balance) VALUES (?)";
    const params1 = [100];
    const sql2 = "UPDATE users SET balance = ? WHERE id = ?";
    const params2 = [200, 1];

    await connection.transaction(async (trx) => {
      await trx.run(sql1, params1);
      await trx.run(sql2, params2);
    });

    assertStrictEquals(mockDb.calls.run.length, 4); // BEGIN, INSERT, UPDATE, COMMIT
    assertEquals(mockDb.calls.run[0], { sql: "BEGIN" });
    assertEquals(mockDb.calls.run[1], { sql: sql1, params: params1 });
    assertEquals(mockDb.calls.run[2], { sql: sql2, params: params2 });
    assertEquals(mockDb.calls.run[3], { sql: "COMMIT" });
  });

  Deno.test("should rollback transaction on error", async () => {
    await setup();
    const sql1 = "INSERT INTO accounts (balance) VALUES (?)";
    const params1 = [100];

    await assertThrows(
      async () => {
        await connection.transaction(async (trx) => {
          await trx.run(sql1, params1);
          throw new Error("Transaction failed");
        });
      },
      Error,
      "Transaction failed"
    );

    assertStrictEquals(mockDb.calls.run.length, 3); // BEGIN, INSERT, ROLLBACK
    assertEquals(mockDb.calls.run[0], { sql: "BEGIN" });
    assertEquals(mockDb.calls.run[1], { sql: sql1, params: params1 });
    assertEquals(mockDb.calls.run[2], { sql: "ROLLBACK" });
  });
});
