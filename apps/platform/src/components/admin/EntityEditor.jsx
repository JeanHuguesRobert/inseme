import React, { useEffect, useState } from "react";
import { getEntity, updateEntity, updateEntityAsAdmin, deleteEntity } from "../../lib/adminApi.js";

export default function EntityEditor({ type, id, onClose, onSaved }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jsonValue, setJsonValue] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getEntity(type, id)
      .then((d) => {
        setItem(d);
        setJsonValue(JSON.stringify(d, null, 2));
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [type, id]);

  async function handleSave() {
    try {
      const parsed = JSON.parse(jsonValue);

      // If metadata was provided as a JSON string, try to parse it to an object
      if (parsed.metadata && typeof parsed.metadata === "string") {
        try {
          parsed.metadata = JSON.parse(parsed.metadata);
        } catch (e) {
          // keep as string but move it under a rawMetadata key so DB coercion won't fail
          parsed.metadata = { _raw: parsed.metadata };
        }
      }
      setLoading(true);

      // Build a patch that only updates real columns and merges unknown keys into `metadata`.
      const patch = {};
      const extras = {};

      // Ensure we have the original item loaded
      const original = item || (await getEntity(type, id));

      Object.keys(parsed).forEach((k) => {
        if (k === "id") return; // never update id

        // If the original row has this top-level key, treat it as a column to update
        if (Object.prototype.hasOwnProperty.call(original, k)) {
          patch[k] = parsed[k];
        } else {
          extras[k] = parsed[k];
        }
      });

      // Merge extras into metadata column (create if missing)
      const existingMeta = original.metadata || {};
      const mergedMeta = { ...existingMeta };

      // If parsed already contained a metadata key, merge that first
      if (parsed.metadata && typeof parsed.metadata === "object") {
        Object.assign(mergedMeta, parsed.metadata);
      }

      // Add other unknown keys under metadata
      Object.keys(extras).forEach((k) => {
        mergedMeta[k] = extras[k];
      });

      if (Object.keys(mergedMeta).length > 0) {
        patch.metadata = mergedMeta;
      }

      // Use admin endpoint by default for now (temporary bypass of RLS)
      let res = await updateEntityAsAdmin(type, id, patch);
      setItem(res);
      setJsonValue(JSON.stringify(res, null, 2));
      if (onSaved) onSaved(res);
    } catch (err) {
      const raw = err?.message || String(err);
      // Log details to console for debugging
      console.error("Entity save failed", { type, id, error: err, attemptedJson: jsonValue });

      let hint = "";
      if (
        /coerce|json|invalid input syntax for type json|cannot cast|invalid input syntax/i.test(raw)
      ) {
        hint =
          " Possible cause: a field has an invalid type (e.g. `metadata` is a string instead of an object) or you attempted to update a non-existent column. Move custom keys under `metadata` or ensure `metadata` is a valid JSON object.";
      }

      alert("Error saving: " + raw + hint);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer cet enregistrement ?")) return;
    setLoading(true);
    try {
      await deleteEntity(type, id);
      if (onClose) onClose();
    } catch (err) {
      alert("Error deleting: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!id) return <div>Sélectionnez un élément à éditer</div>;

  return (
    <div>
      <div className="mb-2 flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Editing {type} / {id}
        </h3>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-1 border ">
            Close
          </button>
          <button onClick={handleDelete} className="px-3 py-1 bg-red-600 text-white ">
            Delete
          </button>
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div>
          <textarea
            value={jsonValue}
            onChange={(e) => setJsonValue(e.target.value)}
            rows={20}
            className="w-full font-mono text-sm p-2 border "
          />

          <div className="mt-3 flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-primary-600 text-bauhaus-white ">
              Save
            </button>
            <button
              onClick={() => {
                setJsonValue(JSON.stringify(item, null, 2));
              }}
              className="px-4 py-2 border "
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
