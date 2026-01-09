import { assert, assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { afterEach, beforeEach } from "https://deno.land/std@0.208.0/testing/bdd.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";
import * as fs from "https://deno.land/std@0.208.0/fs/mod.ts";
import { createDenoFileBasedStorage } from "../denoFileBasedStorage.js";

Deno.test("DenoFileBasedStorage", () => {
  let storage;
  let testBasePath;
  let testAuditLogPath;

  beforeEach(async () => {
    testBasePath = await Deno.makeTempDir();
    testAuditLogPath = `${testBasePath}/audit_logs.jsonl`;
    storage = createDenoFileBasedStorage({
      basePath: testBasePath,
      auditLogPath: testAuditLogPath,
    });
  });

  afterEach(async () => {
    await Deno.remove(testBasePath, { recursive: true });
  });

  Deno.test("should insert debug logs", async () => {
    const logRecord = { message: "test log" };
    const result = await storage.debugLogs.insert(logRecord);
    assertEquals(result.ok, true);
  });

  Deno.test("should insert events", async () => {
    const eventRecord = { type: "test_event", payload: { data: "test" } };
    const result = await storage.events.insert(eventRecord);
    assertEquals(result.ok, true);
    assertEquals(result.event, eventRecord);
  });

  Deno.test("should insert artifacts", async () => {
    const artifactRecord = { name: "test_artifact", content: "some content" };
    const result = await storage.artifacts.insert(artifactRecord);
    assertEquals(result.ok, true);
    assertEquals(result.artifact, artifactRecord);
  });

  Deno.test("agentIdentities should upsert new identity", async () => {
    const identity = { agent_id: "agent_1", agent_name: "test_agent", status: "active" };
    const result = await storage.agentIdentities.upsert(identity);
    assertEquals(result.ok, true);
    assertEquals(result.identity, identity);

    const filePath = `${testBasePath}/agentIdentities/agent_1.json`;
    const fileContent = await Deno.readTextFile(filePath);
    assertEquals(JSON.parse(fileContent), identity);

    const nameIndexFilePath = `${testBasePath}/agentIdentities_name_index.json`;
    const nameIndexContent = await Deno.readTextFile(nameIndexFilePath);
    assertEquals(JSON.parse(nameIndexContent), { test_agent: "agent_1" });
  });

  Deno.test("agentIdentities should update existing identity", async () => {
    const initialIdentity = { agent_id: "agent_1", agent_name: "test_agent", status: "active" };
    await storage.agentIdentities.upsert(initialIdentity);
    const updatedIdentity = { agent_id: "agent_1", agent_name: "test_agent", status: "inactive" };
    const result = await storage.agentIdentities.upsert(updatedIdentity);
    assertEquals(result.ok, true);
    assertEquals(result.identity, updatedIdentity);

    const filePath = `${testBasePath}/agentIdentities/agent_1.json`;
    const fileContent = await Deno.readTextFile(filePath);
    assertEquals(JSON.parse(fileContent), updatedIdentity);
  });

  Deno.test("agentIdentities should get identity by id", async () => {
    const identity = { agent_id: "agent_1", agent_name: "test_agent" };
    await storage.agentIdentities.upsert(identity);
    const result = await storage.agentIdentities.getById("agent_1");
    assertEquals(result.ok, true);
    assertEquals(result.identity, identity);
  });

  Deno.test("agentIdentities should get identity by name", async () => {
    const identity = { agent_id: "agent_1", agent_name: "test_agent" };
    await storage.agentIdentities.upsert(identity);
    const result = await storage.agentIdentities.getByName("test_agent");
    assertEquals(result.ok, true);
    assertEquals(result.identity, identity);
  });

  Deno.test("agentIdentities should list identities", async () => {
    await storage.agentIdentities.upsert({
      agent_id: "agent_1",
      agent_name: "agent1",
      status: "active",
    });
    await storage.agentIdentities.upsert({
      agent_id: "agent_2",
      agent_name: "agent2",
      status: "inactive",
    });
    const result = await storage.agentIdentities.list();
    assertEquals(result.ok, true);
    assertEquals(result.identities.length, 2);
    assertEquals(
      result.identities
        .map((i) => i.agent_id)
        .sort()
        .join(),
      ["agent_1", "agent_2"].sort().join()
    );
  });

  Deno.test("agentIdentities should list identities by status", async () => {
    await storage.agentIdentities.upsert({
      agent_id: "agent_1",
      agent_name: "agent1",
      status: "active",
    });
    await storage.agentIdentities.upsert({
      agent_id: "agent_2",
      agent_name: "agent2",
      status: "inactive",
    });
    const result = await storage.agentIdentities.list({ status: "active" });
    assertEquals(result.ok, true);
    assertEquals(result.identities.length, 1);
    assertEquals(result.identities[0].status, "active");
  });

  Deno.test("agentIdentities should update status", async () => {
    const identity = { agent_id: "agent_1", agent_name: "test_agent", status: "active" };
    await storage.agentIdentities.upsert(identity);
    const result = await storage.agentIdentities.updateStatus("agent_1", "inactive");
    assertEquals(result.ok, true);
    assertEquals(result.identity.status, "inactive");
    const updated = await storage.agentIdentities.getById("agent_1");
    assertEquals(updated.identity.status, "inactive");
  });

  Deno.test("tasks should upsert new task", async () => {
    const taskRecord = { name: "test_task", status: "pending" };
    const result = await storage.tasks.upsert(taskRecord);
    assertEquals(result.ok, true);
    assert(result.task.id);
    assertEquals(result.task.name, "test_task");

    const filePath = `${testBasePath}/tasks/${result.task.id}.json`;
    const fileContent = await Deno.readTextFile(filePath);
    assertEquals(JSON.parse(fileContent), result.task);
  });

  Deno.test("tasks should update existing task", async () => {
    const initialTask = { id: "task_1", name: "test_task", status: "pending", version: 1 };
    await storage.tasks.upsert(initialTask);
    const updatedTask = { id: "task_1", name: "test_task", status: "running", version: 2 };
    const result = await storage.tasks.update("task_1", updatedTask);
    assertEquals(result.ok, true);
    assertEquals(result.task.status, "running");
    assertEquals(result.task.version, 3);

    const filePath = `${testBasePath}/tasks/task_1.json`;
    const fileContent = await Deno.readTextFile(filePath);
    assertEquals(JSON.parse(fileContent), result.task);
  });

  Deno.test("tasks should fail update on optimistic lock mismatch", async () => {
    const initialTask = { id: "task_1", name: "test_task", status: "pending", version: 1 };
    await storage.tasks.upsert(initialTask);
    const updatedTask = { id: "task_1", name: "test_task", status: "running", version: 1 }; // Version mismatch
    const result = await storage.tasks.update("task_1", updatedTask);
    assertEquals(result.ok, false);
    assertEquals(result.code, storage.ERROR_CODES.OPTIMISTIC_LOCK_FAIL);
  });

  Deno.test("tasks should get task by id", async () => {
    const task = { id: "task_1", name: "test_task" };
    await storage.tasks.upsert(task);
    const result = await storage.tasks.get("task_1");
    assertEquals(result.ok, true);
    assertEquals(result.task.name, "test_task");
  });

  Deno.test("tasks should list tasks", async () => {
    await storage.tasks.upsert({ id: "task_1", name: "task1", status: "pending" });
    await storage.tasks.upsert({ id: "task_2", name: "task2", status: "running" });
    const result = await storage.tasks.list();
    assertEquals(result.ok, true);
    assertEquals(result.tasks.length, 2);
    assertEquals(
      result.tasks
        .map((j) => j.id)
        .sort()
        .join(),
      ["task_1", "task_2"].sort().join()
    );
  });

  Deno.test("tasks should list tasks by status", async () => {
    await storage.tasks.upsert({ id: "task_1", name: "task1", status: "pending" });
    await storage.tasks.upsert({ id: "task_2", name: "task2", status: "running" });
    const result = await storage.tasks.list({ status: "pending" });
    assertEquals(result.ok, true);
    assertEquals(result.tasks.length, 1);
    assertEquals(result.tasks[0].status, "pending");
  });

  Deno.test("steps should upsert new step", async () => {
    const stepRecord = { task_id: "task_1", name: "test_step", status: "created" };
    const result = await storage.steps.upsert(stepRecord);
    assertEquals(result.ok, true);
    assert(result.step.id);
    assertEquals(result.step.name, "test_step");

    const filePath = `${testBasePath}/steps/${result.step.id}.json`;
    const fileContent = await Deno.readTextFile(filePath);
    assertEquals(JSON.parse(fileContent), result.step);
  });

  Deno.test("steps should list steps by task", async () => {
    await storage.steps.upsert({ task_id: "task_1", name: "step1" });
    await storage.steps.upsert({ task_id: "task_1", name: "step2" });
    await storage.steps.upsert({ task_id: "task_2", name: "step3" });
    const result = await storage.steps.listByTask("task_1");
    assertEquals(result.ok, true);
    assertEquals(result.steps.length, 2);
    assertEquals(result.steps[0].name, "step1");
  });

  Deno.test("steps should update existing step", async () => {
    const initialStep = { id: "step_1", task_id: "task_1", name: "test_step", status: "created" };
    await storage.steps.upsert(initialStep);
    const updatedStep = { status: "running" };
    const result = await storage.steps.update("task_1", "step_1", updatedStep);
    assertEquals(result.ok, true);
    assertEquals(result.step.status, "running");

    const filePath = `${testBasePath}/steps/step_1.json`;
    const fileContent = await Deno.readTextFile(filePath);
    assertEquals(JSON.parse(fileContent).status, "running");
  });

  Deno.test("fileStorage should upload artifact", async () => {
    const bucket = "test_bucket";
    const artifactPath = "test/path/file.txt";
    const content = "file content";
    const result = await storage.fileStorage.uploadArtifact(bucket, artifactPath, content);
    assertEquals(result.ok, true);
    const expectedFullPath = path.join(testBasePath, "artifacts", bucket, artifactPath);
    assertEquals(result.path, expectedFullPath);

    const filePath = path.join(testBasePath, "artifacts", bucket, artifactPath);
    const fileContent = await Deno.readTextFile(filePath);
    assertEquals(fileContent, content);
  });

  Deno.test("fileStorage should download artifact", async () => {
    const bucket = "test_bucket";
    const filePath = "test/path/file.txt";
    const content = "file content";
    await storage.fileStorage.uploadArtifact(bucket, filePath, content);
    const result = await storage.fileStorage.downloadArtifact(bucket, filePath);
    assertEquals(result.ok, true);
    assertEquals(result.data, content);
  });

  Deno.test("fileStorage should get public url", async () => {
    const bucket = "test_bucket";
    const artifactPath = "test/path/file.txt";
    const content = "file content";
    await storage.fileStorage.uploadArtifact(bucket, artifactPath, content);
    const result = await storage.fileStorage.getPublicUrl(bucket, artifactPath);
    assertEquals(result.ok, true);
    assertEquals(
      result.url,
      `file://${path.join(testBasePath, "artifacts", bucket, artifactPath)}`
    );
  });

  Deno.test("should clear all data", async () => {
    await storage.agentIdentities.upsert({
      agent_id: "agent_1",
      agent_name: "agent1",
      status: "active",
    });
    await storage.tasks.upsert({ id: "task_1", name: "task1", status: "pending" });
    await storage.steps.upsert({ task_id: "task_1", name: "step1" });
    await storage.fileStorage.uploadArtifact("b", "p", "c");

    await storage.clearCache();

    const listIdentities = await storage.agentIdentities.list();
    assertEquals(listIdentities.identities.length, 0);
    const listTasks = await storage.tasks.list();
    assertEquals(listTasks.tasks.length, 0);
    const listSteps = await storage.steps.listByTask("task_1");
    assertEquals(listSteps.steps.length, 0);
    const downloadResult = await storage.fileStorage.downloadArtifact("b", "p");
    assertEquals(downloadResult.ok, false);
  });
});
