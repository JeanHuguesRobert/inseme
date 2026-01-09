import { Link } from "react-router-dom";
import { getMetadata } from "../../../../cop-host/src/lib/metadata.js";
import { TASK_STATUSES } from "../../lib/taskMetadata.js";

/**
 * Task Project Card Component
 *
 * Displays a project card with task statistics and quick info
 */
export default function TaskProjectCard({ project }) {
  const projectDetails = getMetadata(project, "project_details", {});
  const color = projectDetails.color || "#4F46E5";
  const icon = projectDetails.icon || "📋";
  const linkedMission = project?.metadata?.linked_mission;

  // Calculate task counts by status (placeholder - will be loaded from props or separate query)
  const taskStats = getMetadata(project, "task_stats", {
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0,
    blocked: 0,
  });

  const totalTasks = Object.values(taskStats).reduce((sum, count) => sum + count, 0);
  const completionRate = totalTasks > 0 ? Math.round((taskStats.done / totalTasks) * 100) : 0;

  return (
    <Link
      to={`/tasks/${project.id}`}
      className="block bg-white  border-2 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] overflow-hidden"
      style={{ borderColor: color }}
    >
      {/* Header with color stripe */}
      <div className="h-2" style={{ backgroundColor: color }} />

      <div className="p-6">
        {/* Icon and Title */}
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl" role="img" aria-label="project-icon">
            {icon}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 truncate mb-1">{project.name}</h3>
            {project.description && (
              <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
            )}
            {linkedMission?.name && (
              <p className="text-xs text-primary-700 font-semibold mt-1">
                Mission : {linkedMission.name}
              </p>
            )}
          </div>
        </div>

        {/* Task Statistics */}
        <div className="space-y-3">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progression</span>
              <span className="font-bold">{completionRate}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>

          {/* Status Counts */}
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div className="text-center">
              <div className="font-bold text-gray-700">{taskStats.todo}</div>
              <div className="text-gray-500">À faire</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-blue-700">{taskStats.in_progress}</div>
              <div className="text-gray-500">En cours</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-yellow-700">{taskStats.review}</div>
              <div className="text-gray-500">Revue</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-green-700">{taskStats.done}</div>
              <div className="text-gray-500">Terminé</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-red-700">{taskStats.blocked}</div>
              <div className="text-gray-500">Bloqué</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>
            {totalTasks} tâche{totalTasks !== 1 ? "s" : ""}
          </span>
          <span className="text-primary-600 font-bold hover:underline">Voir le projet →</span>
        </div>
      </div>
    </Link>
  );
}
