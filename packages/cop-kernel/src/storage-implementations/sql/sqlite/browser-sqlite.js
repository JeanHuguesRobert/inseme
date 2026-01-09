import * as SQLJs from "https://cdn.jsdelivr.net/npm/sql.js/dist/sql-wasm";

export class BrowserSqliteConnection {
  constructor(db) {
    this.db = db;
  }

  async run(sql, params) {
    try {
      this.db.run(sql, params);
      return { rowsAffected: this.db.getRowsModified(), lastInsertId: undefined }; // sql.js doesn't expose lastInsertId directly in run
    } catch (e) {
      throw new Error(`SQLite error: ${e.message}`);
    }
  }

  async get(sql, params) {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      } else {
        stmt.free();
        return undefined;
      }
    } catch (e) {
      throw new Error(`SQLite error: ${e.message}`);
    }
  }

  async all(sql, params) {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (e) {
      throw new Error(`SQLite error: ${e.message}`);
    }
  }

  async exec(sql) {
    try {
      this.db.exec(sql);
    } catch (e) {
      throw new Error(`SQLite error: ${e.message}`);
    }
  }

  async close() {
    this.db.close();
  }

  async transaction(callback) {
    try {
      this.db.exec("BEGIN TRANSACTION");
      const trx = {
        run: (sql, params) => this.run(sql, params),
        get: (sql, params) => this.get(sql, params),
        all: (sql, params) => this.all(sql, params),
        exec: (sql) => this.exec(sql),
        beginTransaction: () => Promise.resolve(), // Already in a transaction
        commit: () => this.db.exec("COMMIT"),
        rollback: () => this.db.exec("ROLLBACK"),
        close: () => Promise.resolve(), // Connection managed by the transaction
      };
      const result = await callback(trx);
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

export async function createBrowserSqliteConnection(config) {
  // sql.js needs to be initialized, typically by loading the WASM module.
  // This assumes initSqlJs is globally available or imported correctly.
  const SQL = await SQLJs.initSqlJs();
  const db = new SQL.Database(); // Create a new database
  return new BrowserSqliteConnection(db);
}
