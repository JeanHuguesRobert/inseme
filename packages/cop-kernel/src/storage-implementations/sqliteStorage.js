import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { SQLITE_SCHEMA, CURRENT_SCHEMA_VERSION, checkTableSchema } from "./sqliteSchema.js";

export function createNodeSqliteStorage(options) {
  const { ERROR_CODES } = options;
  let db;

  async function initializeDb() {
    db = await open({
      filename: "cop_kernel.db",
      driver: sqlite3.Database,
    });

    // Gestion du versionnement du schéma
    await db.exec(SQLITE_SCHEMA.schemaVersion);

    // Vérifier la version actuelle du schéma
    const currentVersionRow = await db.get(
      `SELECT version FROM schema_version ORDER BY version DESC LIMIT 1`
    );
    const currentDbVersion = currentVersionRow ? currentVersionRow.version : 0;

    if (currentDbVersion < CURRENT_SCHEMA_VERSION) {
      // Appliquer le schéma centralisé
      await db.exec(SQLITE_SCHEMA.agentIdentities);
      await db.exec(SQLITE_SCHEMA.tasks);
      await db.exec(SQLITE_SCHEMA.steps);
      await db.exec(SQLITE_SCHEMA.debugLogs);
      await db.exec(SQLITE_SCHEMA.events);

      // Mettre à jour la version du schéma
      await db.run(`INSERT INTO schema_version (version, applied_at) VALUES (?, ?)`, [
        CURRENT_SCHEMA_VERSION,
        new Date().toISOString(),
      ]);
    }

    // Vérifier les schémas des tables
    await checkTableSchema(db, "agentIdentities", ["agent_id", "agent_name", "status"]);
    await checkTableSchema(db, "tasks", ["id", "status", "version"]);
    await checkTableSchema(db, "steps", ["id", "task_id", "status", "output"]);
    await checkTableSchema(db, "debugLogs", ["id", "message", "level", "timestamp"]);
    await checkTableSchema(db, "events", ["id", "type", "payload", "timestamp"]);

    // Artifacts and fileStorage are not supported in this implementation
  }

  // Initialize the database connection and schema
  initializeDb();

  return {
    options: { type: "node-sqlite" },
    agentIdentities: {
      async upsert(identity) {
        try {
          await db.run(
            `INSERT INTO agentIdentities (agent_id, agent_name, status) VALUES (?, ?, ?) ON CONFLICT(agent_id) DO UPDATE SET agent_name = EXCLUDED.agent_name, status = EXCLUDED.status`,
            identity.agent_id,
            identity.agent_name,
            identity.status
          );
          return { ok: true, identity };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async getById(agent_id) {
        try {
          const row = await db.get(`SELECT * FROM agentIdentities WHERE agent_id = ?`, agent_id);
          if (row) {
            return { ok: true, identity: row };
          } else {
            return { ok: false, code: ERROR_CODES.NOT_FOUND };
          }
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async getByName(agent_name) {
        try {
          const row = await db.get(
            `SELECT * FROM agentIdentities WHERE agent_name = ?`,
            agent_name
          );
          if (row) {
            return { ok: true, identity: row };
          } else {
            return { ok: false, code: ERROR_CODES.NOT_FOUND };
          }
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async list() {
        try {
          const rows = await db.all(`SELECT * FROM agentIdentities`);
          return { ok: true, identities: rows };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async updateStatus(agent_id, status) {
        try {
          await db.run(
            `UPDATE agentIdentities SET status = ? WHERE agent_id = ?`,
            status,
            agent_id
          );
          const { identity } = await this.getById(agent_id);
          return { ok: true, identity };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
    },
    tasks: {
      async upsert(task) {
        try {
          const currentTask = await this.get(task.id);
          let newVersion = 1;
          if (currentTask.ok) {
            newVersion = currentTask.task.version + 1;
          }
          await db.run(
            `INSERT INTO tasks (id, status, version) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET status = EXCLUDED.status, version = EXCLUDED.version`,
            task.id,
            task.status,
            newVersion
          );
          return { ok: true, task: { ...task, version: newVersion } };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async get(id) {
        try {
          const row = await db.get(`SELECT * FROM tasks WHERE id = ?`, id);
          if (row) {
            return { ok: true, task: row };
          } else {
            return { ok: false, code: ERROR_CODES.NOT_FOUND };
          }
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async list() {
        try {
          const rows = await db.all(`SELECT * FROM tasks`);
          return { ok: true, tasks: rows };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async update(id, patch) {
        try {
          const currentTask = await this.get(id);
          if (!currentTask.ok) {
            return { ok: false, code: ERROR_CODES.NOT_FOUND };
          }
          if (currentTask.task.version !== patch.version) {
            return { ok: false, code: ERROR_CODES.OPTIMISTIC_LOCK_FAIL };
          }
          const newVersion = currentTask.task.version + 1;
          await db.run(
            `UPDATE tasks SET status = ?, version = ? WHERE id = ? AND version = ?`,
            patch.status,
            newVersion,
            id,
            patch.version
          );
          const { task } = await this.get(id);
          return { ok: true, task };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
    },
    steps: {
      async upsert(step) {
        try {
          await db.run(
            `INSERT INTO steps (id, task_id, status, output) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET task_id = EXCLUDED.task_id, status = EXCLUDED.status, output = EXCLUDED.output`,
            step.id,
            step.task_id,
            step.status,
            step.output
          );
          return { ok: true, step };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async listByTask(task_id) {
        try {
          const rows = await db.all(`SELECT * FROM steps WHERE task_id = ?`, task_id);
          return { ok: true, steps: rows };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
      async update(task_id, step_id, patch) {
        try {
          await db.run(
            `UPDATE steps SET status = ?, output = ? WHERE task_id = ? AND id = ?`,
            patch.status,
            patch.output,
            task_id,
            step_id
          );
          const row = await db.get(
            `SELECT * FROM steps WHERE task_id = ? AND id = ?`,
            task_id,
            step_id
          );
          if (row) {
            return { ok: true, step: row };
          } else {
            return { ok: false, code: ERROR_CODES.NOT_FOUND };
          }
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
    },
    debugLogs: {
      async insert(log) {
        try {
          await db.run(
            `INSERT INTO debugLogs (message, level, timestamp) VALUES (?, ?, ?)`,
            log.message,
            log.level,
            new Date().toISOString()
          );
          return { ok: true };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
    },
    events: {
      async insert(event) {
        try {
          await db.run(
            `INSERT INTO events (type, payload, timestamp) VALUES (?, ?, ?)`,
            event.type,
            JSON.stringify(event.payload),
            new Date().toISOString()
          );
          return { ok: true, event };
        } catch (error) {
          return { ok: false, code: ERROR_CODES.DB_ERROR, error };
        }
      },
    },
    artifacts: {
      async insert() {
        return {
          ok: false,
          code: ERROR_CODES.DB_ERROR,
          error: "Artifacts not supported in Node.js SQLite",
        };
      },
    },
    fileStorage: {
      async uploadArtifact() {
        return {
          ok: false,
          code: ERROR_CODES.DB_ERROR,
          error: "File storage not supported in Node.js SQLite",
        };
      },
      async downloadArtifact() {
        return {
          ok: false,
          code: ERROR_CODES.NOT_FOUND,
          error: "File storage not supported in Node.js SQLite",
        };
      },
      async getPublicUrl() {
        return {
          ok: false,
          code: ERROR_CODES.NOT_FOUND,
          error: "File storage not supported in Node.js SQLite",
        };
      },
    },
    async clearCache() {
      await db.close();
      try {
        const fs = await import("node:fs/promises");
        await fs.unlink("cop_kernel.db");
      } catch (error) {}
      await initializeDb();
      return { ok: true };
    },
    async close() {
      await db.close();
      return { ok: true };
    },
  };
}
