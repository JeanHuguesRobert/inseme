/**
 * Task Management Constants and Pure Logic
 */

export const TASK_STATUSES = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  DONE: "done",
  BLOCKED: "blocked",
};

export const TASK_STATUS_LABELS = {
  todo: "À faire",
  in_progress: "En cours",
  review: "En revue",
  done: "Terminé",
  blocked: "Bloqué",
};

export const TASK_PRIORITIES = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

export const TASK_COMMANDS = {
  STATUS: "/status",
  ASSIGN: "/assign",
  UNASSIGN: "/unassign",
  PRIORITY: "/priority",
  LABEL: "/label",
  DUE: "/due",
  ESTIMATE: "/estimate",
  BLOCK: "/block",
  UNBLOCK: "/unblock",
};

/**
 * Parse task command from content
 * Returns { type, args, raw } or null if not a command
 */
export function parseTaskCommand(content) {
  if (!content || typeof content !== "string") return null;

  const trimmed = content.trim();
  if (!trimmed.startsWith("/")) return null;

  // Extract command and arguments
  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Validate known commands
  const validCommands = Object.values(TASK_COMMANDS);
  if (!validCommands.includes(command)) return null;

  return {
    type: command,
    args: args,
    raw: trimmed,
  };
}

/**
 * Normalize status argument from user input
 */
export function normalizeStatusArg(arg) {
  if (!arg) return "";
  const normalized = arg.toLowerCase().replace(/-/g, "_");

  const mapping = {
    "à faire": TASK_STATUSES.TODO,
    todo: TASK_STATUSES.TODO,
    "en cours": TASK_STATUSES.IN_PROGRESS,
    in_progress: TASK_STATUSES.IN_PROGRESS,
    "en revue": TASK_STATUSES.REVIEW,
    review: TASK_STATUSES.REVIEW,
    terminé: TASK_STATUSES.DONE,
    done: TASK_STATUSES.DONE,
    bloqué: TASK_STATUSES.BLOCKED,
    blocked: TASK_STATUSES.BLOCKED,
  };

  return mapping[normalized] || normalized;
}

export function isValidStatus(status) {
  return Object.values(TASK_STATUSES).includes(status);
}

export function isValidPriority(priority) {
  return Object.values(TASK_PRIORITIES).includes(priority);
}
