import React, { useState } from "react";

/**
 * Formulaire d'édition utilisateur
 */
export const UserForm = ({
  user,
  onSubmit = null,
  onCancel = null,
  showAdvanced = false,
  className = "",
}) => {
  // Initialize state from user entity properties
  const [formData, setFormData] = useState({
    pseudo: user.pseudo,
    // email is not in the new public User entity for privacy, but might be needed here if admin?
    // user.id, user.role, etc.
    role: user.baseRole || "client",
    zone: user.zone,

    // Status flags
    isOnDuty: user.isOnDuty,
    isGabrielMode: user.isGabrielMode,
    isHandsFree: user.isHandsFree,
    isSilent: user.isSilent,
    // status: user.status // Deprecated field, ignored
  });

  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation basique
    const newErrors = {};
    if (!formData.pseudo || formData.pseudo.length < 2) {
      newErrors.pseudo = "Le pseudo doit contenir au moins 2 caractères";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (onSubmit) onSubmit(formData);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`user-form space-y-4 ${className}`.trim()}>
      {/* Pseudo */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Pseudo *</label>
        <input
          type="text"
          value={formData.pseudo}
          onChange={(e) => handleChange("pseudo", e.target.value)}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.pseudo ? "border-red-500" : "border-gray-300"
          }`}
        />
        {errors.pseudo && <div className="text-sm text-red-600">{errors.pseudo}</div>}
      </div>

      {/* Rôle */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Rôle</label>
        <select
          value={formData.role}
          onChange={(e) => handleChange("role", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="client">Client</option>
          <option value="barman">Barman</option>
          <option value="moderator">Modérateur</option>
          <option value="admin">Administrateur</option>
        </select>
      </div>

      {/* Zone */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Zone</label>
        <select
          value={formData.zone}
          onChange={(e) => handleChange("zone", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="indoor">Intérieur</option>
          <option value="outdoor">Extérieur</option>
        </select>
      </div>

      {/* Options avancées */}
      {showAdvanced && (
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isOnDuty}
                onChange={(e) => handleChange("isOnDuty", e.target.checked)}
              />
              En service
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isGabrielMode}
                onChange={(e) => handleChange("isGabrielMode", e.target.checked)}
              />
              Mode Gabriel
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isHandsFree}
                onChange={(e) => handleChange("isHandsFree", e.target.checked)}
              />
              Mode mains libres
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isSilent}
                onChange={(e) => handleChange("isSilent", e.target.checked)}
              />
              Mode silencieux
            </label>
          </div>
        </div>
      )}

      {/* Boutons */}
      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Enregistrer
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  );
};
