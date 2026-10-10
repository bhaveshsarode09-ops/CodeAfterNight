import React, { useState, useMemo } from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
import { ActiveTab } from '../TopNav';
import {
  Navigation,
  AlertTriangle,
  Radio,
  Truck,
  ShieldAlert,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ArrowRight,
  MapPin,
  Activity,
  Zap,
} from 'lucide-react';

interface TrafficSimulationViewProps {
  onNavigateToTab: (tab: ActiveTab) => void;
}

export const TrafficSimulationView: React.FC<TrafficSimulationViewProps> = ({ onNavigateToTab }) => {
  const {
    nodes,
    roadEdges,
    corridorRequests,
    vehicleAvailable,
    updateRoadEdgeState,
    requestSimulatedCorridor,
    decideSimulatedCorridor,
    toggleVehicleAvailability,
    refreshAllState,
  } = useVitaSync();

  const [selectedSourceId, setSelectedSourceId] = useState<string>('node-apex');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('node-metro');
  const [operatorCallsign, setOperatorCallsign] = useState<string>('Central ResQtech Dispatcher');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Group road edges by pair or display
  const activeCorridorRequests = corridorRequests || [];

  // Toggle closure for a road edge
  const handleToggleClosure = async (edge: any) => {
    try {
      const newClosed = !edge.isClosed;
      await updateRoadEdgeState(edge.id, newClosed, edge.additionalDelayMin);
      setActionFeedback(`Segment ${edge.roadName} (${edge.id}) closure set to: ${newClosed}`);
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    }
  };

  // Add delay to a road edge
  const handleAddDelay = async (edge: any, deltaMinutes: number) => {
    try {
      const newDelay = Math.max(0, (edge.additionalDelayMin || 0) + deltaMinutes);
      await updateRoadEdgeState(edge.id, edge.isClosed, newDelay);
      setActionFeedback(`Segment ${edge.roadName} delay updated: +${newDelay}m.`);
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    }
  };

  // Request new priority corridor
  const handleRequestCorridor = async () => {
    try {
      const transferId = `TRF-RQ-${Date.now().toString(36).toUpperCase()}`;
      const res = await requestSimulatedCorridor(transferId, selectedSourceId, selectedTargetId);
      if (res) {
        setActionFeedback(`Corridor request logged: ${res.id} (${res.status}).`);
      }
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    }
  };

  // Change corridor status
  const handleTransitionCorridor = async (corridorId: string, status: any) => {
    try {
      await decideSimulatedCorridor(corridorId, status, `Manual transition by ${operatorCallsign}`);
      setActionFeedback(`Corridor ${corridorId} transitioned to ${status}.`);
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    }
  };

  // Toggle vehicle availability
  const handleToggleVehicle = async () => {
    try {
      const next = !vehicleAvailable;
      await toggleVehicleAvailability(next);
      setActionFeedback(`Transport vehicle status updated: ${next ? 'OPERATIONAL' : 'GROUNDED / UNAVAILABLE'}`);
    } catch (err: any) {
      setActionFeedback(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Strict Regulatory & Safety Disclaimer */}
      <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <span className="font-semibold text-amber-300">RESQTECH SIMULATION &amp; HARDWARE BOUNDARY: </span>
          This is a deterministic software routing simulation and logistics algorithm prototype.
          <strong className="text-white"> ZERO real traffic signals, LoRa radio packets, municipal NTCIP controllers, or emergency vehicle hardware are touched.</strong> Blood couriers are not assumed legally eligible for municipal signal preemption without authorized jurisdictional MOUs.
        </div>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Navigation className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Traffic Control &amp; ResQtech Simulator</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic road graph routing, simulated green-wave preemption lifecycle, road closures, and commercial fallback.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleToggleVehicle}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
              vehicleAvailable
                ? 'bg-slate-900 text-emerald-400 border-emerald-800 hover:bg-slate-800'
                : 'bg-rose-950 text-rose-300 border-rose-800 hover:bg-rose-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Vehicle: {vehicleAvailable ? 'Available (Van)' : 'Grounded / Unavailable'}</span>
          </button>

          <button
            onClick={refreshAllState}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh State</span>
          </button>
        </div>
      </div>

      {/* Action feedback */}
      {actionFeedback && (
        <div className="p-3 bg-slate-900 border border-slate-750 rounded-lg text-xs flex items-center justify-between text-slate-200">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-400 animate-pulse" />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-white">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Road Network Diagram & Corridor Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Road Network Diagram / Edges */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white">Fictional Road Network Graph &amp; Edge Disruption</h2>
            </div>
            <span className="text-2xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              Dijkstra Shortest-Path Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roadEdges.map((edge) => {
              const source = nodes.find((n) => n.id === edge.sourceCentreId);
              const target = nodes.find((n) => n.id === edge.targetCentreId);

              return (
                <div
                  key={edge.id}
                  className={`p-3 rounded-xl border transition-all space-y-2 ${
                    edge.isClosed
                      ? 'bg-rose-950/20 border-rose-800/60'
                      : edge.additionalDelayMin > 0
                      ? 'bg-amber-950/20 border-amber-800/60'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="text-xs font-bold text-white truncate">{edge.roadName}</div>
                    <span
                      className={`text-2xs font-mono px-2 py-0.5 rounded font-bold ${
                        edge.isClosed
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : edge.additionalDelayMin > 0
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {edge.isClosed ? 'CLOSED' : edge.additionalDelayMin > 0 ? `+${edge.additionalDelayMin}m DELAY` : 'OPEN'}
                    </span>
                  </div>

                  <div className="text-2xs font-mono text-slate-400 flex items-center justify-between">
                    <span>
                      {source?.name?.split(' ')[0]} → {target?.name?.split(' ')[0]}
                    </span>
                    <span>{edge.distanceKm} km</span>
                  </div>

                  <div className="flex items-center justify-between text-2xs font-mono pt-1 border-t border-slate-850">
                    <span className="text-slate-400">
                      Travel Time: <strong className="text-white">{edge.currentTravelTimeMin}m</strong> (Base: {edge.baselineTravelTimeMin}m)
                    </span>
                  </div>

                  {/* Disruption Buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => handleToggleClosure(edge)}
                      className={`flex-1 py-1 text-2xs font-semibold rounded border transition-colors ${
                        edge.isClosed
                          ? 'bg-emerald-950 border-emerald-800 text-emerald-300 hover:bg-emerald-900'
                          : 'bg-rose-950 border-rose-800 text-rose-300 hover:bg-rose-900'
                      }`}
                    >
                      {edge.isClosed ? 'Reopen Road' : 'Close Road'}
                    </button>
                    <button
                      onClick={() => handleAddDelay(edge, 10)}
                      className="px-2.5 py-1 text-2xs font-semibold text-amber-300 bg-amber-950 border border-amber-800 hover:bg-amber-900 rounded transition-colors"
                    >
                      +10m Congestion
                    </button>
                    {edge.additionalDelayMin > 0 && (
                      <button
                        onClick={() => handleAddDelay(edge, -edge.additionalDelayMin)}
                        className="px-2 py-1 text-2xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded"
                        title="Clear delay"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Corridor Request & Lifecycle Engine */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Simulated Priority Corridor</h2>
            </div>
            <span className="text-2xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
              Green-Wave Lab
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-2xs font-mono uppercase text-slate-400 mb-1">Origin Facility (Donor)</label>
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-2xs font-mono uppercase text-slate-400 mb-1">Destination Facility (Requester)</label>
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRequestCorridor}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm transition-colors"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Simulate Corridor Preemption Request</span>
            </button>
          </div>

          {/* Corridor Requests List */}
          <div className="pt-2 border-t border-slate-800 space-y-2.5">
            <div className="text-2xs font-mono uppercase text-slate-400">Simulated Corridor Registry</div>
            {activeCorridorRequests.length === 0 ? (
              <div className="text-2xs text-slate-500 italic p-3 text-center border border-dashed border-slate-800 rounded-lg">
                No active corridor requests recorded. Click request above.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeCorridorRequests.map((req) => (
                  <div key={req.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-2xs space-y-1.5 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{req.id}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold ${
                          req.status === 'SIMULATED_APPROVED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : req.status === 'SIMULATED_ACTIVE'
                            ? 'bg-sky-950 text-sky-300 border border-sky-800'
                            : req.status === 'SIMULATED_DENIED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <div className="text-slate-400 truncate">{req.details || 'Deterministic policy simulation.'}</div>

                    {/* Operational Transition Buttons */}
                    <div className="flex items-center gap-1 pt-1 border-t border-slate-850">
                      {req.status !== 'SIMULATED_ACTIVE' && (
                        <button
                          onClick={() => handleTransitionCorridor(req.id, 'SIMULATED_ACTIVE')}
                          className="px-2 py-0.5 text-2xs font-semibold text-sky-300 bg-sky-950 border border-sky-800 rounded hover:bg-sky-900"
                        >
                          Activate
                        </button>
                      )}
                      {req.status !== 'SIMULATED_RELEASED' && (
                        <button
                          onClick={() => handleTransitionCorridor(req.id, 'SIMULATED_RELEASED')}
                          className="px-2 py-0.5 text-2xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 rounded hover:text-white"
                        >
                          Release
                        </button>
                      )}
                      {req.status !== 'SIMULATED_DENIED' && (
                        <button
                          onClick={() => handleTransitionCorridor(req.id, 'SIMULATED_DENIED')}
                          className="px-2 py-0.5 text-2xs font-semibold text-rose-300 bg-rose-950 border border-rose-800 rounded hover:bg-rose-900"
                        >
                          Deny
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
