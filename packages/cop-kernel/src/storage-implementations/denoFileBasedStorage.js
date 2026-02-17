/* eslint-env deno */
/* global Deno, DB */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createAuditLogger } from "./auditLogger.js";

// Define ERROR_CODES for consistency
const ERROR_CODES = {
  NOT_FOUND: "STORAGE_NOT_FOUND",
  DB_ERROR: "STORAGE_DATABASE_ERROR", // Generic error for file operations
  CONFLICT: "STORAGE_CONFLICT_ERROR",
  OPTIMISTIC_LOCK_FAIL: "STORAGE_OPTIMISTIC_LOCK_FAILED",
};

export function createDenoFileBasedStorage(options) {
  const { ERROR_CODES } = options;
  let db;

  function initializeDb() {
    db = new DB("cop_kernel.db");
  }

  const { basePath = "./file_storage_data", auditLogPath = "./audit_logs.jsonl" } = options;
  const auditLogger = createAuditLogger({ auditLogPath });

  // Ensure the base directory exists
  async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  // Helper to get file path for an entity
  function getEntityFilePath(entityType, id) {
    return path.join(basePath, entityType, `${id}.json`);
  }

  // Helper to read a JSON file
  async function readJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null; // File not found
      }
      throw error;
    }
  }

  // Helper to write a JSON file
  async function writeJsonFile(filePath, data) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  // Helper to get index file path
  function getIndexFilePath(entityType, indexName) {
    return path.join(basePath, `${entityType}_${indexName}_index.json`);
  }

  // Helper to read an index file
  async function readIndexFile(entityType, indexName) {
    const filePath = getIndexFilePath(entityType, indexName);
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {}; // Return empty object if index file not found
      }
      throw error;
    }
  }

  // Helper to write an index file
  async function writeIndexFile(entityType, indexName, indexData) {
    const filePath = getIndexFilePath(entityType, indexName);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(indexData, null, 2));
  }

  // Implement the StorageInterface methods
  const fileBasedStorage = {
    options: { ...options, type: "denoFile" },
    ERROR_CODES,

    // Metadata interfaces (simplified for file-based)
    debugLogs: {
      async insert(logRecord) {
        // For file-based, we might append to a log file or just return ok
        // For simplicity, let's just return ok for now.
        // A real implementation would write to a log file.
        return { ok: true };
      },
    },
    events: {
      async insert(eventRecord) {
        // Similar to debugLogs, for simplicity just return ok
        return { ok: true, event: eventRecord };
      },
    },
    artifacts: {
      async insert(artifactRecord) {
        // Similar to debugLogs, for simplicity just return ok
        return { ok: true, artifact: artifactRecord };
      },
    },

    agentIdentities: {
      async upsert(identity, conflictKey = "agent_name") {
        const filePath = getEntityFilePath("agentIdentities", identity.agent_id);
        await writeJsonFile(filePath, identity);

        // Update name index
        const nameIndex = await readIndexFile("agentIdentities", "name");
        nameIndex[identity.agent_name] = identity.agent_id;
        await writeIndexFile("agentIdentities", "name", nameIndex);

        await auditLogger.logEvent({
          eventType: "AgentIdentityUpserted",
          entityType: "agentIdentity",
          entityId: identity.agent_id,
          payload: identity,
        });
        return { ok: true, identity };
      },
      async getById(agent_id) {
        const filePath = getEntityFilePath("agentIdentities", agent_id);
        const identity = await readJsonFile(filePath);
        return { ok: !!identity, identity };
      },
      async getByName(agent_name) {
        const nameIndex = await readIndexFile("agentIdentities", "name");
        const agent_id = nameIndex[agent_name];
        if (agent_id) {
          return this.getById(agent_id);
        }
        return { ok: false, error: "Agent not found", code: ERROR_CODES.NOT_FOUND };
      },
      async list({ status, limit = 100 } = {}) {
        const dirPath = path.join(basePath, "agentIdentities");
        await ensureDir(dirPath);
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        for (const dirEntry of files) {
          if (dirEntry.isFile() && dirEntry.name.endsWith(".json")) {
            files.push(dirEntry.name);
          }
        }
        let identities = [];
        for (const file of files) {
          const identity = await readJsonFile(path.join(dirPath, file));
          if (identity) {
            identities.push(identity);
          }
        }
        if (status) {
          identities = identities.filter((a) => a.status === status);
        }
        return { ok: true, identities: identities.slice(0, limit) };
      },
      async updateStatus(agent_id, status) {
        const filePath = getEntityFilePath("agentIdentities", agent_id);
        const identity = await readJsonFile(filePath);
        if (identity) {
          const oldStatus = identity.status;
          identity.status = status;
          await writeJsonFile(filePath, identity);
          await auditLogger.logEvent({
            eventType: "AgentIdentityStatusUpdated",
            entityType: "agentIdentity",
            entityId: agent_id,
            payload: { oldStatus, newStatus: status },
          });
          return { ok: true, identity };
        }
        return { ok: false, error: "Agent not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    tasks: {
      async upsert(taskRecord) {
        const newTask = { ...taskRecord, id: taskRecord.id || `task_${Date.now()}` };
        newTask.version = (newTask.version || 0) + 1;
        const filePath = getEntityFilePath("tasks", newTask.id);
        await writeJsonFile(filePath, newTask);
        await auditLogger.logEvent({
          eventType: "TaskUpserted",
          entityType: "task",
          entityId: newTask.id,
          payload: newTask,
        });
        return { ok: true, task: newTask };
      },
      async get(taskId) {
        const filePath = getEntityFilePath("tasks", taskId);
        const task = await readJsonFile(filePath);
        return { ok: !!task, task };
      },
      async list({ status, limit = 100 } = {}) {
        const dirPath = path.join(basePath, "tasks");
        await ensureDir(dirPath);
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        for (const dirEntry of files) {
          if (dirEntry.isFile() && dirEntry.name.endsWith(".json")) {
            files.push(dirEntry.name);
          }
        }
        let tasks = [];
        for (const file of files) {
          const task = await readJsonFile(path.join(dirPath, file));
          if (task) {
            tasks.push(task);
          }
        }
        if (status) {
          tasks = tasks.filter((j) => j.status === status);
        }
        return { ok: true, tasks: tasks.slice(0, limit) };
      },
      async update(taskId, patch) {
        const filePath = getEntityFilePath("tasks", taskId);
        const task = await readJsonFile(filePath);
        if (task) {
          if (patch.version !== undefined && task.version !== patch.version) {
            return {
              ok: false,
              error: "Optimistic lock failed. Version mismatch.",
              code: ERROR_CODES.OPTIMISTIC_LOCK_FAIL,
            };
          }
          Object.assign(task, patch);
          task.version = (task.version || 0) + 1;
          await writeJsonFile(filePath, task);
          await auditLogger.logEvent({
            eventType: "TaskUpdated",
            entityType: "task",
            entityId: taskId,
            payload: { patch, newTask: task },
          });
          return { ok: true, task };
        }
        return { ok: false, error: "Task not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    steps: {
      async upsert(stepRecord) {
        const newStep = { ...stepRecord, id: stepRecord.id || `step_${Date.now()}` };
        const filePath = getEntityFilePath("steps", newStep.id);
        await writeJsonFile(filePath, newStep);
        await auditLogger.logEvent({
          eventType: "StepUpserted",
          entityType: "step",
          entityId: newStep.id,
          payload: newStep,
        });
        return { ok: true, step: newStep };
      },
      async listByTask(taskId) {
        const dirPath = path.join(basePath, "steps");
        await ensureDir(dirPath);
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        for (const dirEntry of files) {
          if (dirEntry.isFile() && dirEntry.name.endsWith(".json")) {
            files.push(dirEntry.name);
          }
        }
        let steps = [];
        for (const file of files) {
          const step = await readJsonFile(path.join(dirPath, file));
          if (step && step.task_id === taskId) {
            steps.push(step);
          }
        }
        return { ok: true, steps };
      },
      async update(taskId, stepId, patch) {
        const filePath = getEntityFilePath("steps", stepId);
        const step = await readJsonFile(filePath);
        if (step && step.task_id === taskId) {
          Object.assign(step, patch);
          await writeJsonFile(filePath, step);
          await auditLogger.logEvent({
            eventType: "StepUpdated",
            entityType: "step",
            entityId: stepId,
            payload: { taskId, patch, newStep: step },
          });
          return { ok: true, step };
        }
        return { ok: false, error: "Step not found", code: ERROR_CODES.NOT_FOUND };
      },
    },

    fileStorage: {
      defaultBucket: "cop-artifacts",

      async uploadArtifact(bucketName, filePath, fileBody, options = {}) {
        const fullPath = path.join(basePath, "artifacts", bucketName, filePath);
        await ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, fileBody);
        return { ok: true, path: fullPath };
      },

      async downloadArtifact(bucketName, filePath) {
        const fullPath = path.join(basePath, "artifacts", bucketName, filePath);
        try {
          const data = await fs.readFile(fullPath, "utf8");
          return { ok: true, data };
        } catch (error) {
          if (error.code === "ENOENT") {
            return { ok: false, error: "Artifact not found", code: ERROR_CODES.NOT_FOUND };
          }
          throw error;
        }
      },

      async getPublicUrl(bucketName, filePath) {
        const fullPath = path.join(basePath, "artifacts", bucketName, filePath);
        try {
          await fs.stat(fullPath); // Check if file exists
          return { ok: true, url: `file://${fullPath}` };
        } catch (error) {
          if (error instanceof Deno.errors.NotFound) {
            return { ok: false, error: "Artifact not found", code: ERROR_CODES.NOT_FOUND };
          }
          throw error;
        }
      },
    },

    // No direct cache contents for file-based, as it's always reading from disk.
    // But we can provide a way to "clear" the storage (delete all files).
    clearCache: async () => {
      // This is a destructive operation, use with caution.
      // For testing, it's fine.
      try {
        await fs.rm(basePath, { recursive: true, force: true });
        // Also remove index files
        // fs.rm will throw if file doesn't exist, so we need to catch it.
        try {
          await fs.rm(getIndexFilePath("agentIdentities", "name"), { force: true });
        } catch (error) {
          if (!(error.code === "ENOENT")) {
            throw error;
          }
        }
        await ensureDir(basePath); // Recreate base directory
      } catch (error) {
        // Ignore if directory doesn't exist
        if (!(error.code === "ENOENT")) {
          throw error;
        }
      }
    },
  };

  return fileBasedStorage;
}
