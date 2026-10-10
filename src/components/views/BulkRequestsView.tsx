import React, { useState, useMemo } from 'react';
import { useVitaSync } from '../../context/VitaSyncContext';
import { ActiveTab } from '../TopNav';
import {
  Layers,
  Send,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Info,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

interface BulkRequestsViewProps {
  onNavigateToTab: (tab: ActiveTab) => void;
}

export const BulkRequestsView: React.FC<BulkRequestsViewProps> = ({ onNavigateToTab }) => {
  const {
    nodes,
    allRequests,
    activePlan,
    createBulkRequests,
    runBatchOptimization,
    overrideRequestUrgency,
    approveSourceLeg,
    approveReceivingLeg,
    commitTransferLeg,
    refreshAllState,
  } = useVitaSync();

  const [batchCsvText, setBatchCsvText] = useState<string>(
    `targetCentreId,quantity,component,bloodGroup,urgencyTier,urgencyWindowMinutes,notes\nnode-metro,3,PLATELETS,O+,STAT,25,Metro ER Trauma Multicasualty\nnode-mercy,2,PLATELETS,A+,URGENT,45,Mercy ICU Post-Op Bleed\nnode-north,2,PLATELETS,B+,ROUTINE,90,North Point Pre-Op Buffer`
  );
  const [activeBatchId, setActiveBatchId] = useState<string>('DEMO-SURGE-BATCH-01');
  const [operatorName, setOperatorName] = useState<string>('Dr. S. Nair (Trauma Director)');
  const [overrideModalReqId, setOverrideModalReqId] = useState<string | null>(null);
  const [overrideTier, setOverrideTier] = useState<string>('STAT');
  const [overrideReason, setOverrideReason] = useState<string>('Surgeon escalated priority due to active hemorrhagic shock.');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [batchResult, setBatchResult] = useState<any | null>(null);

  // Group requests by batch or filter
  const sortedRequests = useMemo(() => {
    return [...allRequests].sort((a, b) => {
      if (a.priority_rank && b.priority_rank) {
        return a.priority_rank - b.priority_rank;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [allRequests]);

  const stats = useMemo(() => {
    const total = allRequests.length;
    const fulfilled = allRequests.filter((r) => r.status === 'PLAN_PROPOSED' || r.fulfilled_quantity === r.quantity).length;
    const partial = allRequests.filter((r) => r.status === 'PARTIALLY_FULFILLED' || (r.fulfilled_quantity > 0 && r.fulfilled_quantity < r.quantity)).length;
    const unmet = allRequests.filter((r) => r.status === 'UNMET' || (r.unmet_quantity > 0 && r.fulfilled_quantity === 0)).length;
    return { total, fulfilled, partial, unmet };
  }, [allRequests]);

  // Create simulated surge batch (Preset 3-Hospital Surge Scenario)
  const handleTriggerSimulatedSurge = async () => {
    setIsSubmitting(true);
    setActionMessage('Generating deterministic 3-hospital surge batch...');
    try {
      const surgeBatch = [
        {
          targetCentreId: 'node-metro',
          quantity: 4,
          component: 'PLATELETS',
          bloodGroup: 'O+',
          urgencyTier: 'STAT',
          urgencyWindowMinutes: 25,
          notes: 'High-velocity expressway collision - multiple blunt trauma in Bay 1 & 2',
        },
        {
          targetCentreId: 'node-mercy',
          quantity: 3,
          component: 'PLATELETS',
          bloodGroup: 'A+',
          urgencyTier: 'URGENT',
          urgencyWindowMinutes: 45,
          notes: 'Emergency obstetric hemorrhage - operating suite 3',
        },
        {
          targetCentreId: 'node-north',
          quantity: 2,
          component: 'PLATELETS',
          bloodGroup: 'B+',
          urgencyTier: 'ROUTINE',
          urgencyWindowMinutes: 90,
          notes: 'Oncology ward scheduled replenishment',
        },
      ];

      const res = await createBulkRequests(surgeBatch, `SURGE-${Date.now().toString(36).toUpperCase()}`, operatorName);
      if (res) {
        setActiveBatchId(res.batchId);
        setActionMessage(`Batch ${res.batchId} submitted (${res.createdCount} valid rows created).`);
      }
    } catch (err: any) {
      setActionMessage(`Error creating batch: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Parse CSV and Submit
  const handleCsvSubmit = async () => {
    setIsSubmitting(true);
    setActionMessage('Parsing CSV and validating batch rows...');
    try {
      const lines = batchCsvText.trim().split('\n');
      if (lines.length < 2) {
        setActionMessage('CSV must contain a header line and at least one data row.');
        setIsSubmitting(false);
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim());
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = line.split(',').map((v) => v.trim());
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = vals[idx] !== undefined ? vals[idx] : '';
        });
        rows.push(rowObj);
      }

      const res = await createBulkRequests(rows, activeBatchId || undefined, operatorName);
      if (res) {
        setBatchResult(res);
        setActionMessage(`Processed: ${res.createdCount} valid, ${res.rejectedCount} rejected.`);
      }
    } catch (err: any) {
      setActionMessage(`CSV submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Run Batch Optimization
  const handleRunBatchOptimization = async () => {
    setIsSubmitting(true);
    setActionMessage('Executing joint network-wide allocation solver across active queue...');
    try {
      const result = await runBatchOptimization();
      if (result) {
        setBatchResult(result);
        setActionMessage(
          `Joint plan generated: ${result.totalUnitsAllocated}/${result.totalUnitsRequested} units allocated across ${result.totalRequests} requests.`
        );
      }
    } catch (err: any) {
      setActionMessage(`Optimization error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Override Urgency
  const handleSaveUrgencyOverride = async () => {
    if (!overrideModalReqId) return;
    try {
      await overrideRequestUrgency(overrideModalReqId, overrideTier, overrideReason, operatorName);
      setOverrideModalReqId(null);
      setActionMessage(`Urgency tier updated to ${overrideTier}. Queue priorities recalculated.`);
    } catch (err: any) {
      setActionMessage(`Override error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Disclaimer Banner */}
      <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <span className="font-semibold text-amber-300">SAFETY &amp; SCOPE NOTICE — OPERATIONAL SCHEDULING AID ONLY: </span>
          VitaSync queue ranks and priority scores are mathematical logistics aids derived from authorized staff-entered urgency tiers.
          VitaSync does <span className="font-semibold underline">not</span> infer patient severity, replace clinical triage, determine biological compatibility, or dispatch real vehicles.
        </div>
      </div>

      {/* Header and Summary Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Layers className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Bulk Request Management &amp; Queue</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Joint network-wide allocation across simultaneous multi-facility emergency demands with atomic stock reservation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTriggerSimulatedSurge}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create Simulated Surge (3 Facilities)</span>
          </button>
          <button
            onClick={handleRunBatchOptimization}
            disabled={isSubmitting || allRequests.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Joint Batch Optimization</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {actionMessage && (
        <div className="p-3 bg-slate-900 border border-slate-750 rounded-lg text-xs flex items-center justify-between text-slate-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-400" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-2xs uppercase tracking-wider text-slate-400 font-mono">Active Demands</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
          <div className="text-2xs text-slate-500 mt-0.5">In queue across network</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-2xs uppercase tracking-wider text-emerald-400 font-mono">Fully Allocated</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.fulfilled}</div>
          <div className="text-2xs text-slate-500 mt-0.5">100% units feasible</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-2xs uppercase tracking-wider text-amber-400 font-mono">Partially Fulfilled</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{stats.partial}</div>
          <div className="text-2xs text-slate-500 mt-0.5">Reserve floor protected</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="text-2xs uppercase tracking-wider text-rose-400 font-mono">Unmet / Escalation</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">{stats.unmet}</div>
          <div className="text-2xs text-slate-500 mt-0.5">Explicitly visible</div>
        </div>
      </div>

      {/* Batch Import & Queue Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: CSV Batch Import Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-semibold text-white">Batch CSV / Form Import</h2>
            </div>
            <span className="text-2xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Validated Input</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-2xs font-mono uppercase text-slate-400 mb-1">Simulated Operator Call Sign</label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-2xs font-mono uppercase text-slate-400 mb-1">Batch Identifier</label>
              <input
                type="text"
                value={activeBatchId}
                onChange={(e) => setActiveBatchId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-2xs font-mono uppercase text-slate-400 mb-1">
                CSV Data (targetCentreId, quantity, component, bloodGroup, urgencyTier, urgencyWindowMinutes, notes)
              </label>
              <textarea
                rows={6}
                value={batchCsvText}
                onChange={(e) => setBatchCsvText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-2xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() =>
                  setBatchCsvText(
                    `targetCentreId,quantity,component,bloodGroup,urgencyTier,urgencyWindowMinutes,notes\nnode-metro,2,PLATELETS,O+,STAT,30,Trauma Resus\nnode-mercy,2,PLATELETS,A+,URGENT,45,ICU\nUNKNOWN_CENTRE,2,PLATELETS,O+,STAT,30,Invalid Centre Test\nnode-north,-1,PLATELETS,B+,STAT,30,Negative Qty Test`
                  )
                }
                className="text-2xs text-slate-400 hover:text-slate-200 underline"
              >
                Load Validation Test Rows
              </button>
              <button
                onClick={handleCsvSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors border border-slate-700"
              >
                <Send className="w-3 h-3 text-rose-400" />
                <span>Validate &amp; Submit Batch</span>
              </button>
            </div>
          </div>

          {/* Validation Feedback */}
          {batchResult && batchResult.rejectedRows && batchResult.rejectedRows.length > 0 && (
            <div className="bg-rose-950/30 border border-rose-800/40 rounded-lg p-3 text-xs space-y-1.5">
              <div className="font-semibold text-rose-300 flex items-center gap-1.5 text-2xs uppercase">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>{batchResult.rejectedRows.length} Invalid Rows Rejected (Explicit Feedback)</span>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {batchResult.rejectedRows.map((rej: any, i: number) => (
                  <div key={i} className="text-2xs text-rose-200/80 bg-rose-950/50 p-1.5 rounded">
                    Row #{rej.rowIndex} [{rej.errorCode}]: {rej.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 2 Cols: Priority Queue Table */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">Transparent Priority Queue</h2>
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">
                Sorted by Staff Tier → Least Deadline Slack (ReqBy - Arrival) → Local Shortfall → Wait Time
              </p>
            </div>
            <button
              onClick={refreshAllState}
              className="flex items-center gap-1 px-2.5 py-1 text-2xs text-slate-300 hover:text-white bg-slate-800 rounded border border-slate-700 self-start sm:self-auto"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Refresh Queue</span>
            </button>
          </div>

          {sortedRequests.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
              No active demands in queue. Click "Create Simulated Surge" or submit a CSV batch above.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedRequests.map((req) => {
                const target = nodes.find((n) => n.id === req.target_centre_id);
                const isStat = (req.urgency_tier || req.priority) === 'STAT';
                const isUrgent = (req.urgency_tier || req.priority) === 'URGENT';

                return (
                  <div
                    key={req.id}
                    className="p-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl space-y-2.5 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-indigo-950 border border-indigo-700 text-indigo-300 text-xs font-bold font-mono flex items-center justify-center">
                          #{req.priority_rank || 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{target?.name || req.target_centre_id}</span>
                            <span className="text-2xs font-mono text-slate-500">({req.id})</span>
                          </div>
                          <div className="text-2xs text-slate-400">
                            Requested by: <span className="text-slate-300">{req.staff_entered_by || 'Emergency Coordinator'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Urgency Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-2xs font-bold font-mono ${
                            isStat
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : isUrgent
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          Tier: {req.urgency_tier || req.priority}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-2xs font-semibold ${
                            req.status === 'PLAN_PROPOSED' || req.fulfilled_quantity === req.quantity
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : req.status === 'PARTIALLY_FULFILLED'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : req.status === 'UNMET'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                          }`}
                        >
                          {req.status}
                        </span>

                        <button
                          onClick={() => {
                            setOverrideModalReqId(req.id);
                            setOverrideTier(req.urgency_tier || req.priority);
                          }}
                          className="px-2 py-0.5 text-2xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded transition-colors"
                        >
                          Change Tier
                        </button>
                      </div>
                    </div>

                    {/* Operational Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-2xs font-mono">
                      <div className="bg-slate-900/80 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 block">Quantity</span>
                        <span className="text-white font-bold">{req.quantity}x {req.component}</span>
                        <span className="text-2xs text-slate-400 block">({req.blood_group})</span>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 block">Fulfilled / Unmet</span>
                        <span className="text-emerald-400 font-bold">{req.fulfilled_quantity ?? 0}</span>
                        <span className="text-slate-400"> / </span>
                        <span className="text-rose-400 font-bold">{req.unmet_quantity ?? req.quantity}</span>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 block">Required By</span>
                        <span className="text-slate-200">
                          {req.required_by ? new Date(req.required_by).toLocaleTimeString() : `${req.urgency_window_minutes}m`}
                        </span>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded border border-slate-850">
                        <span className="text-slate-500 block">Batch / Incident</span>
                        <span className="text-slate-300 truncate block">{req.batch_id || 'Direct Single'}</span>
                      </div>
                    </div>

                    {/* Rank Factors Plain-Language Explanation */}
                    {req.rank_reason && (
                      <div className="bg-slate-900/50 border border-slate-850 rounded p-2 text-2xs text-slate-300 flex items-start gap-1.5">
                        <Info className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-slate-200">Why this rank: </span>
                          {req.rank_reason}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Active Batch Allocation Plan Inspection */}
      {activePlan && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Active Joint Allocation Plan ({activePlan.id})</h3>
              </div>
              <p className="text-2xs text-slate-400 mt-0.5">
                Evaluated against verified SQLite stock. Multi-source transfers require individual facility authorizations.
              </p>
            </div>
            <div className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded">
              Allocated: {activePlan.totalUnitsAllocated} Units
            </div>
          </div>

          <div className="space-y-3">
            {activePlan.legs.map((leg) => {
              const source = nodes.find((n) => n.id === leg.sourceNodeId);
              const target = nodes.find((n) => n.id === leg.targetNodeId);

              return (
                <div key={leg.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <span>{source?.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-rose-500" />
                      <span>{target?.name}</span>
                      <span className="text-2xs font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded">
                        {leg.allocatedUnitIds.length}x {leg.component}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-2xs font-mono text-slate-400">
                        ETA: <strong className="text-white">{leg.resqtechCorridorEtaMin}m</strong> (Priority) / {leg.standardEtaMin}m (Normal)
                      </span>
                      {leg.dualApproved ? (
                        <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-300 text-2xs font-bold rounded">
                          Both Approved
                        </span>
                      ) : leg.sourceApproved ? (
                        <span className="px-2 py-0.5 bg-amber-950 border border-amber-800 text-amber-300 text-2xs font-bold rounded">
                          Source Approved
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 text-2xs font-bold rounded">
                          Awaiting Sign-off
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dual-approval action strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-850">
                    <div className="text-2xs text-slate-400 font-mono">
                      Units: {leg.allocatedUnitIds.join(', ')}
                    </div>
                    <div className="flex items-center gap-2">
                      {!leg.sourceApproved && (
                        <button
                          onClick={() => approveSourceLeg(activePlan.id, leg.id, 'Dr. R. Bannerjee (Logistics Officer)')}
                          className="px-2.5 py-1 text-2xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                        >
                          Sign Source Release
                        </button>
                      )}
                      {!leg.receivingApproved && (
                        <button
                          onClick={() => approveReceivingLeg(activePlan.id, leg.id, 'Dr. S. Nair (Trauma Bay Director)')}
                          className="px-2.5 py-1 text-2xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                        >
                          Sign Receiving Acceptance
                        </button>
                      )}
                      {leg.dualApproved && (
                        <button
                          onClick={() => commitTransferLeg(activePlan.id, leg.id)}
                          className="px-3 py-1 text-2xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
                        >
                          Commit &amp; Generate Manifest
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Urgency Override Modal */}
      {overrideModalReqId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Staff Urgency Override &amp; Audit Trail</h3>
              <button onClick={() => setOverrideModalReqId(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-2xs font-mono uppercase text-slate-400 mb-1">Target Demand ID</label>
                <div className="text-xs font-mono text-white bg-slate-950 p-2 rounded border border-slate-800">{overrideModalReqId}</div>
              </div>

              <div>
                <label className="block text-2xs font-mono uppercase text-slate-400 mb-1">New Urgency Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {['STAT', 'URGENT', 'ROUTINE'].map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setOverrideTier(tier)}
                      className={`py-1.5 text-xs font-bold rounded border transition-colors ${
                        overrideTier === tier
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-2xs font-mono uppercase text-slate-400 mb-1">Override Clinical / Operational Reason</label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setOverrideModalReqId(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUrgencyOverride}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
              >
                Commit Override to Audit Trail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
