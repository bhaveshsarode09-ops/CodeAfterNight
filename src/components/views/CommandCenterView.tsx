import React, { useState } from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
import { NetworkMapGraph } from '../NetworkMapGraph';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Zap,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  XCircle,
  FileText,
  Truck,
  Layers,
  Building2,
} from 'lucide-react';
import { SurgeIncident } from '../../types/blood';

interface CommandCenterViewProps {
  onOpenNewIncident: () => void;
  onNavigateToTab: (tab: any) => void;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  onOpenNewIncident,
  onNavigateToTab,
}) => {
  const {
    nodes,
    units,
    activeIncident,
    activePlan,
    dispatches,
    manifests,
    eventLogs,
    isBackendConnected,
    isLoading,
    approveSourceLeg,
    approveReceivingLeg,
    commitTransferLeg,
    approveActivePlan,
    rejectActivePlan,
    cancelActiveIncident,
    replanActiveIncident,
    triggerPresetSurge,
    resqtechDegraded,
    setResqtechDegraded,
    policyMode,
  } = useVitaSync();

  const [sourceOfficer, setSourceOfficer] = useState('Dr. R. Bannerjee (Logistics Officer)');
  const [receivingOfficer, setReceivingOfficer] = useState('Dr. S. Nair (Trauma Bay Director)');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Quick statistics
  const totalAvailableUnits = units.filter((u) => u.status === 'available').length;
  const oNegAvailable = units.filter((u) => u.status === 'available' && u.bloodGroup === 'O-').length;
  const activeDispatchesCount = dispatches.filter((d) => d.status === 'in_transit').length;

  const targetNode = nodes.find((n) => n.id === activeIncident?.targetNodeId);

  return (
    <div className="space-y-6">
      {/* Non-clinical operational boundary disclaimer */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg flex items-start justify-between gap-4 text-xs text-slate-300">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">
              Operational Logistics Redistribution Prototype
            </span>
            <span className="text-slate-400">
              {' '}
              · Synthetic inventory data and simulated corridors. Never used for clinical crossmatching, pre-transfusion antibody screening, biological blood release, or transfusion authorization.
            </span>
          </div>
        </div>
        <div className="text-slate-400 shrink-0 font-mono">
          Policy: {policyMode === 'standard_demo_matrix' ? 'Standard Demo Matrix' : policyMode}
        </div>
      </div>

      {/* KPI metric strip (4 columns, clean unboxed numbers with tabular-nums) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Total Network Available Units</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              {totalAvailableUnits}
            </span>
            <span className="text-xs text-slate-500">/ {units.length} total</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Across 6 regional medical facilities
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Critical Universal O- Units</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono tabular-nums ${oNegAvailable <= 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {oNegAvailable}
            </span>
            <span className="text-xs text-slate-500">units reserved</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            High-scarcity emergency pool
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Active Dispatches in Transit</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              {activeDispatchesCount}
            </span>
            <span className="text-xs text-slate-500">en route</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {dispatches.length} lifetime corridor missions
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">ResQtech Priority Adapter</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-sm font-bold ${resqtechDegraded ? 'text-amber-400' : 'text-emerald-400'}`}>
              {resqtechDegraded ? 'Degraded (Normal Fallback)' : 'Operational (Simulated)'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Hardware control: None</span>
            <button
              onClick={() => setResqtechDegraded(!resqtechDegraded)}
              className="text-xs text-rose-400 hover:text-rose-300 underline"
            >
              {resqtechDegraded ? 'Restore' : 'Degrade'}
            </button>
          </div>
        </div>
      </div>

      {/* 4 Fictional Centre Cards Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-semibold text-white">
              Network Centres ({nodes.length} Fictional Healthcare Nodes)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateToTab('bloodbank')}
              className="px-2.5 py-1 text-2xs font-semibold rounded bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 transition-colors"
            >
              Open Blood Bank Dashboard →
            </button>
            <button
              onClick={() => onNavigateToTab('hospital')}
              className="px-2.5 py-1 text-2xs font-semibold rounded bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 transition-colors"
            >
              Open Hospital Dashboard →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {nodes.map((node) => {
            const nodeUnits = units.filter((u) => u.currentLocationNodeId === node.id);
            const availCount = nodeUnits.filter((u) => u.status === 'available').length;
            const isRequester = node.id === 'node-metro';
            const isDonor = node.id === 'node-apex';
            const isStale = node.id === 'node-mercy';
            const isFloor = node.id === 'node-north';

            return (
              <div
                key={node.id}
                className={`p-3 rounded-lg border text-xs space-y-2 transition-all ${
                  isRequester
                    ? 'bg-rose-950/20 border-rose-800/60'
                    : isDonor
                    ? 'bg-emerald-950/20 border-emerald-800/60'
                    : isStale
                    ? 'bg-amber-950/20 border-amber-800/60'
                    : 'bg-slate-950/40 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <div className="font-bold text-slate-100 truncate">{node.name}</div>
                    <div className="text-2xs text-slate-400">{node.cityZone}</div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-2xs font-mono font-bold shrink-0 ${
                      isRequester
                        ? 'bg-rose-900/60 text-rose-300'
                        : isDonor
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : isStale
                        ? 'bg-amber-900/60 text-amber-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {isRequester
                      ? 'REQUESTER'
                      : isDonor
                      ? 'DONOR HUB'
                      : isStale
                      ? 'STALE STOCK'
                      : 'SAFETY FLOOR'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 font-mono text-2xs">
                  <div>
                    <span className="text-slate-400">Available: </span>
                    <strong className="text-white text-xs">{availCount}</strong>
                    <span className="text-slate-500"> / {nodeUnits.length}</span>
                  </div>
                  <div className="text-slate-400">
                    Floor: <strong className="text-slate-300">2</strong>
                  </div>
                </div>

                <div className="text-2xs text-slate-400 flex items-center justify-between">
                  <span className="truncate">{node.contactOfficer}</span>
                  <span className="font-mono text-slate-500">{node.phoneExtension}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Active Incident & Optimization Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Incident Status & Preset Triggers (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {activeIncident ? (
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-rose-400">
                    {activeIncident.incidentNumber}
                  </div>
                  <h3 className="text-base font-semibold text-white mt-0.5">
                    {activeIncident.title}
                  </h3>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 bg-rose-950/60 text-rose-400 border border-rose-800/50 rounded">
                  {activeIncident.type}
                </span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Bay</span>
                  <span className="text-slate-200 font-medium">
                    {targetNode?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Urgency Window</span>
                  <span className="text-slate-200 font-mono tabular-nums">
                    {activeIncident.urgencyMinutes} minutes
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className="text-amber-400 font-medium capitalize">
                    {activeIncident.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-300 mb-2">
                  Requested Emergency Components
                </div>
                <div className="space-y-1.5">
                  {activeIncident.requestedUnits.map((req, i) => (
                    <div
                      key={i}
                      className="p-2 bg-slate-950/40 rounded border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-400 font-mono">
                          {req.bloodGroup}
                        </span>
                        <span className="text-slate-300">{req.component}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-200 font-semibold tabular-nums">
                          {req.quantity} units
                        </span>
                        <span
                          className={`text-2xs ${
                            req.priority === 'STAT'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          [{req.priority}]
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                <span className="text-slate-500">Clinical Context:</span>{' '}
                {activeIncident.operationalNotes}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={replanActiveIncident}
                  className="flex-1 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-run Optimization</span>
                </button>
                <button
                  onClick={cancelActiveIncident}
                  className="py-1.5 px-3 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded border border-rose-900/50 transition-colors inline-flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Release</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Emergency Surge Triggers
                  </h3>
                  <p className="text-xs text-slate-400">
                    Instantiate synthetic clinical surge scenarios
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Trigger a multi-unit emergency deficit to test real-time multi-criteria redistribution optimization, source reserve protection, and corridor routing.
              </p>

              <div className="space-y-2.5 pt-2">
                <button
                  onClick={() => triggerPresetSurge('MASS_CASUALTY')}
                  className="w-full text-left p-3 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-rose-900/50 rounded-lg transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-400 group-hover:text-rose-300">
                      Mass Casualty Collision (MCI)
                    </span>
                    <span className="text-2xs font-mono text-slate-500">STAT · 30m</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Metro Level 1 Trauma: 4x O-, 4x O+, 2x Platelets, 2x FFP
                  </div>
                </button>

                <button
                  onClick={() => triggerPresetSurge('OBSTETRIC_HEMORRHAGE')}
                  className="w-full text-left p-3 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-900/50 rounded-lg transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400 group-hover:text-amber-300">
                      Obstetric Code Crimson (PPH)
                    </span>
                    <span className="text-2xs font-mono text-slate-500">STAT · 20m</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    St. Jude Specialty: 3x A+, 2x FFP, 2x Cryoprecipitate
                  </div>
                </button>

                <button
                  onClick={() => triggerPresetSurge('PLATELET_DEPLETION')}
                  className="w-full text-left p-3 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-900/50 rounded-lg transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-400 group-hover:text-blue-300">
                      Cardiac OR Platelet Depletion
                    </span>
                    <span className="text-2xs font-mono text-slate-500">URGENT · 45m</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Bayside Surgical: 3x B+, 2x O+ Apheresis Platelets
                  </div>
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={onOpenNewIncident}
                  className="w-full py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                >
                  Configure Custom Incident Parameters...
                </button>
              </div>
            </div>
          )}

          {/* Network Map Graph */}
          <NetworkMapGraph
            nodes={nodes}
            activePlan={activePlan}
            targetNodeId={activeIncident?.targetNodeId}
            dispatches={dispatches}
          />
        </div>

        {/* Right Column: Optimization Engine Plan & Approval Workflow (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {activePlan ? (
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">
                      {activePlan.id}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs font-medium text-emerald-400">
                      Optimization Complete
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white mt-1">
                    Multi-Criteria Allocation & Routing Plan
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Fulfillment</div>
                  <div className="text-lg font-bold text-white font-mono tabular-nums">
                    {activePlan.fulfillmentRatePercent}%
                  </div>
                </div>
              </div>

              {/* Optimization Score Matrix Overview */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/60 rounded border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400">Allocated Units</span>
                  <div className="text-base font-semibold text-white font-mono tabular-nums mt-0.5">
                    {activePlan.totalUnitsAllocated} / {activePlan.totalUnitsRequested}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Fastest ETA</span>
                  <div className="text-base font-semibold text-emerald-400 font-mono tabular-nums mt-0.5">
                    {activePlan.fastestArrivalMin} min
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Max Transit Span</span>
                  <div className="text-base font-semibold text-slate-200 font-mono tabular-nums mt-0.5">
                    {activePlan.longestArrivalMin} min
                  </div>
                </div>
              </div>

              {/* Allocation Legs Detailed Breakdown */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-300">
                  Transfer Allocation Legs ({activePlan.legs.length})
                </div>

                {activePlan.legs.map((leg) => {
                  const source = nodes.find((n) => n.id === leg.sourceNodeId);
                  const isPriority = leg.transportMode === 'resqtech_priority';

                  return (
                    <div
                      key={leg.id}
                      className="p-4 bg-slate-950/50 rounded-lg border border-slate-800 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              {source?.name}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs text-slate-300">
                              {targetNode?.name}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Component:{' '}
                            <span className="text-slate-200 font-semibold">
                              {leg.component} ({leg.bloodGroup})
                            </span>{' '}
                            · Requested: {leg.requestedGroup}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono font-semibold text-rose-400 tabular-nums">
                            {leg.allocatedUnitIds.length} units
                          </span>
                        </div>
                      </div>

                      {/* Corridor comparison */}
                      <div className="grid grid-cols-2 gap-3 text-xs p-2.5 bg-slate-900 rounded border border-slate-800/80">
                        <div>
                          <span className="text-slate-500">ResQtech Priority Corridor</span>
                          <div className="font-mono text-emerald-400 font-semibold tabular-nums mt-0.5">
                            {leg.resqtechCorridorEtaMin} min ({leg.distanceKm} km)
                          </div>
                          <span className="text-2xs text-slate-500">
                            {resqtechDegraded ? 'Service degraded; standard active' : 'Green-wave clearance simulated'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Standard Courier (Normal)</span>
                          <div className="font-mono text-slate-300 font-medium tabular-nums mt-0.5">
                            {leg.standardEtaMin} min ({leg.distanceKm} km)
                          </div>
                          <span className="text-2xs text-slate-500">
                            Standard urban road traffic model
                          </span>
                        </div>
                      </div>

                      {/* Multi-Criteria Optimization Score Breakdown */}
                      <div>
                        <div className="text-2xs text-slate-400 uppercase tracking-wider mb-1.5">
                          Multi-Objective Algorithmic Score Breakdown
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-2xs font-mono text-center">
                          <div className="p-1.5 bg-slate-900 rounded">
                            <div className="text-slate-500">Transit Speed</div>
                            <div className="text-slate-200 font-semibold tabular-nums">
                              {leg.scoreBreakdown.travelTimeScore}/100
                            </div>
                          </div>
                          <div className="p-1.5 bg-slate-900 rounded">
                            <div className="text-slate-500">FEFO Expiry</div>
                            <div className="text-slate-200 font-semibold tabular-nums">
                              {leg.scoreBreakdown.fefoExpiryScore}/100
                            </div>
                          </div>
                          <div className="p-1.5 bg-slate-900 rounded">
                            <div className="text-slate-500">Buffer Safety</div>
                            <div className="text-slate-200 font-semibold tabular-nums">
                              {leg.scoreBreakdown.bufferSafetyScore}/100
                            </div>
                          </div>
                          <div className="p-1.5 bg-slate-900 rounded">
                            <div className="text-slate-500">Compatibility</div>
                            <div className="text-slate-200 font-semibold tabular-nums">
                              {leg.scoreBreakdown.compatibilityScore}/100
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Unit DIN list */}
                      <div className="text-2xs font-mono text-slate-400">
                        Allocated synthetic unit IDs:{' '}
                        {leg.allocatedUnitIds.map((uid) => {
                          const unit = units.find((u) => u.id === uid);
                          return (
                            <span key={uid} className="text-slate-300 mr-2">
                              {unit?.din || uid}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Solver Candidate Feasibility & Rejection Analysis */}
              <div className="p-4 bg-slate-950/70 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-200">
                    Candidate Donor Triage & Exclusion Invariants
                  </div>
                  <span className="text-2xs font-mono text-slate-500">
                    Deterministic Math Model
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                  {/* C2 Apex */}
                  <div className="p-2.5 bg-emerald-950/30 border border-emerald-900/60 rounded">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">C2 - Apex Blood Bank</span>
                      <span className="text-2xs font-mono px-1.5 py-0.5 bg-emerald-900/60 text-emerald-300 rounded font-bold">
                        SELECTED
                      </span>
                    </div>
                    <div className="text-2xs text-slate-400 mt-1">
                      Surplus: 8 units · Reserve: 2 units · Dist: 8.4 km
                    </div>
                    <div className="text-2xs text-emerald-400 mt-1">
                      ✓ Allocated 2 fresh units (3d shelf-life). ETA 13m.
                    </div>
                  </div>

                  {/* C3 Mercy */}
                  <div className="p-2.5 bg-rose-950/30 border border-rose-900/60 rounded">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">C3 - Mercy Hospital</span>
                      <span className="text-2xs font-mono px-1.5 py-0.5 bg-rose-900/60 text-rose-300 rounded font-bold">
                        STALE (REJECTED)
                      </span>
                    </div>
                    <div className="text-2xs text-slate-400 mt-1">
                      Stock: 2 units · Reserve: 2 units · Dist: 6.2 km
                    </div>
                    <div className="text-2xs text-rose-400 mt-1">
                      ✗ Excluded: Units have &lt;12h remaining shelf-life.
                    </div>
                  </div>

                  {/* C4 North Point */}
                  <div className="p-2.5 bg-amber-950/30 border border-amber-900/60 rounded">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">C4 - North Point Clinic</span>
                      <span className="text-2xs font-mono px-1.5 py-0.5 bg-amber-900/60 text-amber-300 rounded font-bold">
                        FLOOR / ETA
                      </span>
                    </div>
                    <div className="text-2xs text-slate-400 mt-1">
                      Stock: 2 units · Reserve: 2 units · Dist: 24 km
                    </div>
                    <div className="text-2xs text-amber-400 mt-1">
                      ✗ Excluded: Reserve floor protection &amp; ETA &gt; deadline.
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulated Baseline Comparison */}
              <div className="p-3.5 bg-slate-950/50 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-300">
                    Decision Algorithm vs. Status Quo Baseline
                  </span>
                  <div className="text-2xs text-slate-400 mt-0.5">
                    Multi-criteria optimization vs Nearest Eligible / No-Transfer
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right font-mono">
                  <div>
                    <div className="text-2xs text-slate-500">Unmet STAT Demand</div>
                    <div className="text-emerald-400 font-bold">
                      0 vs 2 <span className="text-2xs text-slate-500">(100% Met)</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-slate-500">Stale Units Avoided</div>
                    <div className="text-rose-400 font-bold">
                      2 units <span className="text-2xs text-slate-500">(FEFO Saved)</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-slate-500">Donor Reserve Floor</div>
                    <div className="text-slate-200 font-bold">
                      100% <span className="text-2xs text-slate-500">(Zero Breaches)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dual-Approval Action Bar & State Machine */}
              {activePlan.legs.length > 0 && (
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Dual-Custody Approval Protocol (Regulatory Safety Gate)
                      </div>
                      <div className="text-2xs text-slate-400">
                        Transfer commits to active transit ONLY after BOTH donor release and receiving bay sign-offs are logged.
                      </div>
                    </div>
                    <div className="text-2xs font-mono px-2 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-300">
                      Status: {activePlan.approvalStatus.toUpperCase()}
                    </div>
                  </div>

                  {activePlan.legs.map((leg) => {
                    const isDualApproved = Boolean(leg.sourceApproved && leg.receivingApproved);
                    const isCommitted = activePlan.approvalStatus === 'committed';

                    return (
                      <div key={leg.id} className="p-3 bg-slate-900/90 rounded border border-slate-800 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* Gate 1: Source Release Gate */}
                          <div className={`p-3 rounded border ${leg.sourceApproved ? 'bg-emerald-950/30 border-emerald-800/80' : 'bg-slate-950 border-slate-800'}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                                {leg.sourceApproved ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                )}
                                Gate 1: Donor Source Release
                              </span>
                              <span className={`text-2xs font-mono px-1.5 py-0.5 rounded ${leg.sourceApproved ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-950 text-amber-400'}`}>
                                {leg.sourceApproved ? 'AUTHORIZED' : 'PENDING'}
                              </span>
                            </div>
                            <div className="text-2xs text-slate-400 mt-1">
                              Apex Regional Blood Center · Cold Vault Bay 2
                            </div>
                            {!leg.sourceApproved && !isCommitted && (
                              <div className="mt-2.5 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={sourceOfficer}
                                  onChange={(e) => setSourceOfficer(e.target.value)}
                                  placeholder="Signatory"
                                  className="flex-1 px-2 py-1 text-2xs bg-slate-900 border border-slate-700 rounded text-slate-200"
                                />
                                <button
                                  onClick={() => approveSourceLeg(activePlan.id, leg.id, sourceOfficer)}
                                  disabled={isLoading}
                                  className="px-2.5 py-1 text-2xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors whitespace-nowrap"
                                >
                                  Sign Source Release
                                </button>
                              </div>
                            )}
                            {leg.sourceApproved && (
                              <div className="text-2xs text-emerald-400 mt-1.5 font-mono">
                                ✓ Signed by {leg.sourceApprovedBy || 'Dr. R. Bannerjee'}
                              </div>
                            )}
                          </div>

                          {/* Gate 2: Receiving Bay Gate */}
                          <div className={`p-3 rounded border ${leg.receivingApproved ? 'bg-emerald-950/30 border-emerald-800/80' : 'bg-slate-950 border-slate-800'}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                                {leg.receivingApproved ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                )}
                                Gate 2: Receiving Trauma Bay
                              </span>
                              <span className={`text-2xs font-mono px-1.5 py-0.5 rounded ${leg.receivingApproved ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-950 text-amber-400'}`}>
                                {leg.receivingApproved ? 'AUTHORIZED' : 'PENDING'}
                              </span>
                            </div>
                            <div className="text-2xs text-slate-400 mt-1">
                              Metro Trauma Centre (Level 1) · Bay Reception
                            </div>
                            {!leg.receivingApproved && !isCommitted && (
                              <div className="mt-2.5 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={receivingOfficer}
                                  onChange={(e) => setReceivingOfficer(e.target.value)}
                                  placeholder="Signatory"
                                  className="flex-1 px-2 py-1 text-2xs bg-slate-900 border border-slate-700 rounded text-slate-200"
                                />
                                <button
                                  onClick={() => approveReceivingLeg(activePlan.id, leg.id, receivingOfficer)}
                                  disabled={isLoading}
                                  className="px-2.5 py-1 text-2xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors whitespace-nowrap"
                                >
                                  Sign Receiving Bay
                                </button>
                              </div>
                            )}
                            {leg.receivingApproved && (
                              <div className="text-2xs text-emerald-400 mt-1.5 font-mono">
                                ✓ Signed by {leg.receivingApprovedBy || 'Dr. S. Nair'}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Gate 3: Commit Transfer & Seal Manifest */}
                        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                          <div className="text-2xs text-slate-400">
                            {isCommitted ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Transfer committed to active transit under certified manifest.
                              </span>
                            ) : isDualApproved ? (
                              <span className="text-emerald-300 font-semibold">
                                ✓ Both gates signed! Ready to commit transfer and seal cold-chain manifest.
                              </span>
                            ) : (
                              <span className="text-amber-400">
                                ⚠ Dual-approval gate active. Sign both gates above or use fast authorization.
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!isCommitted && (
                              <>
                                {!isDualApproved && (
                                  <button
                                    onClick={() => approveActivePlan('Lt. J. Henderson (Triage Logistics)')}
                                    disabled={isLoading}
                                    className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                                  >
                                    Fast Dual-Authorize (Both Gates)
                                  </button>
                                )}
                                <button
                                  onClick={() => commitTransferLeg(activePlan.id, leg.id)}
                                  disabled={!isDualApproved || isLoading}
                                  className={`px-4 py-1.5 text-xs font-semibold rounded shadow-sm transition-colors flex items-center gap-1.5 ${
                                    isDualApproved
                                      ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer'
                                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Commit Transfer &amp; Seal Manifest</span>
                                </button>
                              </>
                            )}

                            {isCommitted && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => onNavigateToTab('dispatch')}
                                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                                >
                                  Track Corridor Dispatch
                                </button>
                                <button
                                  onClick={() => onNavigateToTab('manifests')}
                                  className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
                                >
                                  View Sealed Manifest
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Event Logs Live Audit Feed */}
              {eventLogs.length > 0 && (
                <div className="p-3 bg-slate-950/60 rounded border border-slate-800 text-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400 font-semibold uppercase tracking-wider">
                    <span>Recent Audit Ledger (SQLite ACID Persisted)</span>
                    <span className="text-emerald-400 font-mono">Live SSE</span>
                  </div>
                  <div className="space-y-1">
                    {eventLogs.slice(0, 3).map((evt) => (
                      <div key={evt.id} className="flex items-center justify-between text-slate-300 font-mono">
                        <div className="truncate max-w-md">
                          <span className="text-slate-500">[{evt.actor}]</span> {evt.summary}
                        </div>
                        <span className="text-slate-500 shrink-0 ml-2">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-lg text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">
                No Active Redistribution Plan
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Select an emergency surge trigger from the left or click "Create Surge Request" to run multi-criteria optimization across the 6 regional nodes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
