import { useEffect, useMemo, useState } from "react";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "../../lib/taskMetadata.js";

const PRIORITY_VALUES = Object.values(TASK_PRIORITIES);

const normalizeLabels = (value) => {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];

  const seen = new Set();
  const cleaned = [];

  raw.forEach((label) => {
    const trimmed = (label || "").trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push(trimmed);
    }
  });

  return cleaned;
};

const formatDateForInput = (value) => {
  if (!value) {
    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return "";
};

const buildInitialState = (values = {}, workflowStates = []) => {
  const normalizedLabels = normalizeLabels(values.labels);
  const defaultStatus = (() => {
    if (values.status && workflowStates.includes(values.status)) {
      return values.status;
    }
    if (!workflowStates.length && values.status) {
      return values.status;
    }
    return workflowStates[0] || "";
  })();

  return {
    title: values.title || "",
    description: values.description || "",
    status: defaultStatus,
    priority: PRIORITY_VALUES.includes(values.priority) ? values.priority : TASK_PRIORITIES.MEDIUM,
    dueDate: formatDateForInput(values.dueDate),
    estimate: values.estimate || "",
    labelsInput: normalizedLabels.join(", "),
    assignees: Array.isArray(values.assignees) ? values.assignees.filter(Boolean) : [],
  };
};

const extractMemberInfo = (member) => {
  const relatedUser = member?.users || member?.user || member?.profile;
  const id = member?.user_id || relatedUser?.id || member?.id;
  const name =
    relatedUser?.display_name ||
    member?.display_name ||
    member?.metadata?.display_name ||
    "Membre sans nom";
  const role = member?.metadata?.role || member?.role || null;

  return { id, name, role };
};

export default function TaskForm({
  project,
  members,
  workflowStates,
  initialValues,
  onSubmit,
  submitting,
  submitLabel,
}) {
  const [formValues, setFormValues] = useState(() =>
    buildInitialState(initialValues, workflowStates)
  );
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormValues(buildInitialState(initialValues, workflowStates));
    setErrors({});
  }, [initialValues, workflowStates]);

  const statusOptions = useMemo(() => {
    const seen = new Set();
    const merged = [...workflowStates, formValues.status].filter(Boolean);
    const unique = [];
    merged.forEach((status) => {
      if (!seen.has(status)) {
        seen.add(status);
        unique.push(status);
      }
    });
    return unique;
  }, [workflowStates, formValues.status]);

  const assigneeOptions = useMemo(() => {
    const seen = new Set();
    const list = [];

    (members || []).forEach((member) => {
      const info = extractMemberInfo(member);
      if (!info.id || seen.has(info.id)) {
        return;
      }
      seen.add(info.id);
      list.push(info);
    });

    return list.sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
  }, [members]);

  const labelsPreview = useMemo(
    () => normalizeLabels(formValues.labelsInput),
    [formValues.labelsInput]
  );

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const toggleAssignee = (memberId) => {
    setFormValues((prev) => {
      const exists = prev.assignees.includes(memberId);
      return {
        ...prev,
        assignees: exists
          ? prev.assignees.filter((id) => id !== memberId)
          : [...prev.assignees, memberId],
      };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmedTitle = formValues.title.trim();
    if (!trimmedTitle) {
      setErrors((prev) => ({ ...prev, title: "Le titre est requis." }));
      return;
    }

    const trimmedDescription = formValues.description.trim();
    const trimmedEstimate = formValues.estimate.trim();
    const dueDate = formValues.dueDate ? formValues.dueDate : null;

    const payload = {
      title: trimmedTitle,
      description: trimmedDescription,
      status: formValues.status || statusOptions[0] || "",
      priority: formValues.priority,
      dueDate,
      estimate: trimmedEstimate || null,
      labels: labelsPreview,
      assignees: formValues.assignees,
    };

    onSubmit(payload);
  };

  return (
    <div className="bg-white  border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <p className="text-sm text-gray-600">
          Vous travaillez sur{" "}
          <span className="font-semibold text-gray-900">{project?.name || "ce projet"}</span>.
        </p>
        {project?.description && (
          <p className="text-xs text-gray-500 mt-1">{project.description}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div>
          <label htmlFor="task-title" className="block text-sm font-bold text-gray-700 mb-2">
            Titre de la tâche *
          </label>
          <input
            id="task-title"
            type="text"
            value={formValues.title}
            onChange={handleChange("title")}
            className={`w-full px-4 py-2 border  focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              errors.title ? "border-red-400" : "border-gray-300"
            }`}
            placeholder="Ex: Préparer le brief pour le conseil"
            required
          />
          {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
        </div>

        <div>
          <label htmlFor="task-description" className="block text-sm font-bold text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="task-description"
            rows={4}
            value={formValues.description}
            onChange={handleChange("description")}
            className="w-full px-4 py-2 border border-gray-300  focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Ajoutez du contexte, les étapes ou les liens utiles..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="task-status" className="block text-sm font-bold text-gray-700 mb-2">
              Statut
            </label>
            <select
              id="task-status"
              value={formValues.status}
              onChange={handleChange("status")}
              className="w-full px-4 py-2 border border-gray-300  focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {statusOptions.length === 0 && <option value="">Aucun statut disponible</option>}
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status] || status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="task-priority" className="block text-sm font-bold text-gray-700 mb-2">
              Priorité
            </label>
            <select
              id="task-priority"
              value={formValues.priority}
              onChange={handleChange("priority")}
              className="w-full px-4 py-2 border border-gray-300  focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {PRIORITY_VALUES.map((priority) => (
                <option key={priority} value={priority}>
                  {TASK_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="task-due-date" className="block text-sm font-bold text-gray-700 mb-2">
              Échéance
            </label>
            <input
              id="task-due-date"
              type="date"
              value={formValues.dueDate}
              onChange={handleChange("dueDate")}
              className="w-full px-4 py-2 border border-gray-300  focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="task-estimate" className="block text-sm font-bold text-gray-700 mb-2">
              Estimation
            </label>
            <input
              id="task-estimate"
              type="text"
              value={formValues.estimate}
              onChange={handleChange("estimate")}
              className="w-full px-4 py-2 border border-gray-300  focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Ex: 3h, 2j, Sprint 5"
            />
          </div>
        </div>

        <div>
          <label htmlFor="task-labels" className="block text-sm font-bold text-gray-700 mb-2">
            Labels
          </label>
          <input
            id="task-labels"
            type="text"
            value={formValues.labelsInput}
            onChange={handleChange("labelsInput")}
            className="w-full px-4 py-2 border border-gray-300  focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Ex: bug, UX, sprint-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Séparez les labels par des virgules pour aider l'équipe à filtrer rapidement.
          </p>
          {labelsPreview.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {labelsPreview.map((label) => (
                <span key={label} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-2">Aucun label pour le moment.</p>
          )}
        </div>

        <div>
          <p className="block text-sm font-bold text-gray-700 mb-2">Assignations</p>
          <p className="text-xs text-gray-500 mb-3">
            Choisissez les membres qui suivront la tâche (facultatif).
          </p>
          {assigneeOptions.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun membre disponible pour ce projet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assigneeOptions.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-3 p-3 border border-gray-200  hover:border-primary-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formValues.assignees.includes(member.id)}
                    onChange={() => toggleAssignee(member.id)}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    {member.role && <p className="text-xs text-gray-500">{member.role}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-primary-600 text-white  font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Enregistrement..." : submitLabel || "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
