export const LEGACY_TASK_WORKERS_ENV = "COP_ENABLE_LEGACY_TASK_WORKERS";

export function legacyTaskWorkersEnabled(env = {}) {
  return env?.[LEGACY_TASK_WORKERS_ENV] === "1";
}
