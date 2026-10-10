import React from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
import {
  Truck,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Thermometer,
  ShieldAlert,
  ArrowRight,
  Clock,
  Play,
  RotateCcw,
} from 'lucide-react';

interface DispatchViewProps {
  onNavigateToTab: (tab: any) => void;
}

export const DispatchView: React.FC<DispatchViewProps> = ({ onNavigateToTab }) => {
  const {
    nodes,
    units,
    dispatches,
    resqtechDegraded,
    setResqtechDegraded,
    advanceDispatchProgress,
    completeDispatch,
  } = useVitaSync();

  return (
    <div className="space-y-6">
      {/* ResQtech Simulator Compliance & Fallback Header */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                resqtechDegraded
                  ? 'bg-amber-950/60 border border-amber-800 text-amber-400'
                  : 'bg-emerald-950/60 border border-emerald-800 text-emerald-400'
              }`}
            >
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">
                  ResQtech Emergency Priority Logistics Adapter (Simulation Engine)
                </h2>
                <span
                  className={`text-2xs font-mono px-2 py-0.5 rounded border ${
                    resqtechDegraded
                      ? 'bg-amber-950 text-amber-400 border-amber-800'
                      : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  }`}
                >
                  {resqtechDegraded ? 'DEGRADED FALLBACK ACTIVE' : 'SIMULATED CORRIDOR ONLINE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulates pre-cleared green corridor routing with 35-45% transit time reduction. Contains zero live connections to physical traffic controller hardware.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setResqtechDegraded(!resqtechDegraded)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                resqtechDegraded
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {resqtechDegraded
                ? 'Restore ResQtech Priority'
                : 'Simulate Adapter Degradation'}
            </button>
          </div>
        </div>

        {/* Degradation Alert if triggered */}
        {resqtechDegraded && (
          <div className="p-3 bg-amber-950/40 border border-amber-900/60 rounded text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Normal-Route Fallback Engaged:</span>{' '}
              Simulated priority corridors are offline. Transport units are automatically routed via standard commercial traffic profiles with conventional travel durations and routine intersection waiting times.
            </div>
          </div>
        )}
      </div>

      {/* Dispatches List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            Active Corridor Transport Missions ({dispatches.length})
          </h3>
          <span className="text-xs text-slate-400">
            Real-time cold-chain temperature telemetry & geofence checkpoints
          </span>
        </div>

        {dispatches.length === 0 ? (
          <div className="p-10 bg-slate-900 border border-slate-800 rounded-lg text-center space-y-3">
            <Truck className="w-8 h-8 text-slate-600 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-300">
              No Active Dispatches in Transit
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Authorize a redistribution plan in the Operations Command tab to initiate real-time emergency transport and cold-chain telemetry tracking.
            </p>
            <button
              onClick={() => onNavigateToTab('command')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
            >
              Go to Operations Command
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {dispatches.map((dispatch) => {
              const src = nodes.find((n) => n.id === dispatch.sourceNodeId);
              const dst = nodes.find((n) => n.id === dispatch.targetNodeId);
              const dispatchUnits = units.filter((u) => dispatch.unitIds.includes(u.id));

              const isDelivered = dispatch.status === 'delivered';

              return (
                <div
                  key={dispatch.id}
                  className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-slate-300">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-200">
                            {dispatch.id}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-xs font-mono text-slate-400">
                            Manifest: {dispatch.manifestId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                          <span className="font-semibold text-white">{src?.name}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-semibold text-white">{dst?.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block text-2xs">COURIER MODE</span>
                        <span
                          className={
                            dispatch.transportMode === 'resqtech_priority'
                              ? 'text-emerald-400 font-semibold'
                              : 'text-amber-400 font-semibold'
                          }
                        >
                          {dispatch.transportMode === 'resqtech_priority'
                            ? 'ResQtech Priority'
                            : 'Standard Courier'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-2xs">COLD CHAIN PROBE</span>
                        <span className="text-blue-400 font-semibold tabular-nums flex items-center gap-1">
                          <Thermometer className="w-3.5 h-3.5" />
                          {dispatch.coldChainTempC}°C
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-2xs">STATUS</span>
                        <span
                          className={
                            isDelivered
                              ? 'text-purple-400 font-semibold uppercase'
                              : 'text-emerald-400 font-semibold uppercase'
                          }
                        >
                          {dispatch.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar & Transit Simulation */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">
                        Corridor Transit Completion: <strong className="text-white font-mono">{dispatch.progressPercent}%</strong>
                      </span>
                      <span className="text-slate-400 font-mono">
                        ETA:{' '}
                        {new Date(dispatch.estimatedArrival).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isDelivered
                            ? 'bg-purple-500'
                            : dispatch.transportMode === 'resqtech_priority'
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${dispatch.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Checkpoints Timeline */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {dispatch.corridorCheckpoints.map((cp, idx) => (
                      <div
                        key={cp.id}
                        className={`p-2.5 rounded border transition-colors ${
                          cp.cleared
                            ? 'bg-slate-950/80 border-emerald-800/60 text-slate-200'
                            : 'bg-slate-950/30 border-slate-800 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-2xs font-mono">
                          <CheckCircle2
                            className={`w-3.5 h-3.5 ${
                              cp.cleared ? 'text-emerald-400' : 'text-slate-600'
                            }`}
                          />
                          <span>Checkpoint {idx + 1}</span>
                        </div>
                        <div className="font-medium text-xs mt-1 truncate">
                          {cp.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Carried Units & Action Buttons */}
                  <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="text-slate-400">
                      Payload: <strong className="text-white font-mono tabular-nums">{dispatchUnits.length}</strong> units (
                      {dispatchUnits.map((u) => `${u.bloodGroup} ${u.component}`).join(', ')})
                    </div>

                    <div className="flex items-center gap-2">
                      {!isDelivered ? (
                        <>
                          <button
                            onClick={() => advanceDispatchProgress(dispatch.id)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Step 25% Progress</span>
                          </button>
                          <button
                            onClick={() => completeDispatch(dispatch.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Deliver & Receive Stock</span>
                          </button>
                        </>
                      ) : (
                        <div className="text-emerald-400 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Delivered to {dst?.name}. Inventory relocated.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
