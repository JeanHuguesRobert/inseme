import { Link } from "react-router-dom";
import {
  getTaskStatus,
  getTaskPriority,
  getTaskAssignees,
  getTaskLabels,
  getTaskDueDate,
  isTaskOverdue,
  isTaskBlocked,
  getTaskTitleFromPost,
} from "../../lib/taskHelpers.js";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_ICONS,
  TASK_PRIORITY_COLORS,
} from "../../lib/taskMetadata.js";

/**
 * Task Card Component
 *
 * Compact card for displaying a task in Kanban board or list view
 */
export default function TaskCard({ task, projectId, compact = false, onClick, draggable = false }) {
  const status = getTaskStatus(task);
  const priority = getTaskPriority(task);
  const assignees = getTaskAssignees(task);
  const labels = getTaskLabels(task);
  const dueDate = getTaskDueDate(task);
  const overdue = isTaskOverdue(task);
  const blocked = isTaskBlocked(task);

  const taskUrl = `/tasks/${projectId}/task/${task.id}`;

  const title = getTaskTitleFromPost(task);

  const handleClick = (e) => {
    if (onClick) {
      e.preventDefault();
      onClick(task);
    }
  };

  return (
    <Link
      to={taskUrl}
      onClick={handleClick}
      className={`block bg-white  border shadow-sm hover:shadow-md transition-all p-4 ${
        draggable ? "cursor-move" : "cursor-pointer"
      } ${blocked ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-primary-300"}`}
      draggable={draggable}
    >
      {/* Priority Indicator */}
      <div className="flex items-start gap-2 mb-2">
        <span
          className={`text-lg ${TASK_PRIORITY_COLORS[priority]}`}
          title={`Priorité: ${priority}`}
        >
          {TASK_PRIORITY_ICONS[priority]}
        </span>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 line-clamp-2 text-sm">{title}</h4>
        </div>
      </div>

      {/* Labels */}
      {labels.length > 0 && !compact && (
        <div className="flex flex-wrap gap-1 mb-2">
          {labels.slice(0, 3).map((label, idx) => (
            <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
              {label}
            </span>
          ))}
          {labels.length > 3 && <span className="text-xs text-gray-500">+{labels.length - 3}</span>}
        </div>
      )}

      {/* Footer: Assignees and Due Date */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
        {/* Assignees */}
        <div className="flex -space-x-2">
          {assignees.length > 0 ? (
            <>
              {assignees.slice(0, 3).map((assigneeId, idx) => (
                <div
                  key={assigneeId}
                  className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-600"
                  title={`Assigné ${idx + 1}`}
                >
                  {idx + 1}
                </div>
              ))}
              {assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs text-gray-600">
                  +{assignees.length - 3}
                </div>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-400">Non assigné</span>
          )}
        </div>

        {/* Due Date */}
        {dueDate && !compact && (
          <span
            className={`text-xs ${overdue ? "text-red-600 font-bold" : "text-gray-500"}`}
            title={dueDate.toLocaleDateString("fr-FR")}
          >
            📅 {dueDate.toLocaleDateString("fr-FR", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>

      {/* Blocked Indicator */}
      {blocked && (
        <div className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1">
          🚫 Bloqué
        </div>
      )}
    </Link>
  );
}
