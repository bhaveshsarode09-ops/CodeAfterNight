import React, { useState, useMemo } from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
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
} from 'lucide-react';
import { BloodUnit } from '../../types/blood';

interface BloodBankDashboardProps {
  onNavigateToTab?: (tab: any) => void;
  onInspectUnitLabel?: (unit: BloodUnit) => void;
}

export const BloodBankDashboard: React.FC<BloodBankDashboardProps> = ({
  onNavigateToTab,
  onInspectUnitLabel,
}) => {
  const {
    nodes,
    units,
    activeIncident,
    activePlan,
    dispatches,
    manifests,
    eventLogs,
    approveSourceLeg,
    rejectActivePlan,
    reconfirmUnit,
    verifyScannedUnit,
    isLoading,
  } = useVitaSync();

  // Active facility focus: Apex Regional Blood Center (or switchable)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('node-apex');
  const [officerName, setOfficerName] = useState<string>('Dr. R. Bannerjee (Logistics Officer)');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [quickDinInput, setQuickDinInput] = useState<string>('');
  const [scanEventType, setScanEventType] = useState<string>('RECEIVE_PUT_INTO_STOCK');
  const [scanFeedback, setScanFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  const currentFacility = useMemo(
    () => nodes.find((n) => n.id === selectedFacilityId) || nodes[0],
    [nodes, selectedFacilityId]
  );

  // Units in this facility
  const facilityUnits = useMemo(
    () => units.filter((u) => u.currentLocationNodeId === selectedFacilityId),
    [units, selectedFacilityId]
  );

  const availableUnits = facilityUnits.filter((u) => u.status === 'available');
  const reservedUnits = facilityUnits.filter((u) => u.status === 'reserved');
  const criticalFreshnessUnits = facilityUnits.filter((u) => {
    const diffHours = (new Date(u.expiryDate).getTime() - Date.now()) / (3600 * 1000);
    return diffHours > 0 && diffHours < 24;
  });

  // Outgoing transfer proposals from this blood bank
  const outgoingLegs = useMemo(() => {
    if (!activePlan || !activePlan.legs) return [];
    return activePlan.legs.filter((l) => l.sourceNodeId === selectedFacilityId);
  }, [activePlan, selectedFacilityId]);

  // Handle Source Approval
  const handleApproveSource = async (legId: string) => {
    if (!activePlan) return;
    const ok = await approveSourceLeg(activePlan.id, legId, officerName);
    if (ok) {
      setActionSuccessMsg(`Source dispatch authorized by ${officerName}. Units staged in cold departure container.`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    }
  };

  // Handle Stale Reconfirmation
  const handleReconfirm = async (unitId: string, din: string) => {
    const ok = await reconfirmUnit(unitId, officerName, 'Physically inspected storage temperature and continuous agitation.');
    if (ok) {
      setActionSuccessMsg(`Unit ${din} reconfirmed and logged to immutable audit trail.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  // Quick Barcode / DIN Action
  const handleQuickScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDinInput.trim()) return;
    const res = await verifyScannedUnit(quickDinInput.trim(), scanEventType, selectedFacilityId, 22.0);
    setScanFeedback({ success: res.success, msg: res.message });
    if (res.success) {
      setQuickDinInput('');
    }
    setTimeout(() => setScanFeedback(null), 6000);
  };

  return (
    <div className="space-y-6">
      {/* Non-clinical operational disclaimer */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg flex items-start justify-between gap-4 text-xs text-slate-300">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">
              Role Perspective: Regional Blood Center Operator (Custodian & Dispatch Bay)
            </span>
            <span className="text-slate-400">
              {' '}
              · Synthetic logistics records only. Never used for immunohematological crossmatching, clinical compatibility release, or patient transfusion authorization.
            </span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <label className="text-slate-400 text-2xs uppercase tracking-wider font-semibold">Active Hub:</label>
          <select
            value={selectedFacilityId}
            onChange={(e) => setSelectedFacilityId(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-rose-500"
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Facility Header & Metrics Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Facility Status</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-950 border border-emerald-600/30 text-emerald-300">
              Available
            </span>
          </div>
          <div className="mt-1 text-lg font-bold text-white truncate">{currentFacility?.name}</div>
          <div className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Zone: {currentFacility?.cityZone}</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Live Available Stock</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono tabular-nums">
              {availableUnits.length}
            </span>
            <span className="text-xs text-slate-500">/ {facilityUnits.length} on-site</span>
          </div>
          <div className="mt-2 text-2xs text-slate-400 flex items-center gap-2">
            <span>Reserved: <strong className="text-amber-400 font-mono">{reservedUnits.length}</strong></span>
            <span>·</span>
            <span>Safety Floor: <strong className="text-cyan-400 font-mono">2</strong></span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Cold Chain & Agitation</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
              21.8°C
            </span>
            <span className="text-xs text-slate-400">Nominal (20-24°C)</span>
          </div>
          <div className="mt-2 text-2xs text-emerald-400 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Active Flatbed Agitation 60 RPM</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Freshness / Expiry Watch</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
              {criticalFreshnessUnits.length}
            </span>
            <span className="text-xs text-slate-400">units &lt; 24h left</span>
          </div>
          <div className="mt-2 text-2xs text-slate-400">
            Enforces FEFO release priority
          </div>
        </div>
      </div>

      {/* Main Grid: Outgoing Proposals + Quick Barcode Scanner Bay */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Outgoing Allocation Proposals Requiring Source Approval */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Emergency Redistribution Proposals
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Optimizer recommended transfers awaiting Blood Bank Custodian Authorization
                  </p>
                </div>
              </div>

              {activePlan && (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${
                    activePlan.approvalStatus === 'committed'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                      : activePlan.approvalStatus === 'dual_approved'
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                      : activePlan.approvalStatus === 'source_approved'
                      ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {activePlan.approvalStatus === 'committed'
                    ? 'Committed'
                    : activePlan.approvalStatus === 'dual_approved'
                    ? 'Both approved'
                    : activePlan.approvalStatus === 'source_approved'
                    ? 'Source approved'
                    : 'Proposed'}
                </span>
              )}
            </div>

            {outgoingLegs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <CheckCircle2 className="w-10 h-10 mx-auto text-slate-600" />
                <div className="text-sm font-medium text-slate-300">
                  No Outgoing Transfer Requests Pending for {currentFacility?.name}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When a hospital generates a critical demand (e.g. STAT trauma surge at Metro Trauma), VitaSync's solver calculates feasible donor allocations and presents them here for source release approval.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {outgoingLegs.map((leg) => {
                  const targetCentre = nodes.find((n) => n.id === leg.targetNodeId);
                  const isSourceApproved = Boolean(leg.sourceApproved);
                  const isReceivingApproved = Boolean(leg.receivingApproved);

                  return (
                    <div
                      key={leg.id}
                      className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              Transfer Leg {leg.id}
                            </span>
                            <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              {leg.allocatedUnitIds.length}x {leg.component} ({leg.bloodGroup})
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                            <span>To:</span>
                            <strong className="text-slate-200">{targetCentre?.name || leg.targetNodeId}</strong>
                            <span>({leg.distanceKm} km · ETA {leg.resqtechCorridorEtaMin} min)</span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded text-2xs font-bold uppercase tracking-wider ${
                              isSourceApproved
                                ? 'bg-emerald-950 border border-emerald-500/30 text-emerald-300'
                                : 'bg-amber-950 border border-amber-500/30 text-amber-300'
                            }`}
                          >
                            {isSourceApproved ? 'Source approved' : 'Proposed'}
                          </span>
                        </div>
                      </div>

                      {/* Allocated synthetic DIN units */}
                      <div>
                        <div className="text-2xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">
                          Allocated Unit Identifiers (ISBT-128 DINs)
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {leg.allocatedUnitIds.map((uid) => {
                            const unitRecord = units.find((u) => u.id === uid);
                            return (
                              <button
                                key={uid}
                                onClick={() => unitRecord && onInspectUnitLabel?.(unitRecord)}
                                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-850 border border-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-colors"
                                title="Click to inspect mock ISBT-128 label"
                              >
                                <QrCode className="w-3 h-3 text-rose-400" />
                                <span>{unitRecord ? unitRecord.din : uid}</span>
                                <span className="text-2xs text-slate-400">({unitRecord?.bloodGroup})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Solver Score Breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-900 text-2xs text-slate-400">
                        <div>
                          <span>Transit Speed:</span>
                          <div className="text-white font-mono font-semibold">{leg.scoreBreakdown.travelTimeScore}/100</div>
                        </div>
                        <div>
                          <span>FEFO Preservation:</span>
                          <div className="text-white font-mono font-semibold">{leg.scoreBreakdown.fefoExpiryScore}/100</div>
                        </div>
                        <div>
                          <span>Buffer Safety:</span>
                          <div className="text-white font-mono font-semibold">{leg.scoreBreakdown.bufferSafetyScore}/100</div>
                        </div>
                        <div>
                          <span>Composite Score:</span>
                          <div className="text-rose-400 font-mono font-bold">{leg.scoreBreakdown.compositeScore.toFixed(1)}/100</div>
                        </div>
                      </div>

                      {/* Dual-Approval Status & Action */}
                      <div className="p-3 bg-slate-900/80 rounded border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-300">Custody State:</span>
                            <span className={isSourceApproved ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                              {isSourceApproved ? `✓ Source Approved by ${leg.sourceApprovedBy || officerName}` : '○ Source Approval Required'}
                            </span>
                          </div>
                          <div className="text-2xs text-slate-400">
                            Receiving Hospital Status: {isReceivingApproved ? '✓ Receiving Approved' : 'Waiting for Receiving Signoff'}
                          </div>
                        </div>

                        {!isSourceApproved ? (
                          <button
                            onClick={() => handleApproveSource(leg.id)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve Source Release</span>
                          </button>
                        ) : (
                          <div className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Source Signoff Recorded</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Current Facility Unit Inventory Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Local Inventory at {currentFacility?.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time stock status, temperature sensor readings, and expiration countdown
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {facilityUnits.length} units total
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-2 font-medium">DIN Barcode</th>
                    <th className="py-2 px-2 font-medium">Group</th>
                    <th className="py-2 px-2 font-medium">Component</th>
                    <th className="py-2 px-2 font-medium">Storage Temp</th>
                    <th className="py-2 px-2 font-medium">Expires At</th>
                    <th className="py-2 px-2 font-medium">Status</th>
                    <th className="py-2 px-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {facilityUnits.map((u) => {
                    const isReserved = u.status === 'reserved';
                    const isAvail = u.status === 'available';
                    const isStale = (new Date(u.expiryDate).getTime() - Date.now()) <= 0;

                    return (
                      <tr key={u.id} className="hover:bg-slate-850/50">
                        <td className="py-2.5 px-2 text-white font-bold">
                          <button
                            onClick={() => onInspectUnitLabel?.(u)}
                            className="hover:text-rose-400 underline decoration-dotted text-left"
                            title="Inspect label"
                          >
                            {u.din}
                          </button>
                        </td>
                        <td className="py-2.5 px-2 text-rose-300 font-bold">{u.bloodGroup}</td>
                        <td className="py-2.5 px-2 text-slate-300">{u.component}</td>
                        <td className="py-2.5 px-2 text-emerald-400">{u.tempC}°C</td>
                        <td className="py-2.5 px-2 text-slate-300">
                          {new Date(u.expiryDate).toLocaleString(undefined, {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`px-2 py-0.5 rounded text-2xs font-semibold ${
                              isReserved
                                ? 'bg-amber-950 text-amber-300 border border-amber-600/30'
                                : isStale
                                ? 'bg-red-950 text-red-300 border border-red-600/30'
                                : isAvail
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {isReserved
                              ? 'Reserved'
                              : isStale
                              ? 'Needs confirmation'
                              : isAvail
                              ? 'Available'
                              : u.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button
                            onClick={() => handleReconfirm(u.id, u.din)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-2xs font-sans text-slate-200 border border-slate-700 transition-colors"
                            title="Perform physical quality and temperature verification"
                          >
                            Reconfirm
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

        {/* Right 1 Col: Quick Barcode Scan Bay + Audit Log */}
        <div className="space-y-6">
          {/* Quick Scanner Action */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <QrCode className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-semibold text-white">
                Barcode Custody Scan In/Out
              </h3>
            </div>

            <form onSubmit={handleQuickScan} className="mt-4 space-y-3">
              <div>
                <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                  Operation Type
                </label>
                <select
                  value={scanEventType}
                  onChange={(e) => setScanEventType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="RECEIVE_PUT_INTO_STOCK">Receive & Put Into Stock</option>
                  <option value="VERIFY_INVENTORY">Verify / Routine Inspection</option>
                  <option value="REMOVE_ISSUE_FROM_STOCK">Remove / Issue Out of Stock</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                  ISBT-128 DIN or Unit ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickDinInput}
                    onChange={(e) => setQuickDinInput(e.target.value)}
                    placeholder="e.g. =W1234260010100="
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold transition-colors"
                  >
                    Execute
                  </button>
                </div>
              </div>

              {scanFeedback && (
                <div
                  className={`p-2.5 rounded text-2xs border ${
                    scanFeedback.success
                      ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
                  }`}
                >
                  {scanFeedback.msg}
                </div>
              )}

              <div className="pt-2 text-2xs text-slate-400">
                Tip: Switch to the dedicated <strong>Unit Scanner</strong> tab for full live camera decoding with printed mock labels.
              </div>
            </form>
          </div>

          {/* Facility Officer Signoff Identity */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="text-2xs uppercase tracking-wider font-semibold text-slate-400">
              Active Signoff Officer (Source Custody)
            </div>
            <input
              type="text"
              value={officerName}
              onChange={(e) => setOfficerName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-medium"
            />
            <p className="text-2xs text-slate-500">
              Recorded into cryptographic manifest and SQLite audit log on each approval.
            </p>
          </div>

          {/* Audit Event Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Immutable Event Log</h3>
              </div>
              <span className="text-2xs font-mono text-slate-500">
                {eventLogs.length} events
              </span>
            </div>

            <div className="mt-3 space-y-2 max-h-96 overflow-y-auto pr-1">
              {eventLogs.slice(0, 10).map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 bg-slate-950 rounded border border-slate-800/80 text-2xs space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-mono text-slate-500">{evt.id}</span>
                    <span>
                      {new Date(evt.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-200">{evt.summary}</div>
                  <div className="text-slate-400 flex items-center justify-between">
                    <span>Actor: {evt.actor}</span>
                    <span className="font-mono text-cyan-400">{evt.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
