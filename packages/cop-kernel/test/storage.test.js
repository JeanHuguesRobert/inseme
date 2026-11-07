import { describe, it, beforeEach } from "node:test";
import assert from "assert";
import { initStorage, setStorage, getStorage } from "../src/storage.js";

describe("Storage Module", () => {
  it("should return an in-memory storage instance when type is 'memory'", async () => {
    const storage = await initStorage({ type: "memory" });

    assert.strictEqual(storage.options.type, "memory");
    assert.ok(storage.logicalAgents); // Check for a basic property of the storage interface
  });

  describe("Default Storage Instance Management", () => {
    beforeEach(() => {
      setStorage(null);
    });
    it("setStorage should correctly set the default storage instance", async () => {
      const customStorage = await initStorage({ type: "memory" });
      setStorage(customStorage);
      const retrievedStorage = await getStorage();
      assert.strictEqual(retrievedStorage, customStorage);
    });

    it("getStorage should return an in-memory instance if no default is set", async () => {
      // Ensure defaultStorage is null before this test
      setStorage(null);
      const defaultMemoryStorage = await getStorage();
      assert.ok(defaultMemoryStorage.options.type === "memory");
      assert.ok(defaultMemoryStorage.logicalAgents);
    });

    it("getStorage should return the same in-memory instance on subsequent calls if no default is set", async () => {
      setStorage(null); // Reset default storage
      const storage1 = await getStorage();
      const storage2 = await getStorage();
      assert.strictEqual(storage1, storage2);
    });

    it("getStorage should return the instance set by setStorage even after multiple calls", async () => {
      const customStorage = await initStorage({ type: "memory" });
      setStorage(customStorage);
      const retrievedStorage1 = await getStorage();
      const retrievedStorage2 = await getStorage();
      assert.strictEqual(retrievedStorage1, customStorage);
      assert.strictEqual(retrievedStorage2, customStorage);
    });

    it("setting a new default storage should be reflected by getStorage", async () => {
      const customStorage1 = await initStorage({ type: "memory", instanceId: "first" });
      setStorage(customStorage1);
      const retrievedStorage1 = await getStorage();
      assert.strictEqual(retrievedStorage1, customStorage1);

      const customStorage2 = await initStorage({ type: "memory", instanceId: "second" });
      setStorage(customStorage2);
      const retrievedStorage2 = await getStorage();
      assert.strictEqual(retrievedStorage2, customStorage2);
      assert.notStrictEqual(retrievedStorage1, retrievedStorage2);
    });
  });

  it("should be able to upsert and retrieve a LogicalAgent identity", async () => {
    const storage = await initStorage({ type: "memory" });
    const identity = { logical_agent_id: "agent1", logical_agent_name: "Test handler", status: "active" };
    await storage.logicalAgents.upsert(identity);
    const retrievedAgent = await storage.logicalAgents.getById("agent1");
    assert.ok(retrievedAgent.ok);
    assert.deepStrictEqual(retrievedAgent.data, identity);
  });

  it("should be able to list LogicalAgent identities", async () => {
    const storage = await initStorage({ type: "memory" });
    storage.clearCache();
    await storage.logicalAgents.upsert({
      logical_agent_id: "agent2",
      logical_agent_name: "identity Two",
      status: "active",
    });
    await storage.logicalAgents.upsert({
      logical_agent_id: "agent3",
      logical_agent_name: "identity Three",
      status: "inactive",
    });
    const { data: identities } = await storage.logicalAgents.list();
    assert.strictEqual(identities.length, 2);
    assert.ok(identities.some((a) => a.logical_agent_name === "identity Two"));
  });

  it("should be able to update LogicalAgent identity status", async () => {
    const storage = await initStorage({ type: "memory" });
    storage.clearCache();
    await storage.logicalAgents.upsert({
      logical_agent_id: "agent4",
      logical_agent_name: "identity Four",
      status: "active",
    });
    const { ok, data: identity } = await storage.logicalAgents.updateStatus("agent4", "inactive");
    assert.ok(ok);
    assert.strictEqual(identity.status, "inactive");
  });

  it("should be able to upsert and retrieve a task", async () => {
    const storage = await initStorage({ type: "memory" });
    storage.clearCache();
    const task = { id: "task1", name: "Test Task", status: "pending", version: 0 };
    await storage.tasks.upsert(task);
    const retrievedTask = await storage.tasks.get("task1");
    assert.ok(retrievedTask.ok);
    assert.deepStrictEqual(retrievedTask.data, { ...task, version: 1 }); // upsert increments version
  });

  it("should handle optimistic locking for tasks", async () => {
    const storage = await initStorage({ type: "memory" });
    storage.clearCache();
    const task = { id: "task2", name: "Test Task 2", status: "pending", version: 0 };
    await storage.tasks.upsert(task); // version becomes 1
    const updateResult = await storage.tasks.update("task2", { status: "running", version: 0 }); // Mismatch
    assert.ok(!updateResult.ok);
    assert.strictEqual(updateResult.code, storage.ERROR_CODES.OPTIMISTIC_LOCK_FAIL);
  });

  it("should be able to upsert and retrieve a step", async () => {
    const storage = await initStorage({ type: "memory" });
    storage.clearCache();
    const step = { id: "step1", task_id: "task1", name: "Test Step", status: "created" };
    await storage.steps.upsert(step);
    const { data: steps } = await storage.steps.listByTask("task1");
    assert.strictEqual(steps.length, 1);
    assert.deepStrictEqual(steps[0], step);
  });

  it("should be able to update a step", async () => {
    const storage = await initStorage({ type: "memory" });
    storage.clearCache();
    const step = { id: "step2", task_id: "task2", name: "Test Step 2", status: "created" };
    await storage.steps.upsert(step);
    const { ok, data: updatedStep } = await storage.steps.update("task2", "step2", {
      status: "running",
    });
    assert.ok(ok);
    assert.strictEqual(updatedStep.status, "running");
  });

  it("should be able to upload and download an artifact", async () => {
    const storage = await initStorage({ type: "memory" });
    storage.clearCache();
    const fileContent = "Hello World!";
    const { ok: uploadOk } = await storage.fileStorage.uploadArtifact(
      "test-bucket",
      "path/to/file.txt",
      fileContent
    );
    assert.ok(uploadOk);
    const { ok: downloadOk, data } = await storage.fileStorage.downloadArtifact(
      "test-bucket",
      "path/to/file.txt"
    );
    assert.ok(downloadOk);
    assert.strictEqual(data, fileContent);
  });

  it("should return NOT_FOUND for non-existent artifact", async () => {
    const storage = await initStorage({ type: "memory" });
    storage.clearCache();
    const { ok, code } = await storage.fileStorage.downloadArtifact(
      "test-bucket",
      "non-existent.txt"
    );
    assert.ok(!ok);
    assert.strictEqual(code, storage.ERROR_CODES.NOT_FOUND);
  });

  it("should clear all in-memory data when clearCache is called", async () => {
    const storage = await initStorage({ type: "memory" });
    storage.clearCache();
    await storage.logicalAgents.upsert({
      logical_agent_id: "agent5",
      logical_agent_name: "identity Five",
      status: "active",
    });
    await storage.tasks.upsert({ id: "task3", name: "Task Three", status: "pending" });
    await storage.steps.upsert({
      id: "step3",
      task_id: "task3",
      name: "Step Three",
      status: "created",
    });
    await storage.fileStorage.uploadArtifact("test-bucket", "file.txt", "content");

    storage.clearCache();

    const { data: identities } = await storage.logicalAgents.list();
    assert.strictEqual(identities.length, 0);
    const { data: tasks } = await storage.tasks.list();
    assert.strictEqual(tasks.length, 0);
    const { data: steps } = await storage.steps.listByTask("task3");
    assert.strictEqual(steps.length, 0);
    const { ok: fileOk } = await storage.fileStorage.downloadArtifact("test-bucket", "file.txt");
    assert.ok(!fileOk);
  });

  it("should be able to insert and retrieve debug logs", async () => {
    const storage = await initStorage({ type: "memory" });
    storage.clearCache();
    const logRecord = { level: "info", message: "Test debug log", timestamp: Date.now() };
    const { ok } = await storage.debugLogs.insert(logRecord);
    assert.ok(ok);
    const { debugLogs } = storage.getCacheContents();
    assert.strictEqual(debugLogs.length, 1);
    assert.deepStrictEqual(debugLogs[0], logRecord);
  });
});

describe("getStorage Singleton Behavior", () => {
  it("should return the same instance for identical memory storage requests", async () => {
    const storage1 = await initStorage({ type: "memory" });
    const storage2 = await initStorage({ type: "memory" });
    assert.strictEqual(storage1, storage2);
  });

  it("should return different instances for different supabase configurations", async () => {
    const storage1 = await initStorage({
      type: "supabase",
      supabaseUrl: "https://example.com/supabase1",
      supabaseServiceKey: "some-service-key-1",
    });
    const storage2 = await initStorage({
      type: "supabase",
      supabaseUrl: "https://example.com/supabase2",
      supabaseServiceKey: "some-service-key-2",
    });
    assert.notStrictEqual(storage1, storage2);
  });

  it("should return the same instance for identical supabase configurations", async () => {
    const storage1 = await initStorage({
      type: "supabase",
      supabaseUrl: "https://example.com/supabaseA",
      supabaseServiceKey: "some-service-key-A",
    });
    const storage2 = await initStorage({
      type: "supabase",
      supabaseUrl: "https://example.com/supabaseA",
      supabaseServiceKey: "some-service-key-A",
    });
    assert.strictEqual(storage1, storage2);
  });

  it("should return different instances if one option differs for supabase", async () => {
    const storage1 = await initStorage({
      type: "supabase",
      supabaseUrl: "https://example.com/supabaseB",
      supabaseServiceKey: "some-service-key-B",
    });
    const storage2 = await initStorage({
      type: "supabase",
      supabaseUrl: "https://example.com/supabaseB",
      supabaseServiceKey: "some-service-key-C",
    });
    assert.notStrictEqual(storage1, storage2);
  });

  it("should return different instances for different redis configurations", async () => {
    const storage1 = await initStorage({ type: "redis", redisUrl: "redis://host1" });
    const storage2 = await initStorage({ type: "redis", redisUrl: "redis://host2" });
    assert.notStrictEqual(storage1, storage2);
  });

  it("should return the same instance for identical redis configurations", async () => {
    const storage1 = await initStorage({ type: "redis", redisUrl: "redis://hostX" });
    const storage2 = await initStorage({ type: "redis", redisUrl: "redis://hostX" });
    assert.strictEqual(storage1, storage2);
  });

  it("should return different instances if options are partial or missing for supabase", async () => {
    const storage1 = await initStorage({
      type: "supabase",
      supabaseUrl: "https://example.com/supabaseD",
      supabaseServiceKey: "some-service-key-D",
    });
    // Un appel avec moins d'options devrait créer une nouvelle instance si la correspondance est stricte
    const storage2 = await initStorage({
      type: "supabase",
      supabaseUrl: "https://example.com/supabaseD",
    });
    assert.notStrictEqual(storage1, storage2);
  });
});

describe("File-based Storage Module", () => {
  const testBasePath = `./test_file_storage_data_${Date.now()}`;

  it("should return a file-based storage instance when type is 'file'", async () => {
    const storage = await initStorage({ type: "file", basePath: testBasePath });
    assert.strictEqual(storage.options.type, "file");
    assert.ok(storage.logicalAgents);
    await storage.clearCache(); // Clean up after test
  });

  it("should be able to upsert and retrieve a LogicalAgent identity", async () => {
    const storage = await initStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const identity = { logical_agent_id: "agent1", logical_agent_name: "Test handler", status: "active" };
    await storage.logicalAgents.upsert(identity);
    const retrievedAgent = await storage.logicalAgents.getById("agent1");
    assert.ok(retrievedAgent.ok);
    assert.deepStrictEqual(retrievedAgent.identity, identity);
    await storage.clearCache();
  });

  it("should be able to list LogicalAgent identities", async () => {
    const storage = await initStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    await storage.logicalAgents.upsert({
      logical_agent_id: "agent2",
      logical_agent_name: "identity Two",
      status: "active",
    });
    await storage.logicalAgents.upsert({
      logical_agent_id: "agent3",
      logical_agent_name: "identity Three",
      status: "inactive",
    });
    const { identities } = await storage.logicalAgents.list();
    assert.strictEqual(identities.length, 2);
    assert.ok(identities.some((a) => a.logical_agent_name === "identity Two"));
    await storage.clearCache();
  });

  it("should be able to update LogicalAgent identity status", async () => {
    const storage = await initStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const identity = { logical_agent_id: "agent4", logical_agent_name: "identity Four", status: "active" };
    await storage.logicalAgents.upsert(identity);
    const { ok, identity: updatedIdentity } = await storage.logicalAgents.updateStatus("agent4", "inactive");
    assert.ok(ok);
    assert.strictEqual(updatedIdentity.status, "inactive");
    await storage.clearCache();
  });

  it("should be able to upsert and retrieve a task", async () => {
    const storage = await initStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const task = { id: "task1", name: "Test Task", status: "pending", version: 0 };
    await storage.tasks.upsert(task);
    const retrievedTask = await storage.tasks.get("task1");
    assert.ok(retrievedTask.ok);
    assert.deepStrictEqual(retrievedTask.task, { ...task, version: 1 });
    await storage.clearCache();
  });

  it("should handle optimistic locking for tasks", async () => {
    const storage = await initStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const task = { id: "task2", name: "Test Task 2", status: "pending", version: 0 };
    await storage.tasks.upsert(task);
    const updateResult = await storage.tasks.update("task2", { status: "running", version: 0 });
    assert.ok(!updateResult.ok);
    assert.strictEqual(updateResult.code, storage.ERROR_CODES.OPTIMISTIC_LOCK_FAIL);
    await storage.clearCache();
  });

  it("should be able to upsert and retrieve a step", async () => {
    const storage = await initStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const step = { id: "step1", task_id: "task1", name: "Test Step", status: "created" };
    await storage.steps.upsert(step);
    const { steps } = await storage.steps.listByTask("task1");
    assert.strictEqual(steps.length, 1);
    assert.deepStrictEqual(steps[0], step);
    await storage.clearCache();
  });

  it("should be able to update a step", async () => {
    const storage = await initStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const step = { id: "step2", task_id: "task2", name: "Test Step 2", status: "created" };
    await storage.steps.upsert(step);
    const { ok, step: updatedStep } = await storage.steps.update("task2", "step2", {
      status: "running",
    });
    assert.ok(ok);
    assert.strictEqual(updatedStep.status, "running");
    await storage.clearCache();
  });

  it("should be able to upload and download an artifact", async () => {
    const storage = await initStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const fileContent = "Hello File World!";
    const { ok: uploadOk } = await storage.fileStorage.uploadArtifact(
      "test-bucket",
      "path/to/file.txt",
      fileContent
    );
    assert.ok(uploadOk);
    const { ok: downloadOk, data } = await storage.fileStorage.downloadArtifact(
      "test-bucket",
      "path/to/file.txt"
    );
    assert.ok(downloadOk);
    assert.strictEqual(data, fileContent);
    await storage.clearCache();
  });

  it("should return NOT_FOUND for non-existent artifact", async () => {
    const storage = await initStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    const { ok, code } = await storage.fileStorage.downloadArtifact(
      "test-bucket",
      "non-existent.txt"
    );
    assert.ok(!ok);
    assert.strictEqual(code, storage.ERROR_CODES.NOT_FOUND);
    await storage.clearCache();
  });

  it("should clear all file-based data when clearCache is called", async () => {
    const storage = await initStorage({ type: "file", basePath: testBasePath });
    await storage.clearCache();
    await storage.logicalAgents.upsert({
      logical_agent_id: "agent5",
      logical_agent_name: "identity Five",
      status: "active",
    });
    await storage.tasks.upsert({ id: "task3", name: "Task Three", status: "pending" });
    await storage.steps.upsert({
      id: "step3",
      task_id: "task3",
      name: "Step Three",
      status: "created",
    });
    await storage.fileStorage.uploadArtifact("test-bucket", "file.txt", "content");

    await storage.clearCache();

    const { identities } = await storage.logicalAgents.list();
    assert.strictEqual(identities.length, 0);
    const { tasks } = await storage.tasks.list();
    assert.strictEqual(tasks.length, 0);
    const { steps } = await storage.steps.listByTask("task3");
    assert.strictEqual(steps.length, 0);
    const { ok: fileOk } = await storage.fileStorage.downloadArtifact("test-bucket", "file.txt");
    assert.ok(!fileOk);
  });
});
