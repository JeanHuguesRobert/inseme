/**
 * Task Management Helper Functions
 *
 * Utilities for working with task metadata, commands, and state transitions
 */

import { getSupabase, getMetadata, setMetadata } from "@inseme/cop-host";
import {
  TASK_STATUSES,
  TASK_COMMANDS,
  isValidStatus,
  isValidPriority,
  parseTaskCommand as kudocracyParseTaskCommand,
  normalizeStatusArg,
} from "./taskMetadata.js";

/**
 * Get task details from post metadata
 */
export function getTaskDetails(post) {
  return getMetadata(post, "task_details", {});
}

/**
 * Get task status
 */
export function getTaskStatus(post) {
  const details = getTaskDetails(post);
  return details.status || TASK_STATUSES.TODO;
}

/**
 * Get task priority
 */
export function getTaskPriority(post) {
  const details = getTaskDetails(post);
  return details.priority || "medium";
}

/**
 * Get task assignees (array of user IDs)
 */
export function getTaskAssignees(post) {
  const details = getTaskDetails(post);
  return details.assignees || [];
}

/**
 * Get task labels/tags
 */
export function getTaskLabels(post) {
  const details = getTaskDetails(post);
  return details.labels || [];
}

/**
 * Get task due date
 */
export function getTaskDueDate(post) {
  const details = getTaskDetails(post);
  return details.due_date ? new Date(details.due_date) : null;
}

/**
 * Get task estimate
 */
export function getTaskEstimate(post) {
  const details = getTaskDetails(post);
  return details.estimate || null;
}

/**
 * Check if task is overdue
 */
export function isTaskOverdue(post) {
  const dueDate = getTaskDueDate(post);
  if (!dueDate) return false;

  const status = getTaskStatus(post);
  if (status === TASK_STATUSES.DONE) return false;

  return dueDate < new Date();
}

/**
 * Check if task is blocked
 */
export function isTaskBlocked(post) {
  const details = getTaskDetails(post);
  return details.status === TASK_STATUSES.BLOCKED || !!details.blocked_reason;
}

/**
 * Get status history
 */
export function getStatusHistory(post) {
  return getMetadata(post, "status_history", []);
}

/**
 * Parse task command from comment content
 * Returns { type, args } or null if not a command
 * Proxy to kudocracy implementation
 */
export function parseTaskCommand(content) {
  return kudocracyParseTaskCommand(content);
}

/**
 * Execute a task command and update the post
 * @param {string} taskId - Post ID of the task
 * @param {object} command - Parsed command object from parseTaskCommand
 * @param {string} userId - ID of user executing command
 * @param {string} commentId - ID of comment containing command
 * @returns {Promise<{success: boolean, error?: string, updatedPost?: object}>}
 */
export async function executeTaskCommand(taskId, command, userId, commentId) {
  try {
    // Fetch current task
    const { data: task, error: fetchError } = await getSupabase()
      .from("posts")
      .select("*")
      .eq("id", taskId)
      .single();

    if (fetchError) throw fetchError;

    const taskDetails = getTaskDetails(task);
    let updates = {};

    switch (command.type) {
      case TASK_COMMANDS.STATUS: {
        const newStatus = normalizeStatusArg(command.args[0]);
        if (!isValidStatus(newStatus)) {
          return { success: false, error: `Statut invalide: ${command.args[0]}` };
        }
        updates = await handleStatusChange(task, newStatus, userId, commentId);
        break;
      }

      case TASK_COMMANDS.ASSIGN: {
        const assigneeUsername = command.args[0]?.replace("@", "");
        if (!assigneeUsername) {
          return { success: false, error: "Nom d'utilisateur requis" };
        }
        updates = await handleAssign(task, assigneeUsername, userId);
        break;
      }

      case TASK_COMMANDS.UNASSIGN: {
        const unassigneeUsername = command.args[0]?.replace("@", "");
        updates = await handleUnassign(task, unassigneeUsername, userId);
        break;
      }

      case TASK_COMMANDS.PRIORITY: {
        const priority = normalizePriorityArg(command.args[0]);
        if (!isValidPriority(priority)) {
          return { success: false, error: `Priorité invalide: ${command.args[0]}` };
        }
        updates = { task_details: { ...taskDetails, priority } };
        break;
      }

      case TASK_COMMANDS.LABEL: {
        const label = command.args.join(" ");
        const currentLabels = taskDetails.labels || [];
        if (!currentLabels.includes(label)) {
          updates = { task_details: { ...taskDetails, labels: [...currentLabels, label] } };
        }
        break;
      }

      case TASK_COMMANDS.DUE: {
        const dueDate = command.args[0];
        updates = { task_details: { ...taskDetails, due_date: dueDate } };
        break;
      }

      case TASK_COMMANDS.ESTIMATE: {
        const estimate = command.args.join(" ");
        updates = { task_details: { ...taskDetails, estimate } };
        break;
      }

      case TASK_COMMANDS.BLOCK: {
        const blockReason = command.args.join(" ");
        updates = {
          task_details: {
            ...taskDetails,
            status: TASK_STATUSES.BLOCKED,
            blocked_reason: blockReason,
          },
        };
        break;
      }

      case TASK_COMMANDS.UNBLOCK:
        updates = {
          task_details: {
            ...taskDetails,
            status: TASK_STATUSES.TODO,
            blocked_reason: null,
          },
        };
        break;

      default:
        return { success: false, error: `Commande non reconnue: ${command.type}` };
    }

    // Apply updates
    const updatedMetadata = {
      ...task.metadata,
      ...updates,
    };

    const { data: updatedPost, error: updateError } = await getSupabase()
      .from("posts")
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update comment metadata to mark it as a command
    await getSupabase()
      .from("comments")
      .update({
        metadata: {
          ...{},
          command: {
            type: command.type.replace("/", ""),
            executed: true,
            executed_at: new Date().toISOString(),
          },
        },
      })
      .eq("id", commentId);

    return { success: true, updatedPost };
  } catch (error) {
    console.error("Error executing task command:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle status change with history tracking
 */
async function handleStatusChange(task, newStatus, userId, commentId) {
  const taskDetails = getTaskDetails(task);
  const currentStatus = taskDetails.status || TASK_STATUSES.TODO;

  const statusHistory = getStatusHistory(task);
  const historyEntry = {
    status: newStatus,
    from: currentStatus,
    changed_by: userId,
    changed_at: new Date().toISOString(),
    comment_id: commentId,
  };

  return {
    task_details: {
      ...taskDetails,
      status: newStatus,
    },
    status_history: [...statusHistory, historyEntry],
  };
}

/**
 * Handle user assignment
 */
async function handleAssign(task, username, userId) {
  // Find user by display name
  const { data: users } = await getSupabase()
    .from("users")
    .select("id")
    .ilike("display_name", username)
    .limit(1);

  if (!users || users.length === 0) {
    throw new Error(`Utilisateur non trouvé: ${username}`);
  }

  const taskDetails = getTaskDetails(task);
  const currentAssignees = taskDetails.assignees || [];
  const newAssigneeId = users[0].id;

  if (currentAssignees.includes(newAssigneeId)) {
    return {}; // Already assigned
  }

  return {
    task_details: {
      ...taskDetails,
      assignees: [...currentAssignees, newAssigneeId],
    },
  };
}

/**
 * Handle user unassignment
 */
async function handleUnassign(task, username, userId) {
  const taskDetails = getTaskDetails(task);
  let assignees = taskDetails.assignees || [];

  if (username) {
    // Unassign specific user
    const { data: users } = await getSupabase()
      .from("users")
      .select("id")
      .ilike("display_name", username)
      .limit(1);

    if (users && users.length > 0) {
      assignees = assignees.filter((id) => id !== users[0].id);
    }
  } else {
    // Unassign current user
    assignees = assignees.filter((id) => id !== userId);
  }

  return {
    task_details: {
      ...taskDetails,
      assignees,
    },
  };
}

/**
 * Normalize priority argument from French to internal format
 */
function normalizePriorityArg(arg) {
  if (!arg) return null;

  const normalized = arg.toLowerCase();

  const mapping = {
    basse: "low",
    low: "low",
    moyenne: "medium",
    medium: "medium",
    haute: "high",
    high: "high",
    urgente: "urgent",
    urgent: "urgent",
  };

  return mapping[normalized] || normalized;
}

/**
 * Transition task status (called when dragging in Kanban)
 */
export async function transitionTaskStatus(taskId, newStatus, userId, reason = "Drag & drop") {
  try {
    const { data: task, error: fetchError } = await getSupabase()
      .from("posts")
      .select("*")
      .eq("id", taskId)
      .single();

    if (fetchError) throw fetchError;

    // Create a system comment for the transition
    const { data: comment, error: commentError } = await getSupabase()
      .from("comments")
      .insert({
        post_id: taskId,
        user_id: userId,
        content: `Changement de statut via ${reason}`,
        metadata: {
          schemaVersion: 1,
          system: true,
          command: {
            type: "status_change",
            executed: true,
            executed_at: new Date().toISOString(),
          },
        },
      })
      .select()
      .single();

    if (commentError) throw commentError;

    // Update task status
    const updates = await handleStatusChange(task, newStatus, userId, comment.id);

    const updatedMetadata = {
      ...task.metadata,
      ...updates,
    };

    const { data: updatedPost, error: updateError } = await getSupabase()
      .from("posts")
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select()
      .single();

    if (updateError) throw updateError;

    return { success: true, updatedPost };
  } catch (error) {
    console.error("Error transitioning task status:", error);
    return { success: false, error: error.message };
  }
}

export function extractTaskTitle(content) {
  if (!content || typeof content !== "string") {
    return "Sans titre";
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return "Sans titre";
  }

  const firstLine = trimmed.split(/\r?\n/)[0];
  const normalized = firstLine.replace(/^#+\s*/, "").trim();
  return normalized || "Sans titre";
}

export function extractTaskDescription(content) {
  if (!content || typeof content !== "string") {
    return "";
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return "";
  }

  const lines = trimmed.split(/\r?\n/);
  lines.shift();
  return lines.join("\n").trim();
}

export function getTaskTitleFromPost(post) {
  const content = post?.content || "";
  return extractTaskTitle(content);
}

export function getTaskBodyFromPost(post) {
  const content = post?.content || "";
  return extractTaskDescription(content);
}

export function buildTaskContent(title, body) {
  const safeTitle = typeof title === "string" ? title.trim() : "";
  const safeBody = typeof body === "string" ? body.trim() : "";

  if (!safeTitle && !safeBody) {
    return "";
  }

  const sections = [];
  if (safeTitle) {
    sections.push(`# ${safeTitle}`);
  }
  if (safeBody) {
    sections.push(safeBody);
  }

  return sections.join("\n\n");
}
