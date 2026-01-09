/**
 * Task Management Metadata Constants and Types
 *
 * Defines standard statuses, priorities, commands, and labels for the Kanban task system
 */

import {
  TASK_STATUSES as K_STATUSES,
  TASK_STATUS_LABELS as K_LABELS,
  TASK_PRIORITIES as K_PRIORITIES,
  TASK_COMMANDS as K_COMMANDS,
  parseTaskCommand,
  normalizeStatusArg,
} from "@inseme/kudocracy";

// Task workflow statuses
export const TASK_STATUSES = K_STATUSES;

// Human-readable labels for task statuses
export const TASK_STATUS_LABELS = K_LABELS;

// Task status colors for UI display
export const TASK_STATUS_COLORS = {
  todo: "bg-gray-100 text-gray-700 border-gray-300",
  in_progress: "bg-blue-100 text-blue-700 border-blue-300",
  review: "bg-yellow-100 text-yellow-700 border-yellow-300",
  done: "bg-green-100 text-green-700 border-green-300",
  blocked: "bg-red-100 text-red-700 border-red-300",
};

// Task priority levels
export const TASK_PRIORITIES = K_PRIORITIES;

// Human-readable labels for priorities
export const TASK_PRIORITY_LABELS = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
  urgent: "Urgente",
};

// Priority colors and indicators
export const TASK_PRIORITY_COLORS = {
  low: "text-gray-500",
  medium: "text-blue-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

export const TASK_PRIORITY_ICONS = {
  low: "⬇️",
  medium: "➡️",
  high: "⬆️",
  urgent: "🔥",
};

// Comment commands for task management
export const TASK_COMMANDS = K_COMMANDS;

export { parseTaskCommand, normalizeStatusArg };

// Command descriptions for help text
export const TASK_COMMAND_HELP = {
  "/status": "Changer le statut (ex: /status en-cours)",
  "/assign": "Assigner à un utilisateur (ex: /assign @username)",
  "/unassign": "Retirer l'assignation (ex: /unassign @username)",
  "/priority": "Définir la priorité (ex: /priority haute)",
  "/label": "Ajouter un label (ex: /label bug)",
  "/due": "Définir une échéance (ex: /due 2025-12-15)",
  "/estimate": "Estimer le temps (ex: /estimate 3h)",
  "/block": "Bloquer la tâche (ex: /block En attente de..)",
  "/unblock": "Débloquer la tâche",
};

// Default workflow states for new projects
export const DEFAULT_WORKFLOW_STATES = [
  TASK_STATUSES.TODO,
  TASK_STATUSES.IN_PROGRESS,
  TASK_STATUSES.REVIEW,
  TASK_STATUSES.DONE,
  TASK_STATUSES.BLOCKED,
];

// Project view modes
export const PROJECT_VIEW_MODES = {
  KANBAN: "kanban",
  LIST: "list",
  TIMELINE: "timeline",
};

// Helper function to validate status
export function isValidStatus(status) {
  return Object.values(TASK_STATUSES).includes(status);
}

// Helper function to validate priority
export function isValidPriority(priority) {
  return Object.values(TASK_PRIORITIES).includes(priority);
}

// Helper to get status label
export function getStatusLabel(status) {
  return TASK_STATUS_LABELS[status] || status;
}

// Helper to get priority label
export function getPriorityLabel(priority) {
  return TASK_PRIORITY_LABELS[priority] || priority;
}
