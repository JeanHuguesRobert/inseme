import React from "react";

export default function PropositionForm({
  show = false,
  onClose = () => {},
  title,
  description,
  setTitle = () => {},
  setDescription = () => {},
  onCreate = async () => {},
  suggestedTags = [],
  selectedTags = [],
  setSelectedTags = () => {},
}) {
  if (!show) return null;

  return (
    <div className="proposition-form-overlay">
      <div className="proposition-form">
        <div className="form-header">
          <h3>Créer une nouvelle proposition</h3>
          <button onClick={onClose} className="close-btn">
            ×
          </button>
        </div>

        <div className="form-group">
          <label>Titre</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            className="form-textarea"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Tags UI */}
        <div className="form-group">
          <label>Tags suggérés</label>
          <div
            className="tags-container"
            style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}
          >
            {suggestedTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`tag-badge ${selectedTags.includes(tag) ? "selected" : ""}`}
                onClick={() => {
                  if (selectedTags.includes(tag)) {
                    setSelectedTags(selectedTags.filter((t) => t !== tag));
                  } else {
                    setSelectedTags([...selectedTags, tag]);
                  }
                }}
                style={{
                  padding: "4px 8px",
                  border: "1px solid #ccc",
                  background: selectedTags.includes(tag) ? "#007bff" : "#f0f0f0",
                  color: selectedTags.includes(tag) ? "white" : "black",
                  cursor: "pointer",
                  fontSize: "0.9em",
                }}
              >
                {tag} {selectedTags.includes(tag) ? "×" : "+"}
              </button>
            ))}
            {suggestedTags.length === 0 && (
              <span style={{ color: "#888", fontStyle: "italic" }}>
                Aucune suggestion pour le moment
              </span>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={() => onCreate({ title, description, tags: selectedTags })}
          >
            Créer la proposition
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
