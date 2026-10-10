import React, { useState } from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
import { BloodGroup, ComponentType, SurgeIncident } from '../../types/blood';
import { X, Plus, Trash2, Zap, AlertTriangle } from 'lucide-react';

interface NewIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewIncidentModal: React.FC<NewIncidentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { nodes, createIncident } = useVitaSync();

  const [targetNodeId, setTargetNodeId] = useState(nodes[1]?.id || 'node-metro');
  const [incidentType, setIncidentType] = useState<SurgeIncident['type']>('MASS_CASUALTY');
  const [title, setTitle] = useState('Critical Trauma Bay Surge - STAT Request');
  const [urgencyMinutes, setUrgencyMinutes] = useState(30);
  const [operationalNotes, setOperationalNotes] = useState(
    'Acute hemorrhagic shock admissions requiring emergency redistribution replenishment.'
  );

  const [requestedItems, setRequestedItems] = useState<
    Array<{
      component: ComponentType;
      bloodGroup: BloodGroup;
      quantity: number;
      priority: 'STAT' | 'URGENT' | 'ROUTINE';
    }>
  >([
    { component: 'PRBC', bloodGroup: 'O-', quantity: 3, priority: 'STAT' },
    { component: 'PRBC', bloodGroup: 'O+', quantity: 2, priority: 'STAT' },
    { component: 'PLATELETS', bloodGroup: 'O+', quantity: 2, priority: 'STAT' },
  ]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setRequestedItems((prev) => [
      ...prev,
      { component: 'PRBC', bloodGroup: 'A+', quantity: 2, priority: 'URGENT' },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setRequestedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    setRequestedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestedItems.length === 0) return;

    createIncident({
      incidentNumber: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
      title,
      type: incidentType,
      targetNodeId,
      urgencyMinutes,
      requestedUnits: requestedItems,
      operationalNotes,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Create Emergency Redistribution Surge
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Incident Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-rose-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Target Medical Facility
              </label>
              <select
                value={targetNodeId}
                onChange={(e) => setTargetNodeId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-rose-500"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Urgency Deadline (Minutes)
              </label>
              <input
                type="number"
                min={10}
                max={180}
                value={urgencyMinutes}
                onChange={(e) => setUrgencyMinutes(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono tabular-nums focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Requested Items Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-300 font-semibold">
                Requested Blood Components ({requestedItems.length})
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-rose-400 hover:text-rose-300 font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {requestedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-slate-950 rounded border border-slate-800 flex items-center gap-2"
                >
                  <select
                    value={item.component}
                    onChange={(e) => handleUpdateItem(idx, 'component', e.target.value)}
                    className="flex-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200"
                  >
                    <option value="PRBC">PRBC (Red Cells)</option>
                    <option value="PLATELETS">Platelets</option>
                    <option value="FFP">FFP (Plasma)</option>
                    <option value="CRYO">Cryo</option>
                  </select>

                  <select
                    value={item.bloodGroup}
                    onChange={(e) => handleUpdateItem(idx, 'bloodGroup', e.target.value)}
                    className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono font-bold"
                  >
                    <option value="O-">O-</option>
                    <option value="O+">O+</option>
                    <option value="A-">A-</option>
                    <option value="A+">A+</option>
                    <option value="B-">B-</option>
                    <option value="B+">B+</option>
                    <option value="AB-">AB-</option>
                    <option value="AB+">AB+</option>
                  </select>

                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={item.quantity}
                    onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono tabular-nums text-center"
                  />

                  <select
                    value={item.priority}
                    onChange={(e) => handleUpdateItem(idx, 'priority', e.target.value)}
                    className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200"
                  >
                    <option value="STAT">STAT</option>
                    <option value="URGENT">URGENT</option>
                    <option value="ROUTINE">ROUTINE</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              Operational Context Notes
            </label>
            <textarea
              rows={2}
              value={operationalNotes}
              onChange={(e) => setOperationalNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded shadow-sm transition-colors"
            >
              Run Multi-Criteria Optimization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
