import { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "../../lib/taskMetadata.js";
import { getTaskStatus, transitionTaskStatus } from "../../lib/taskHelpers.js";
import TaskCard from "./TaskCard";

function KanbanColumn({ status, tasks, projectId, onTaskClick, enableDrag }) {
  const statusLabel = TASK_STATUS_LABELS[status];
  const statusColors = TASK_STATUS_COLORS[status];
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });

  return (
    <div className="kanban-column flex-shrink-0 w-80">
      {/* Column Header */}
      <div className={`kanban-column-header p-3 rounded-t-lg border-2 ${statusColors}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm uppercase">{statusLabel}</h3>
          <span className="text-sm font-bold bg-white bg-opacity-50 px-2 py-0.5 rounded">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={`kanban-column-body p-2 bg-gray-50 rounded-b-lg border-2 border-t-0 border-gray-200 min-h-96 space-y-2 ${isOver ? "droppable-over" : ""}`}
        data-status={status}
      >
        {tasks.map((task) => (
          <DraggableTaskCard
            key={task.id}
            task={task}
            projectId={projectId}
            onTaskClick={onTaskClick}
            enableDrag={enableDrag}
          />
        ))}

        {tasks.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">Aucune tâche</div>
        )}
      </div>
    </div>
  );
}

function DraggableTaskCard({ task, projectId, onTaskClick, enableDrag }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { status: getTaskStatus(task) },
    disabled: !enableDrag,
  });

  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        task={task}
        projectId={projectId}
        compact={false}
        onClick={onTaskClick}
        draggable={enableDrag}
      />
    </div>
  );
}

export default function KanbanBoard({
  tasks,
  projectId,
  workflowStates,
  onTaskMove,
  currentUser,
  canEdit = false,
}) {
  const [tasksByStatus, setTasksByStatus] = useState({});
  const [activeTaskId, setActiveTaskId] = useState(null);
  const columnOrder = useMemo(
    () => (workflowStates.length ? workflowStates : Object.values(TASK_STATUSES)),
    [workflowStates]
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );
  const enableDrag = Boolean(canEdit && currentUser);

  // Group tasks by status
  useEffect(() => {
    const grouped = {};

    columnOrder.forEach((status) => {
      grouped[status] = [];
    });

    tasks.forEach((task) => {
      const status = getTaskStatus(task);
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push(task);
    });

    setTasksByStatus(grouped);
  }, [tasks, columnOrder]);

  const handleTaskClick = () => {
    // Navigation handled by TaskCard links
  };

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeTaskId),
    [tasks, activeTaskId]
  );

  const moveTaskLocally = (taskId, fromStatus, toStatus) => {
    setTasksByStatus((prev) => {
      const next = { ...prev };
      const fromList = [...(next[fromStatus] || [])];
      const toList = [...(next[toStatus] || [])];
      const taskIndex = fromList.findIndex((task) => task.id === taskId);
      if (taskIndex === -1) {
        return prev;
      }
      const [task] = fromList.splice(taskIndex, 1);
      toList.unshift(task);
      next[fromStatus] = fromList;
      next[toStatus] = toList;
      return next;
    });
  };

  const handleDragStart = (event) => {
    if (!enableDrag) return;
    setActiveTaskId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    if (!enableDrag) {
      setActiveTaskId(null);
      return;
    }

    const { active, over } = event;
    setActiveTaskId(null);
    if (!over) return;

    const fromStatus = active.data.current?.status;
    const toStatus = over.data.current?.status || over.id;
    if (!fromStatus || !toStatus || fromStatus === toStatus) {
      return;
    }

    moveTaskLocally(active.id, fromStatus, toStatus);

    if (!currentUser) {
      return;
    }

    const result = await transitionTaskStatus(
      active.id,
      toStatus,
      currentUser.id,
      "Kanban drag & drop"
    );
    if (!result.success) {
      console.error("Drag transition failed", result.error);
      if (onTaskMove) {
        onTaskMove();
      }
      return;
    }

    if (onTaskMove) {
      onTaskMove();
    }
  };

  return (
    <div className="kanban-board-container">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board flex gap-4 overflow-x-auto pb-4">
          {columnOrder.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status] || []}
              projectId={projectId}
              onTaskClick={handleTaskClick}
              enableDrag={enableDrag}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="cursor-grabbing">
              <TaskCard task={activeTask} projectId={projectId} draggable compact={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="mt-4 text-sm text-gray-500 text-center">
        {enableDrag
          ? "💡 Faites glisser les cartes pour changer de colonne ou ouvrez la tâche pour plus d’actions."
          : "💡 Ouvrez une tâche pour mettre à jour son statut et ses détails."}
      </div>
    </div>
  );
}
