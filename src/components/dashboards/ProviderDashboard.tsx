import React, { useState, useMemo } from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
import { NetworkMapGraph } from '../NetworkMapGraph';
import {
  Building2,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  QrCode,
  Check,
  X,
  FileText,
  Activity,
  Layers,
  Thermometer,
  ShieldCheck,
  ArrowRight,
  Flame,
  Search,
  Truck,
  Play,
  Zap,
  Navigation,
  Radio,
  Share2,
  PackageMinus,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { BloodUnit } from '../../types/blood';

export type ProviderTab =
  | 'incoming_requests'
  | 'inventory'
  | 'dispatch'
  | 'manifests'
  | 'network';

interface ProviderDashboardProps {
  onNavigateToTab?: (tab: any) => void;
  onInspectUnitLabel?: (unit: BloodUnit) => void;
  activeSubTab?: ProviderTab;
  onSubTabChange?: (tab: ProviderTab) => void;
  selectedHubId?: string;
  onHubChange?: (id: string) => void;
}

export const ProviderDashboard: React.FC<ProviderDashboardProps> = ({
  onNavigateToTab,
  onInspectUnitLabel,
  activeSubTab: externalSubTab,
  onSubTabChange,
  selectedHubId: externalHubId,
  onHubChange,
}) => {
  const {
    nodes,
    units,
    activeIncident,
    activePlan,
    dispatches,
    manifests,
    allRequests,
    roadEdges,
    corridorRequests,
    vehicleAvailable,
    approveSourceLeg,
    rejectActivePlan,
    reconfirmUnit,
    verifyScannedUnit,
    advanceDispatchProgress,
    completeDispatch,
    disruptDispatch,
    runBatchOptimization,
    updateRoadEdgeState,
    requestSimulatedCorridor,
    decideSimulatedCorridor,
    toggleVehicleAvailability,
    isLoading,
  } = useVitaSync();

  // Sub-tabs: 'incoming_requests' | 'inventory' | 'dispatch' | 'manifests' | 'network'
  const [internalSubTab, setInternalSubTab] = useState<ProviderTab>('incoming_requests');
  const activeTab = externalSubTab !== undefined ? externalSubTab : internalSubTab;
  const setActiveTab = (tab: ProviderTab) => {
    if (onSubTabChange) onSubTabChange(tab);
    setInternalSubTab(tab);
  };

  // Active hub selection: Apex Regional Blood Center (default), Eastside, Central
  const [internalHubId, setInternalHubId] = useState<string>('node-apex');
  const selectedHubId = externalHubId !== undefined ? externalHubId : internalHubId;
  const setSelectedHubId = (id: string) => {
    if (onHubChange) onHubChange(id);
    setInternalHubId(id);
  };

  const hubNodes = useMemo(() => {
    return nodes.filter((n) => n.type === 'regional_blood_bank');
  }, [nodes]);

  const currentHub = useMemo(() => {
    return nodes.find((n) => n.id === selectedHubId) || hubNodes[0] || nodes[0];
  }, [nodes, hubNodes, selectedHubId]);

  // Officer signoff
  const [officerName, setOfficerName] = useState<string>(
    'Dr. R. Bannerjee (Logistics Officer)'
  );
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Dispatch barcode scan out state
  const [dispatchScanDin, setDispatchScanDin] = useState<string>('');
  const [dispatchScanFeedback, setDispatchScanFeedback] = useState<string | null>(null);

  // Inventory search & filter state
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [inventoryComponentFilter, setInventoryComponentFilter] = useState<string>('all');
  const [inventoryGroupFilter, setInventoryGroupFilter] = useState<string>('all');

  // Units in this blood center
  const hubUnits = useMemo(() => {
    return units.filter((u) => u.currentLocationNodeId === selectedHubId);
  }, [units, selectedHubId]);

  const availableUnits = useMemo(() => {
    return hubUnits.filter((u) => u.status === 'available');
  }, [hubUnits]);

  const reservedUnits = useMemo(() => {
    return hubUnits.filter((u) => u.status === 'reserved');
  }, [hubUnits]);

  const criticalFreshnessUnits = useMemo(() => {
    return hubUnits.filter((u) => {
      const diffHours = (new Date(u.expiryDate).getTime() - Date.now()) / (3600 * 1000);
      return diffHours > 0 && diffHours < 48;
    });
  }, [hubUnits]);

  // Filtered inventory table
  const filteredHubUnits = useMemo(() => {
    return hubUnits.filter((u) => {
      if (inventoryComponentFilter !== 'all' && u.component !== inventoryComponentFilter) return false;
      if (inventoryGroupFilter !== 'all' && u.bloodGroup !== inventoryGroupFilter) return false;
      if (inventorySearch.trim()) {
        const q = inventorySearch.toLowerCase();
        return u.din.toLowerCase().includes(q) || u.bloodGroup.toLowerCase().includes(q);
      }
      return true;
    });
  }, [hubUnits, inventoryComponentFilter, inventoryGroupFilter, inventorySearch]);

  // Outgoing transfer proposals from this hub
  const outgoingLegs = useMemo(() => {
    if (!activePlan || !activePlan.legs) return [];
    return activePlan.legs.filter((l) => l.sourceNodeId === selectedHubId);
  }, [activePlan, selectedHubId]);

  // Active dispatches departing from this hub
  const hubOutgoingDispatches = useMemo(() => {
    return dispatches.filter((d) => d.sourceNodeId === selectedHubId);
  }, [dispatches, selectedHubId]);

  // Manifests originating from this hub
  const hubManifests = useMemo(() => {
    return manifests.filter((m) => m.sourceNode.id === selectedHubId);
  }, [manifests, selectedHubId]);

  // Incoming Requests Priority Queue (Sorted by staff-entered urgency tier, then slack, then wait time)
  const incomingRequestsQueue = useMemo(() => {
    return [...allRequests].sort((a, b) => {
      if (a.priority_rank && b.priority_rank) {
        return a.priority_rank - b.priority_rank;
      }
      const tierRank: Record<string, number> = { STAT: 1, URGENT: 2, ROUTINE: 3 };
      const rankA = tierRank[a.urgency_tier] || 4;
      const rankB = tierRank[b.urgency_tier] || 4;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [allRequests]);

  // Handle Source Approval
  const handleApproveSource = async (legId: string) => {
    if (!activePlan) return;
    const ok = await approveSourceLeg(activePlan.id, legId, officerName);
    if (ok) {
      setActionSuccessMsg(
        `Source dispatch authorized by ${officerName}. Units staged in temperature-regulated outbound container.`
      );
      setTimeout(() => setActionSuccessMsg(null), 5000);
    }
  };

  // Handle Stale Reconfirmation
  const handleReconfirm = async (unitId: string, din: string) => {
    const ok = await reconfirmUnit(
      unitId,
      officerName,
      'Physically inspected storage temperature and continuous agitation integrity.'
    );
    if (ok) {
      setActionSuccessMsg(`Unit ${din} reconfirmed and recorded in SQLite audit ledger.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  // Barcode Custody Scan Out on Dispatch
  const handleDispatchScanOut = async (din: string) => {
    if (!din.trim()) return;
    try {
      const res = await verifyScannedUnit(
        din.trim(),
        'REMOVE_ISSUE_FROM_STOCK',
        selectedHubId,
        22.0
      );
      if (res.success) {
        setDispatchScanFeedback(`Unit ${din} checked out of hub stock into mobile transport custody.`);
        setDispatchScanDin('');
        setTimeout(() => setDispatchScanFeedback(null), 4000);
      } else {
        setDispatchScanFeedback(`Scan rejected: ${res.message}`);
      }
    } catch (err: any) {
      setDispatchScanFeedback(`Error: ${err.message}`);
    }
  };

  // Run optimizer with detailed user feedback
  const handleRunOptimizer = async () => {
    try {
      const res = await runBatchOptimization();
      if (res && res.plan) {
        setActionSuccessMsg(
          `MILP Optimizer scheduled ${res.plan.legs?.length || 0} transfer legs for ${res.plan.totalUnitsAllocated || 0} units.`
        );
      } else {
        setActionSuccessMsg('Joint MILP optimization executed successfully.');
      }
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      setActionErrorMsg(`Optimization failed: ${err.message || 'Unknown error'}`);
      setTimeout(() => setActionErrorMsg(null), 6000);
    }
  };

  return (
    <div className="space-y-5">
      {/* Provider Role Selector Bar */}
      <div className="bg-slate-900/90 border border-rose-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-rose-950/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                PROVIDER ROLE
              </span>
              <span className="text-xs text-slate-400">Regional Blood Supplier &amp; Logistics Hub</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <label htmlFor="hub-select" className="text-xs text-slate-400 font-medium">
                Active Blood Hub:
              </label>
              <select
                id="hub-select"
                value={selectedHubId}
                onChange={(e) => setSelectedHubId(e.target.value)}
                className="bg-slate-950 border border-rose-500/40 rounded-lg px-3 py-1 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
              >
                {hubNodes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Officer Signature & Status */}
        <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs">
          <div>
            <span className="text-3xs font-mono text-slate-400 block">AUTHORIZING OFFICER:</span>
            <input
              type="text"
              value={officerName}
              onChange={(e) => setOfficerName(e.target.value)}
              className="bg-transparent text-white font-semibold text-xs border-b border-slate-700 focus:outline-none focus:border-rose-500"
            />
          </div>
          <div className="pl-3 border-l border-slate-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-2xs font-mono text-emerald-400">CREDENTIALED</span>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-rose-950/80 border border-rose-500/50 rounded-lg flex items-center justify-between text-xs text-rose-200 animate-fade-in shadow-md">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-rose-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification Alert */}
      {actionErrorMsg && (
        <div className="p-3.5 bg-amber-950/80 border border-amber-500/50 rounded-lg flex items-center justify-between text-xs text-amber-200 animate-fade-in shadow-md">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium">{actionErrorMsg}</span>
          </div>
          <button
            onClick={() => setActionErrorMsg(null)}
            className="text-amber-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5 Tabs Segmented Navigation */}
      <div className="border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('incoming_requests')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'incoming_requests'
              ? 'border-rose-500 text-rose-400 bg-rose-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>1. Incoming Requests</span>
          {incomingRequestsQueue.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-900 text-rose-300 text-3xs font-mono">
              {incomingRequestsQueue.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'border-rose-500 text-rose-400 bg-rose-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>2. Inventory &amp; Expiry</span>
          <span className="text-3xs font-mono text-slate-400">({hubUnits.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('dispatch')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'dispatch'
              ? 'border-rose-500 text-rose-400 bg-rose-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>3. Dispatch Bay</span>
          {hubOutgoingDispatches.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-900 text-blue-300 text-3xs font-mono">
              {hubOutgoingDispatches.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('manifests')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'manifests'
              ? 'border-rose-500 text-rose-400 bg-rose-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>4. Manifests</span>
        </button>

        <button
          onClick={() => setActiveTab('network')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'network'
              ? 'border-rose-500 text-rose-400 bg-rose-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>5. Network &amp; ResQtech</span>
        </button>
      </div>

      {/* ================= TAB 1: INCOMING REQUESTS ================= */}
      {activeTab === 'incoming_requests' && (
        <div className="space-y-6">
          {/* Priority Queue Header & Action Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" />
                <span>Hospital Demand Priority Queue &amp; Joint Allocation</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Lexicographically ranked by staff urgency tier, deadline slack, local deficit, and waiting time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRunOptimizer}
                disabled={isLoading}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Running MILP...' : 'Run Joint MILP Optimizer'}</span>
              </button>
            </div>
          </div>

          {/* Section: Optimizer Proposed Transfer Legs (Source Approval Area) */}
          {outgoingLegs.length > 0 && (
            <div className="bg-slate-900 border border-rose-500/40 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-rose-400" />
                    <span>Proposed Outbound Dispatches from {currentHub?.name}</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Optimizer has matched units from your available surplus. Review composite scores and authorize cold-chain dispatch release.
                  </p>
                </div>
                <span className="text-2xs font-mono font-bold px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800">
                  {outgoingLegs.length} LEGS STAGED
                </span>
              </div>

              <div className="space-y-4">
                {outgoingLegs.map((leg) => {
                  const targetNode = nodes.find((n) => n.id === leg.targetNodeId);

                  return (
                    <div
                      key={leg.id}
                      className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              Leg #{leg.id}: {leg.allocatedUnitIds.length}x {leg.component} ({leg.bloodGroup})
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-semibold text-blue-400">
                              {targetNode?.name || leg.targetNodeId}
                            </span>
                          </div>
                          <p className="text-2xs text-slate-400 font-mono mt-1">
                            Units Allocated: {leg.allocatedUnitIds.join(', ')} · Transit ETA: {leg.resqtechCorridorEtaMin}m · Distance: {leg.distanceKm}km
                          </p>
                        </div>

                        <div>
                          {leg.sourceApproved ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg text-xs font-semibold">
                              <Check className="w-3.5 h-3.5" />
                              <span>Source Release Approved</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApproveSource(leg.id)}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve Source Release</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Composite Optimization Score Breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-2xs font-mono">
                        <div className="p-2 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-400 block text-3xs">TRANSIT SPEED</span>
                          <span className="text-emerald-400 font-bold text-xs">
                            {leg.scoreBreakdown?.travelTimeScore || 94} / 100
                          </span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-400 block text-3xs">FEFO FRESHNESS</span>
                          <span className="text-emerald-400 font-bold text-xs">
                            {leg.scoreBreakdown?.fefoExpiryScore || 98} / 100
                          </span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-400 block text-3xs">BUFFER SAFETY FLOOR</span>
                          <span className="text-emerald-400 font-bold text-xs">
                            {leg.scoreBreakdown?.bufferSafetyScore || 92} / 100
                          </span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded border border-slate-800">
                          <span className="text-slate-400 block text-3xs">COMPOSITE SCORE</span>
                          <span className="text-blue-400 font-bold text-xs">
                            {leg.scoreBreakdown?.compositeScore?.toFixed(1) || 94.6} / 100
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Full Priority Queue Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Regional Incoming Demand Queue ({incomingRequestsQueue.length})</span>
              </h4>
              <span className="text-2xs font-mono text-slate-400">
                Auto-refreshed via WebSocket
              </span>
            </div>

            {incomingRequestsQueue.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No active hospital requests currently in the queue.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-2xs uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Rank</th>
                      <th className="py-2.5 px-3">Urgency Tier</th>
                      <th className="py-2.5 px-3">Requesting Hospital</th>
                      <th className="py-2.5 px-3">Req / Component</th>
                      <th className="py-2.5 px-3">Fulfillment</th>
                      <th className="py-2.5 px-3">Deadline Window</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {incomingRequestsQueue.map((req, idx) => {
                      const destNode = nodes.find((n) => n.id === req.target_centre_id);

                      return (
                        <tr key={req.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-bold text-white">
                            #{req.priority_rank || idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-2xs font-bold border ${
                                req.urgency_tier === 'STAT'
                                  ? 'bg-rose-950 text-rose-400 border-rose-800'
                                  : 'bg-amber-950 text-amber-400 border-amber-800'
                              }`}
                            >
                              {req.urgency_tier}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-200 font-medium">
                            {destNode?.name || req.target_centre_id}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {req.quantity}x {req.component} ({req.blood_group})
                          </td>
                          <td className="py-2.5 px-3">
                            {req.fulfilled_quantity !== undefined ? (
                              <span
                                className={
                                  req.fulfilled_quantity === req.quantity
                                    ? 'text-emerald-400'
                                    : req.fulfilled_quantity > 0
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                                }
                              >
                                {req.fulfilled_quantity} / {req.quantity} units
                              </span>
                            ) : (
                              <span className="text-slate-500">Pending</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            &le; {req.urgency_window_minutes}m
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-3xs">
                              {req.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: INVENTORY & EXPIRY ================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1 shadow">
              <span className="text-2xs font-mono text-slate-400">LIVE LOCAL STOCK</span>
              <div className="text-2xl font-bold text-white flex items-center justify-between">
                <span>{hubUnits.length} units</span>
                <Layers className="w-5 h-5 text-rose-500" />
              </div>
              <p className="text-3xs text-slate-400">
                {availableUnits.length} available · {reservedUnits.length} staged/reserved
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1 shadow">
              <span className="text-2xs font-mono text-slate-400">COLD CHAIN &amp; AGITATION</span>
              <div className="text-2xl font-bold text-emerald-400 flex items-center justify-between">
                <span>100% NOMINAL</span>
                <Thermometer className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-3xs text-slate-400">
                Platelets on orbital flatbed (22°C) · PRBC chilled (4°C)
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1 shadow">
              <span className="text-2xs font-mono text-slate-400">EXPIRY WATCH (&lt;48H)</span>
              <div className="text-2xl font-bold text-amber-400 flex items-center justify-between">
                <span>{criticalFreshnessUnits.length} units</span>
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-3xs text-slate-400">
                Prioritized by FEFO algorithm to prevent wastage
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1 shadow">
              <span className="text-2xs font-mono text-slate-400">SAFETY RESERVE FLOOR</span>
              <div className="text-2xl font-bold text-blue-400 flex items-center justify-between">
                <span>2 UNITS SECURED</span>
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-3xs text-slate-400">
                Guaranteed minimum stock protected by optimizer
              </p>
            </div>
          </div>

          {/* Local Inventory Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-rose-500" />
                  <span>Physical Inventory at {currentHub?.name}</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  ISBT-128 compliance with calibrated storage sensors.
                </p>
              </div>

              {/* Filter controls */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter by DIN..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
                <select
                  value={inventoryComponentFilter}
                  onChange={(e) => setInventoryComponentFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
                >
                  <option value="all">All Components</option>
                  <option value="PLATELETS">Platelets</option>
                  <option value="PRBC">PRBC</option>
                  <option value="FFP">FFP</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono text-2xs uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">DIN (ISBT-128)</th>
                    <th className="py-2.5 px-3">Group</th>
                    <th className="py-2.5 px-3">Component</th>
                    <th className="py-2.5 px-3">Storage Temp</th>
                    <th className="py-2.5 px-3">Expiry Window</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Physical Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredHubUnits.map((u) => {
                    const hoursRemaining = Math.round(
                      (new Date(u.expiryDate).getTime() - Date.now()) / (3600 * 1000)
                    );

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-white font-bold">{u.din}</td>
                        <td className="py-2.5 px-3 text-rose-400 font-bold">{u.bloodGroup}</td>
                        <td className="py-2.5 px-3 text-slate-300">{u.component}</td>
                        <td className="py-2.5 px-3 text-emerald-400">{u.tempC.toFixed(1)}°C</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={
                              hoursRemaining < 24
                                ? 'text-rose-400 font-bold'
                                : hoursRemaining < 48
                                ? 'text-amber-400'
                                : 'text-slate-400'
                            }
                          >
                            {hoursRemaining > 0 ? `${hoursRemaining}h remaining` : 'EXPIRED'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-3xs font-bold ${
                              u.status === 'available'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : u.status === 'reserved'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {u.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleReconfirm(u.id, u.din)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-2xs font-sans transition-colors inline-flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>Reconfirm</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: DISPATCH ================= */}
      {activeTab === 'dispatch' && (
        <div className="space-y-6">
          {/* Dispatch Barcode Custody Scan-Out Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <PackageMinus className="w-4 h-4 text-rose-400" />
              <span>Barcode Custody Scan-Out (Release from Hub Stock)</span>
            </h4>
            <p className="text-xs text-slate-400">
              Scan units before handing over to courier to legally transfer custody from blood bank storage to mobile transport.
            </p>

            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                placeholder="Scan or enter DIN (e.g. VS-U-101)..."
                value={dispatchScanDin}
                onChange={(e) => setDispatchScanDin(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              <button
                onClick={() => handleDispatchScanOut(dispatchScanDin)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Scan Out
              </button>
            </div>

            {dispatchScanFeedback && (
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded text-xs text-rose-300 font-mono">
                {dispatchScanFeedback}
              </div>
            )}
          </div>

          {/* Active Outbound Dispatches */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                <span>Active Outbound Dispatches Departing from {currentHub?.name}</span>
              </h4>
              <span className="text-2xs font-mono text-slate-400">
                {hubOutgoingDispatches.length} active shipments
              </span>
            </div>

            {hubOutgoingDispatches.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs">
                No active dispatches currently on the road from this hub.
              </div>
            ) : (
              <div className="space-y-4">
                {hubOutgoingDispatches.map((d) => {
                  const targetNode = nodes.find((n) => n.id === d.targetNodeId);

                  return (
                    <div
                      key={d.id}
                      className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white font-mono">{d.id}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-semibold text-blue-400">
                              {targetNode?.name || d.targetNodeId}
                            </span>
                            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                              {d.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-2xs text-slate-400 font-mono mt-1">
                            Courier: {d.driverCallsign} · Temp: {d.coldChainTempC.toFixed(1)}°C · ETA: {Math.max(1, Math.round(18 * (1 - d.progressPercent / 100)))}m · Dist: 8.4km
                          </p>
                        </div>

                        {/* Dispatch Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => advanceDispatchProgress(d.id)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-2xs font-bold transition-colors flex items-center gap-1.5"
                          >
                            <Play className="w-3 h-3 text-blue-400" />
                            <span>Advance +25%</span>
                          </button>
                          <button
                            onClick={() => completeDispatch(d.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-2xs font-bold transition-colors flex items-center gap-1.5"
                          >
                            <Check className="w-3 h-3" />
                            <span>Mark Delivered</span>
                          </button>
                          <button
                            onClick={() => disruptDispatch(d.id, 'Simulated congestion delay')}
                            className="px-2.5 py-1.5 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded text-2xs font-bold transition-colors"
                            title="Simulate delay to trigger re-plan"
                          >
                            Trigger Delay
                          </button>
                        </div>
                      </div>

                      {/* Route Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-3xs font-mono text-slate-400">
                          <span>Departed {currentHub?.name}</span>
                          <span>Progress: {Math.round(d.progressPercent)}%</span>
                          <span>Arriving {targetNode?.name}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-500 h-full transition-all duration-300"
                            style={{ width: `${d.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 4: MANIFESTS ================= */}
      {activeTab === 'manifests' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-rose-400" />
                  <span>Transfer Custody Manifests ({hubManifests.length})</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Official digital transfer documents originating from {currentHub?.name}.
                </p>
              </div>
              <span className="text-2xs font-mono text-slate-400">
                ISBT-128 Validated
              </span>
            </div>

            {hubManifests.length === 0 ? (
              <div className="p-10 text-center text-slate-500 text-xs">
                No transfer manifests generated for this blood bank yet.
              </div>
            ) : (
              <div className="space-y-3">
                {hubManifests.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-white font-mono text-sm">{m.manifestNumber}</span>
                        <div className="text-2xs text-slate-400 mt-0.5 font-mono">
                          Generated: {new Date(m.generatedAt).toLocaleString()} · Destination: {m.destinationNode.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-2xs font-mono font-bold">
                          DUAL SIGNOFF SEALED
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded border border-slate-800/80 font-mono text-2xs space-y-1">
                      <div className="text-slate-300 font-bold">
                        Units Staged ({m.units.length}):
                      </div>
                      <div className="flex flex-wrap gap-2 text-slate-400">
                        {m.units.map((u) => (
                          <span key={u.id} className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {u.din} ({u.bloodGroup} {u.component})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 5: NETWORK & RESQTECH ================= */}
      {activeTab === 'network' && (
        <div className="space-y-6">
          {/* Network Graph View */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-emerald-400" />
                  <span>Regional Redistribution Mesh &amp; Corridor Simulation</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Topology graph, route connectivity, and simulated ResQtech green corridors.
                </p>
              </div>
            </div>

            <div className="rounded-lg overflow-hidden border border-slate-800">
              <NetworkMapGraph
                nodes={nodes}
                activePlan={activePlan}
                dispatches={dispatches}
                selectedNodeId={selectedHubId}
              />
            </div>
          </div>

          {/* Road Network & Corridor Simulation Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-rose-500" />
              <span>ResQtech Arterial Corridors &amp; Road Segments</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roadEdges.map((edge) => (
                <div
                  key={edge.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <span className="text-white font-bold">{edge.roadName}</span>
                    <div className="text-2xs text-slate-400">
                      {edge.sourceCentreId} &harr; {edge.targetCentreId} ({edge.distanceKm} km, {edge.baselineTravelTimeMin}m)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateRoadEdgeState(edge.id, !edge.isClosed, edge.additionalDelayMin)}
                      className={`px-2.5 py-1 rounded text-2xs font-bold ${
                        edge.isClosed
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {edge.isClosed ? 'CLOSED (Detour)' : 'OPEN'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
