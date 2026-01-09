// src/package/inseme/components/AgendaPanel.jsx
import React, { useState } from 'react';
import { ListChecks, Plus, CheckCircle2, Circle, PlayCircle } from 'lucide-react';

export function AgendaPanel({ agenda, updateAgenda }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [newItem, setNewItem] = useState('');

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newItem.trim()) return;
        const newAgenda = [...agenda, { id: Date.now(), text: newItem, status: 'pending' }];
        updateAgenda(newAgenda);
        setNewItem('');
    };

    const handleStatus = (targetId, status) => {
        // If setting to active, unset others? Usually yes for "Topic".
        const newAgenda = agenda.map(item => {
            if (item.id === targetId) return { ...item, status: status };
            if (status === 'active' && item.status === 'active') return { ...item, status: 'pending' };
            return item;
        });
        updateAgenda(newAgenda);
    };

    if (!agenda || agenda.length === 0) {
        if (!isExpanded) return null; // Or small toggle
    }

    return (
        <div className="bg-white/5 border-b border-white/10">
            <div
                className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/50">
                    <ListChecks className="w-4 h-4" />
                    Ordre du Jour
                </div>
                <span className="text-xs text-white/30">{agenda.filter(i => i.status === 'done').length}/{agenda.length}</span>
            </div>

            {isExpanded && (
                <div className="p-4 space-y-3">
                    <div className="space-y-2">
                        {agenda.map(item => (
                            <div key={item.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${item.status === 'active' ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-white/5'}`}>
                                <div className="flex-shrink-0">
                                    {item.status === 'done' && <CheckCircle2 className="w-5 h-5 text-emerald-500 cursor-pointer" onClick={() => handleStatus(item.id, 'pending')} />}
                                    {item.status === 'active' && <PlayCircle className="w-5 h-5 text-indigo-400 cursor-pointer animate-pulse" onClick={() => handleStatus(item.id, 'done')} />}
                                    {item.status === 'pending' && <Circle className="w-5 h-5 text-white/20 cursor-pointer hover:text-white/50" onClick={() => handleStatus(item.id, 'active')} />}
                                </div>
                                <span className={`text-sm flex-1 ${item.status === 'done' ? 'text-white/30 line-through' : (item.status === 'active' ? 'text-indigo-200 font-bold' : 'text-white/80')}`}>
                                    {item.text}
                                </span>
                            </div>
                        ))}
                        {agenda.length === 0 && <p className="text-xs text-center text-white/20 italic p-2">Aucun point à l'ordre du jour.</p>}
                    </div>

                    <form onSubmit={handleAdd} className="flex gap-2 pt-2 border-t border-white/5">
                        <input
                            type="text"
                            value={newItem}
                            onChange={(e) => setNewItem(e.target.value)}
                            placeholder="Ajouter un point..."
                            className="bg-black/20 text-xs text-white px-3 py-2 rounded-md flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                        />
                        <button className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-white transition-colors">
                            <Plus className="w-3 h-3" />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
