import React, { useState, useMemo } from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
import {
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Truck,
  Check,
  X,
  FileText,
  RotateCcw,
  Zap,
  Info,
  Layers,
  Thermometer,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { BloodGroup, ComponentType } from '../../types/blood';

interface HospitalDashboardProps {
  onNavigateToTab?: (tab: any) => void;
  onOpenNewIncident?: () => void;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({
  onNavigateToTab,
  onOpenNewIncident,
}) => {
  const {
    nodes,
    units,
    activeIncident,
    activePlan,
    dispatches,
    manifests,
    approveReceivingLeg,
    rejectActivePlan,
    createIncident,
    isLoading,
  } = useVitaSync();

  // Active hospital focus: Metro Trauma Center Level 1 (or switchable)
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('node-metro');
  const [receivingOfficer, setReceivingOfficer] = useState<string>(
    'Dr. S. Nair (Trauma Bay Director)'
  );
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Quick In-Page Emergency Demand Form state
  const [reqComponent, setReqComponent] = useState<ComponentType>('PLATELETS');
  const [reqBloodGroup, setReqBloodGroup] = useState<BloodGroup>('O+');
  const [reqQuantity, setReqQuantity] = useState<number>(2);
  const [reqUrgencyMin, setReqUrgencyMin] = useState<number>(30);
  const [reqPriority, setReqPriority] = useState<'STAT' | 'URGENT' | 'ROUTINE'>('STAT');
  const [reqNotes, setReqNotes] = useState<string>(
    'Massive hemorrhagic shock protocol activated in Trauma Bay 4; local platelet reserve critical deficit.'
  );

  const currentHospital = useMemo(
    () => nodes.find((n) => n.id === selectedHospitalId) || nodes[0],
    [nodes, selectedHospitalId]
  );

  // Local inventory in this hospital
  const hospitalUnits = useMemo(
    () => units.filter((u) => u.currentLocationNodeId === selectedHospitalId),
    [units, selectedHospitalId]
  );

  // Incoming proposals for this hospital
  const incomingLegs = useMemo(() => {
    if (!activePlan || !activePlan.legs) return [];
    return activePlan.legs.filter((l) => l.targetNodeId === selectedHospitalId);
  }, [activePlan, selectedHospitalId]);

  // Inbound dispatches for this hospital
  const inboundDispatches = useMemo(() => {
    return dispatches.filter((d) => d.targetNodeId === selectedHospitalId);
  }, [dispatches, selectedHospitalId]);

  // Committed manifests for this hospital
  const hospitalManifests = useMemo(() => {
    return manifests.filter((m) => m.destinationNode.id === selectedHospitalId);
  }, [manifests, selectedHospitalId]);

  // Handle Receiving Approval
  const handleApproveReceiving = async (legId: string) => {
    if (!activePlan) return;
    const ok = await approveReceivingLeg(activePlan.id, legId, receivingOfficer);
    if (ok) {
      setActionSuccessMsg(
        `Inbound custody authorized by ${receivingOfficer}. Both approvals confirmed!`
      );
      setTimeout(() => setActionSuccessMsg(null), 5000);
    }
  };

  // Submit Emergency Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    await createIncident({
      incidentNumber: `EMD-${Date.now().toString().slice(-4)}`,
      title: `Hospital Emergency Demand: ${reqQuantity}x ${reqComponent} (${reqBloodGroup}) - ${currentHospital?.name}`,
      type: 'TRAUMA_SURGE',
      targetNodeId: selectedHospitalId,
      urgencyMinutes: reqUrgencyMin,
      requestedUnits: [
        {
          component: reqComponent,
          bloodGroup: reqBloodGroup,
          quantity: reqQuantity,
          priority: reqPriority,
        },
      ],
      operationalNotes: reqNotes,
    });
    setActionSuccessMsg(
      `Emergency demand created for ${currentHospital?.name}. Mathematical solver engaged!`
    );
    setTimeout(() => setActionSuccessMsg(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Regulatory & Scope disclaimer */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg flex items-start justify-between gap-4 text-xs text-slate-300">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200">
              Role Perspective: Receiving Hospital Triage & Trauma Director
            </span>
            <span className="text-slate-400">
              {' '}
              · Synthetic clinical demand simulation. Never used for patient serology, crossmatching, or transfusion administration.
            </span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <label className="text-slate-400 text-2xs uppercase tracking-wider font-semibold">Active Facility:</label>
          <select
            value={selectedHospitalId}
            onChange={(e) => setSelectedHospitalId(e.target.value)}
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

      {/* Hospital KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Hospital Node</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold bg-rose-950 border border-rose-600/30 text-rose-300">
              Level 1 Trauma
            </span>
          </div>
          <div className="mt-1 text-lg font-bold text-white truncate">{currentHospital?.name}</div>
          <div className="mt-1 text-xs text-slate-400">
            Officer: {receivingOfficer}
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Local Safety Reserve</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
              {hospitalUnits.length}
            </span>
            <span className="text-xs text-slate-400">units in local blood bank</span>
          </div>
          <div className="mt-2 text-2xs text-rose-400 font-medium">
            Critical Deficit Threshold: &lt; 3 units
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Active Demand Status</div>
          <div className="mt-1">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${
                !activeIncident
                  ? 'bg-slate-800 text-slate-300'
                  : activePlan?.approvalStatus === 'committed'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                  : activePlan?.approvalStatus === 'dual_approved'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                  : activePlan?.approvalStatus === 'source_approved'
                  ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-950 text-rose-300 border border-rose-500/30 animate-pulse'
              }`}
            >
              {!activeIncident
                ? 'No Active Demand'
                : activePlan?.approvalStatus === 'committed'
                ? 'Committed'
                : activePlan?.approvalStatus === 'dual_approved'
                ? 'Both approved'
                : activePlan?.approvalStatus === 'source_approved'
                ? 'Source approved'
                : 'Proposed'}
            </span>
          </div>
          <div className="mt-2 text-2xs text-slate-400 truncate">
            {activeIncident?.title || 'Operational state nominal'}
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Inbound Transit ETA</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
              {activePlan?.fastestArrivalMin ? `${activePlan.fastestArrivalMin} min` : '13 min'}
            </span>
            <span className="text-xs text-slate-400">Priority Corridor</span>
          </div>
          <div className="mt-2 text-2xs text-slate-400">
            ResQtech Signal Preemption Simulated
          </div>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Proposals, Routes & Inbound Deliveries */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section: Recommended Inbound Transfer Proposals */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Eligible Transfer Proposals
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Algorithm-selected donor transfers for {currentHospital?.name}
                </p>
              </div>

              {activePlan && (
                <span className="px-2.5 py-1 rounded bg-slate-800 text-xs font-mono text-cyan-400">
                  {activePlan.totalUnitsAllocated} / {activePlan.totalUnitsRequested} Units Allocated ({activePlan.fulfillmentRatePercent}%)
                </span>
              )}
            </div>

            {incomingLegs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <Truck className="w-10 h-10 mx-auto text-slate-600" />
                <div className="text-sm font-medium text-slate-300">
                  No Inbound Transfers Proposed for {currentHospital?.name}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Submit a surge request below or use the "Trigger Surge" button in the Network Overview to simulate a trauma deficit.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {incomingLegs.map((leg) => {
                  const donorCentre = nodes.find((n) => n.id === leg.sourceNodeId);
                  const isSourceApproved = Boolean(leg.sourceApproved);
                  const isReceivingApproved = Boolean(leg.receivingApproved);
                  const isBothApproved = isSourceApproved && isReceivingApproved;

                  return (
                    <div
                      key={leg.id}
                      className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              {leg.allocatedUnitIds.length}x {leg.component} ({leg.bloodGroup})
                            </span>
                            <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              ResQtech Priority: {leg.resqtechCorridorEtaMin} min
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                            <span>Donor Source:</span>
                            <strong className="text-slate-200">{donorCentre?.name || leg.sourceNodeId}</strong>
                            <span>({leg.distanceKm} km away)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded text-2xs font-bold uppercase tracking-wider ${
                              isBothApproved
                                ? 'bg-cyan-950 border border-cyan-500/30 text-cyan-300'
                                : isSourceApproved
                                ? 'bg-amber-950 border border-amber-500/30 text-amber-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {isBothApproved
                              ? 'Both approved'
                              : isSourceApproved
                              ? 'Source approved'
                              : 'Proposed'}
                          </span>
                        </div>
                      </div>

                      {/* Route & ETA Comparison */}
                      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900 rounded border border-slate-800 text-xs">
                        <div className="space-y-1">
                          <div className="text-2xs uppercase text-slate-400 font-semibold">
                            Standard Courier Route
                          </div>
                          <div className="text-slate-300 font-mono font-bold">
                            {leg.standardEtaMin} minutes
                          </div>
                          <div className="text-2xs text-slate-500">Unmanaged municipal traffic</div>
                        </div>

                        <div className="space-y-1 border-l border-slate-800 pl-3">
                          <div className="text-2xs uppercase text-emerald-400 font-semibold flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            <span>ResQtech Priority Corridor</span>
                          </div>
                          <div className="text-emerald-300 font-mono font-bold">
                            {leg.resqtechCorridorEtaMin} minutes
                          </div>
                          <div className="text-2xs text-emerald-500/80">
                            Simulated signal preemption active
                          </div>
                        </div>
                      </div>

                      {/* Dual-Approval Signoff Box */}
                      <div className="p-3 bg-slate-900/80 rounded border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 text-xs">
                          <div className="text-slate-300">
                            <strong>Source Blood Bank Signoff:</strong>{' '}
                            {isSourceApproved ? (
                              <span className="text-emerald-400 font-semibold">✓ Authorized by {leg.sourceApprovedBy || 'Donor Logistics'}</span>
                            ) : (
                              <span className="text-amber-400 font-semibold">Awaiting source authorization</span>
                            )}
                          </div>
                          <div className="text-slate-300">
                            <strong>Receiving Hospital Signoff:</strong>{' '}
                            {isReceivingApproved ? (
                              <span className="text-emerald-400 font-semibold">✓ Authorized by {leg.receivingApprovedBy || receivingOfficer}</span>
                            ) : (
                              <span className="text-rose-400 font-semibold">Signature required from Trauma Bay</span>
                            )}
                          </div>
                        </div>

                        {!isReceivingApproved ? (
                          <button
                            onClick={() => handleApproveReceiving(leg.id)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Authorize Inbound Custody</span>
                          </button>
                        ) : (
                          <div className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Receiving Signoff Recorded</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Unmet Demand & Rejected Candidate Breakdown */}
          {activePlan && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Candidate Exclusions & Unmet Demand Analysis
                  </h3>
                </div>
                <span className="text-2xs font-mono text-slate-400">
                  Unmet: {activePlan.totalUnitsRequested - activePlan.totalUnitsAllocated} units
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                {activePlan.candidateEvaluations && activePlan.candidateEvaluations.length > 0 ? (
                  activePlan.candidateEvaluations.map((evalReport) => (
                    <div
                      key={evalReport.centreId}
                      className="p-3 bg-slate-950 rounded border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{evalReport.code} ({evalReport.centreId})</span>
                          <span
                            className={`px-2 py-0.5 rounded text-2xs font-bold font-mono ${
                              evalReport.status === 'SELECTED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                : 'bg-red-950 text-red-300 border border-red-500/30'
                            }`}
                          >
                            {evalReport.reasonCode}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{evalReport.explanation}</p>
                      </div>

                      <div className="text-2xs font-mono text-slate-400 text-right shrink-0">
                        <div>Reserve: {evalReport.metrics.reserveFloor} units</div>
                        <div>Stale Excluded: {evalReport.metrics.staleUnitsExcluded}</div>
                      </div>
                    </div>
                  ))
                ) : activePlan.rejectedCandidates && activePlan.rejectedCandidates.length > 0 ? (
                  activePlan.rejectedCandidates.map((rc) => (
                    <div
                      key={rc.candidateId}
                      className="p-3 bg-slate-950 rounded border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{rc.centreName}</span>
                        <span className="px-2 py-0.5 rounded text-2xs font-bold font-mono bg-red-950 text-red-300 border border-red-500/30">
                          {rc.reasonCode}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{rc.explanation}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    All evaluated network donor centres met strict eligibility constraints.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Section: Committed Transfer Manifests */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  Sealed Cold-Chain Manifests for {currentHospital?.name}
                </h3>
              </div>
              <button
                onClick={() => onNavigateToTab?.('manifests')}
                className="text-2xs text-rose-400 hover:text-rose-300 transition-colors"
              >
                View Full Audit Sheet →
              </button>
            </div>

            {hospitalManifests.length === 0 ? (
              <p className="text-xs text-slate-500 italic mt-3">
                No committed manifests yet. Manifests are generated and cryptographically sealed with SHA-256 upon dual approval.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {hospitalManifests.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 bg-slate-950 rounded border border-slate-800 text-xs space-y-2 font-mono"
                  >
                    <div className="flex items-center justify-between text-slate-300 font-bold">
                      <span>{m.manifestNumber}</span>
                      <span className="text-emerald-400">Committed</span>
                    </div>
                    <div className="text-2xs text-slate-400">
                      Units: {m.units.map((u) => u.din).join(', ')}
                    </div>
                    <div className="flex items-center justify-between text-2xs text-slate-500 pt-1 border-t border-slate-900">
                      <span>Cold Chain Departure: {m.coldChainDepartureTempC}°C</span>
                      <span className="truncate max-w-[200px]" title={m.verificationHash}>
                        Hash: {m.verificationHash.slice(0, 16)}...
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Create Emergency Request Form + Current Local Hospital Stock */}
        <div className="lg:col-span-5 space-y-6">
          {/* Create Emergency Request Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Flame className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-white">
                Create Emergency Demand Request
              </h3>
            </div>

            <form onSubmit={handleSubmitRequest} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                  Requesting Hospital
                </label>
                <div className="p-2 bg-slate-950 border border-slate-800 rounded text-xs text-white font-medium flex items-center justify-between">
                  <span>{currentHospital?.name}</span>
                  <span className="text-2xs text-rose-400 font-mono">C1 Downtown</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                    Component
                  </label>
                  <select
                    value={reqComponent}
                    onChange={(e) => setReqComponent(e.target.value as ComponentType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="PLATELETS">PLATELETS (Apheresis)</option>
                    <option value="PRBC">PRBC (Red Cells)</option>
                    <option value="FFP">FFP (Fresh Frozen Plasma)</option>
                    <option value="CRYO">CRYO (Cryoprecipitate)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={reqBloodGroup}
                    onChange={(e) => setReqBloodGroup(e.target.value as BloodGroup)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-bold"
                  >
                    <option value="O+">O Positive (O+)</option>
                    <option value="O-">O Negative (O-) Universal</option>
                    <option value="A+">A Positive (A+)</option>
                    <option value="A-">A Negative (A-)</option>
                    <option value="B+">B Positive (B+)</option>
                    <option value="B-">B Negative (B-)</option>
                    <option value="AB+">AB Positive (AB+)</option>
                    <option value="AB-">AB Negative (AB-)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                    Units Needed
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={reqQuantity}
                    onChange={(e) => setReqQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                    Urgency Window (min)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    step={5}
                    value={reqUrgencyMin}
                    onChange={(e) => setReqUrgencyMin(parseInt(e.target.value) || 30)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                  Triage Urgency Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['STAT', 'URGENT', 'ROUTINE'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReqPriority(p)}
                      className={`py-1.5 text-xs font-semibold rounded border transition-colors ${
                        reqPriority === p
                          ? p === 'STAT'
                            ? 'bg-rose-600 text-white border-rose-500'
                            : 'bg-amber-600 text-white border-amber-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-2xs uppercase tracking-wider font-semibold text-slate-400 mb-1">
                  Clinical & Operational Indication
                </label>
                <textarea
                  rows={3}
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>Submit Demand & Engage Solver</span>
              </button>
            </form>
          </div>

          {/* Receiving Officer Signature Setup */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="text-2xs uppercase tracking-wider font-semibold text-slate-400">
              Receiving Physician / Bay Director
            </div>
            <input
              type="text"
              value={receivingOfficer}
              onChange={(e) => setReceivingOfficer(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-medium"
            />
            <p className="text-2xs text-slate-500">
              Recorded on inbound custody handover and chain of custody documentation.
            </p>
          </div>

          {/* Local Stock Summary at Hospital */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">
                Current On-Site Blood Bank Units
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {hospitalUnits.length} available
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {hospitalUnits.length === 0 ? (
                <div className="p-3 bg-red-950/40 border border-red-900/50 rounded text-xs text-red-300">
                  Critical Deficit: Zero units in local storage! Immediate transfer required.
                </div>
              ) : (
                hospitalUnits.map((u) => (
                  <div
                    key={u.id}
                    className="p-2.5 bg-slate-950 rounded border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <div className="font-bold text-white">{u.din}</div>
                      <div className="text-2xs text-slate-400">
                        {u.bloodGroup} {u.component} · {u.tempC}°C
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-600/30">
                      Available
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
