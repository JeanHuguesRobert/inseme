import { useState } from "react";
import { getSupabase } from "@inseme/cop-host";
import { parseTaskCommand, executeTaskCommand } from "../../lib/taskHelpers.js";
import { TASK_COMMAND_HELP } from "../../lib/taskMetadata.js";

const DEFAULT_HELP_TEXT = 'Exemples: "/status en_cours", "/assign @marie", "/priority urgente"';

export default function TaskCommandPanel({ taskId, currentUser, onCommandExecuted }) {
  const [commandText, setCommandText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isCommandEmpty = commandText.trim().length === 0;
  const isFormDisabled = isSubmitting || !currentUser;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!currentUser) {
      setErrorMessage("Connectez-vous pour lancer une commande.");
      setSuccessMessage("");
      return;
    }

    if (!getSupabase()) {
      setErrorMessage("Supabase n'est pas configuré.");
      setSuccessMessage("");
      return;
    }

    const trimmedCommand = commandText.trim();
    if (!trimmedCommand) {
      setErrorMessage("Saisissez une commande avant de l'exécuter.");
      setSuccessMessage("");
      return;
    }

    const parsedCommand = parseTaskCommand(trimmedCommand);
    if (!parsedCommand) {
      setErrorMessage("Commande invalide. Consultez les exemples ci-dessous.");
      setSuccessMessage("");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data: comment, error: commentError } = await getSupabase()
        .from("comments")
        .insert({
          post_id: taskId,
          user_id: currentUser.id,
          content: trimmedCommand,
          metadata: { schemaVersion: 1 },
        })
        .select()
        .single();

      if (commentError) {
        throw new Error(commentError.message || "Impossible d'enregistrer la commande.");
      }

      const result = await executeTaskCommand(taskId, parsedCommand, currentUser.id, comment.id);
      if (!result.success) {
        throw new Error(result.error || "Échec de l'exécution de la commande.");
      }

      setCommandText("");
      setSuccessMessage("Commande exécutée !");
      if (typeof onCommandExecuted === "function" && result.updatedPost) {
        onCommandExecuted(result.updatedPost);
      }
    } catch (error) {
      setErrorMessage(error.message || "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const helperText = successMessage || DEFAULT_HELP_TEXT;

  return (
    <div className="relative bg-white border border-gray-200  shadow-sm p-5">
      {!currentUser && (
        <div className="absolute inset-0  bg-white/85 backdrop-blur-sm flex items-center justify-center px-6 text-center z-10">
          <p className="text-sm font-medium text-gray-700">
            Connectez-vous pour exécuter des commandes rapides.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Commandes rapides</h3>
          <p className="text-sm text-gray-500">Pilotez la tâche avec des instructions courtes.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="sr-only" htmlFor={`task-command-${taskId}`}>
            Commande rapide
          </label>
          <textarea
            id={`task-command-${taskId}`}
            rows={3}
            value={commandText}
            onChange={(event) => setCommandText(event.target.value)}
            disabled={isFormDisabled}
            placeholder="Ex: /status en_cours"
            className="w-full px-4 py-3 border border-gray-300  focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm text-gray-800 resize-none disabled:bg-gray-50 disabled:text-gray-400"
          />

          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : (
            <p className={`text-sm ${successMessage ? "text-green-600" : "text-gray-500"}`}>
              {helperText}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isFormDisabled || isCommandEmpty}
              className="px-5 py-2 bg-primary-600 text-white text-sm font-semibold  hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Exécution..." : "Exécuter"}
            </button>
          </div>
        </form>

        <div className="border border-gray-100  bg-gray-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Commandes disponibles</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {Object.entries(TASK_COMMAND_HELP).map(([command, description]) => (
              <li key={command} className="flex items-start gap-3 px-4 py-3 text-sm text-gray-700">
                <span className="px-2 py-0.5 bg-white border border-gray-200 rounded font-mono text-xs text-gray-900">
                  {command}
                </span>
                <p className="flex-1 text-gray-600">{description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
