import { useState } from "react";
import { TheBar } from "../../singletons/index.js";
import { Icon } from "../Icon";

export default function ZoneManager() {
  const [zones, setZones] = useState(TheBar.zones || []);
  const [editingId, setEditingId] = useState(null);
  const [newZone, setNewZone] = useState({ id: "", label: "" });

  const handleAddZone = () => {
    if (!newZone.id || !newZone.label) {
      alert("L'ID et le label sont requis");
      return;
    }

    if (zones.some((z) => z.id === newZone.id)) {
      alert("Cet ID existe déjà");
      return;
    }

    const updatedZones = [...zones, { ...newZone }];
    if (TheBar.updateZones(updatedZones)) {
      setZones(updatedZones);
      setNewZone({ id: "", label: "" });
    }
  };

  const handleUpdateZone = (zoneId, newLabel) => {
    const updatedZones = zones.map((z) => (z.id === zoneId ? { ...z, label: newLabel } : z));
    if (TheBar.updateZones(updatedZones)) {
      setZones(updatedZones);
      setEditingId(null);
    }
  };

  const handleDeleteZone = (zoneId) => {
    if (zones.length <= 1) {
      alert("Au moins une zone doit rester");
      return;
    }

    if (!confirm("Supprimer cette zone ?")) return;

    const updatedZones = zones.filter((z) => z.id !== zoneId);
    if (TheBar.updateZones(updatedZones)) {
      setZones(updatedZones);
    }
  };

  return (
    <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <h3 className="text-xl font-black uppercase tracking-widest mb-4 flex items-center gap-2">
        <Icon name="map" className="w-6 h-6" />
        Gestion des Zones
      </h3>

      {/* Zones existantes */}
      <div className="space-y-2 mb-6">
        {zones.map((zone) => (
          <div key={zone.id} className="flex items-center gap-2 p-2 border-2 border-black">
            {editingId === zone.id ? (
              <>
                <input
                  type="text"
                  value={zone.label}
                  onChange={(e) =>
                    setZones(
                      zones.map((z) => (z.id === zone.id ? { ...z, label: e.target.value } : z))
                    )
                  }
                  className="flex-1 px-2 py-1 border-2 border-black font-bold"
                  autoFocus
                />
                <button
                  onClick={() => handleUpdateZone(zone.id, zone.label)}
                  className="px-3 py-1 bg-mondrian-blue text-white font-black border-2 border-black hover:bg-blue-700"
                >
                  ✓
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1 bg-gray-200 font-black border-2 border-black hover:bg-gray-300"
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 font-bold">
                  {zone.label} <span className="text-xs text-gray-500">({zone.id})</span>
                </span>
                <button
                  onClick={() => setEditingId(zone.id)}
                  className="px-3 py-1 bg-mondrian-yellow font-black border-2 border-black hover:bg-yellow-300"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDeleteZone(zone.id)}
                  className="px-3 py-1 bg-mondrian-red text-white font-black border-2 border-black hover:bg-red-700"
                  disabled={zones.length <= 1}
                >
                  🗑
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Ajouter une zone */}
      <div className="border-t-4 border-black pt-4">
        <h4 className="font-black uppercase text-sm mb-2">Nouvelle Zone</h4>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ID (ex: terrace)"
            value={newZone.id}
            onChange={(e) =>
              setNewZone({ ...newZone, id: e.target.value.toLowerCase().replace(/\s+/g, "_") })
            }
            className="flex-1 px-3 py-2 border-2 border-black font-bold"
          />
          <input
            type="text"
            placeholder="Label (ex: Terrasse)"
            value={newZone.label}
            onChange={(e) => setNewZone({ ...newZone, label: e.target.value })}
            className="flex-1 px-3 py-2 border-2 border-black font-bold"
          />
          <button
            onClick={handleAddZone}
            className="px-4 py-2 bg-black text-white font-black border-2 border-black hover:bg-gray-800"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}
