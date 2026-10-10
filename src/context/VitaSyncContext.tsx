/**
 * VitaSync: Reactive Application Context & SQLite Backend Bridge
 * Connects frontend views directly to the Node:SQLite Express backend.
 * Provides real-time synchronization, dual approvals, transport disruption,
 * camera/manual barcode scanning, and deterministic demo reset.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  BloodUnit,
  DispatchTracker,
  NetworkNode,
  OptimizationPlan,
  SurgeIncident,
  TransferManifest,
  DemandRequestItem,
  RoadEdgeItem,
  CorridorRequestItem,
} from '../types/blood';
import { SYNTHETIC_NODES } from '../data/syntheticData';
import { apiEventSource, apiFetch, DEMO_MODE } from '../lib/api';

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: string;
  actor: string;
  summary: string;
  payload?: any;
}

export interface VerificationResult {
  success: boolean;
  unit?: BloodUnit;
  manifest?: TransferManifest;
  dispatch?: DispatchTracker;
  message: string;
  actionExecuted?: string;
  temperatureStatus?: string;
}

interface VitaSyncContextType {
  nodes: NetworkNode[];
  units: BloodUnit[];
  activeIncident: SurgeIncident | null;
  activePlan: OptimizationPlan | null;
  manifests: TransferManifest[];
  dispatches: DispatchTracker[];
  eventLogs: AuditEvent[];
  policyMode: 'standard_demo_matrix' | 'strict_isogroup' | 'universal_emergency';
  setPolicyMode: (mode: 'standard_demo_matrix' | 'strict_isogroup' | 'universal_emergency') => void;
  resqtechDegraded: boolean;
  setResqtechDegraded: (degraded: boolean) => void;
  isBackendConnected: boolean;
  isLoading: boolean;

  allRequests: DemandRequestItem[];
  roadEdges: RoadEdgeItem[];
  corridorRequests: CorridorRequestItem[];
  vehicleAvailable: boolean;

  // Actions
  createIncident: (incident: Omit<SurgeIncident, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  createBulkRequests: (requests: any[], batchId?: string, staffEnteredBy?: string) => Promise<any>;
  runBatchOptimization: (batchId?: string) => Promise<any>;
  overrideRequestUrgency: (requestId: string, urgencyTier: string, reason: string, staffName?: string) => Promise<boolean>;
  updateRoadEdgeState: (edgeId: string, isClosed: boolean, additionalDelayMin: number) => Promise<void>;
  requestSimulatedCorridor: (transferId: string, sourceCentreId: string, targetCentreId: string) => Promise<any>;
  decideSimulatedCorridor: (corridorId: string, status: 'SIMULATED_APPROVED' | 'SIMULATED_DENIED' | 'SIMULATED_ACTIVE' | 'SIMULATED_RELEASED', reason?: string) => Promise<any>;
  toggleVehicleAvailability: (available: boolean) => Promise<void>;
  replanActiveIncident: () => Promise<void>;
  approveSourceLeg: (planId: string, legId: string, officerName?: string) => Promise<boolean>;
  approveReceivingLeg: (planId: string, legId: string, officerName?: string) => Promise<boolean>;
  commitTransferLeg: (planId: string, legId: string) => Promise<boolean>;
  approveActivePlan: (officerName: string) => Promise<void>;
  rejectActivePlan: (reason: string) => void;
  cancelActiveIncident: () => void;
  triggerPresetSurge: (presetType: SurgeIncident['type']) => Promise<void>;

  advanceDispatchProgress: (dispatchId: string) => Promise<void>;
  completeDispatch: (dispatchId: string) => Promise<void>;
  disruptDispatch: (dispatchId: string, reason?: string) => Promise<void>;

  verifyScannedUnit: (
    scannedText: string,
    eventType?: string,
    targetNodeId?: string,
    temp?: number
  ) => Promise<VerificationResult>;
  reconfirmUnit: (unitId: string, officerName?: string, remarks?: string) => Promise<boolean>;
  resetSimulationState: () => Promise<void>;
  refreshAllState: () => Promise<void>;
}

const VitaSyncContext = createContext<VitaSyncContextType | undefined>(undefined);

export const VitaSyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [nodes, setNodes] = useState<NetworkNode[]>(SYNTHETIC_NODES);
  const [units, setUnits] = useState<BloodUnit[]>([]);
  const [activeIncident, setActiveIncident] = useState<SurgeIncident | null>(null);
  const [activePlan, setActivePlan] = useState<OptimizationPlan | null>(null);
  const [manifests, setManifests] = useState<TransferManifest[]>([]);
  const [dispatches, setDispatches] = useState<DispatchTracker[]>([]);
  const [eventLogs, setEventLogs] = useState<AuditEvent[]>([]);
  const [allRequests, setAllRequests] = useState<DemandRequestItem[]>(() => {
    if (!DEMO_MODE || typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('vitasync_demo_requests') || '[]');
    } catch {
      return [];
    }
  });
  const [roadEdges, setRoadEdges] = useState<RoadEdgeItem[]>([]);
  const [corridorRequests, setCorridorRequests] = useState<CorridorRequestItem[]>([]);
  const [vehicleAvailable, setVehicleAvailableState] = useState<boolean>(true);
  const [policyMode, setPolicyModeState] = useState<'standard_demo_matrix' | 'strict_isogroup' | 'universal_emergency'>('standard_demo_matrix');
  const [resqtechDegraded, setResqtechDegradedState] = useState<boolean>(false);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Refetches the unified full operational state from SQLite backend
   */
  const refreshAllState = useCallback(async () => {
    if (DEMO_MODE) {
      setIsBackendConnected(true);
      return;
    }
    try {
      const res = await apiFetch('/api/state/full');
      if (!res.ok) {
        setIsBackendConnected(false);
        return;
      }

      const data = await res.json();
      setIsBackendConnected(true);

      // Map centres to NetworkNode format
      if (Array.isArray(data.centres) && data.centres.length > 0) {
        const mappedNodes: NetworkNode[] = data.centres.map((c: any) => ({
          id: c.id,
          name: c.name,
          type:
            c.id === 'node-metro'
              ? 'trauma_center_level_1'
              : c.id === 'node-apex'
              ? 'regional_blood_bank'
              : 'community_hospital',
          cityZone: c.cityZone,
          lat: c.lat,
          lng: c.lng,
          contactOfficer: c.contactOfficer,
          phoneExtension: c.phoneExtension,
          safetyReserveFloorPercent: Math.round(
            (c.safetyReserveFloor / Math.max(1, c.currentPlateletStock + c.safetyReserveFloor)) * 100
          ),
          storageCapacity: { PRBC: 60, PLATELETS: 24, FFP: 40, CRYO: 20 },
        }));
        setNodes(mappedNodes);
      }

      // Map units to BloodUnit format
      if (Array.isArray(data.units)) {
        const mappedUnits: BloodUnit[] = data.units.map((u: any) => ({
          id: u.id,
          din: u.din,
          bloodGroup: u.bloodGroup,
          component: u.component,
          volumeMl: u.volumeMl,
          collectionDate: u.collectedAt,
          expiryDate: u.expiresAt,
          currentLocationNodeId: u.currentCentreId,
          status: u.status.toLowerCase() as any,
          tempC: u.storageTempC,
          anticoagulant: 'CPDA-1',
          isSyntheticMock: true,
        }));
        setUnits(mappedUnits);
      }

      // Map latest demand to activeIncident
      if (data.latestDemand && data.latestDemand.status !== 'CANCELLED') {
        setActiveIncident({
          id: data.latestDemand.id,
          incidentNumber: data.latestDemand.id.replace('DEM-', 'INC-'),
          title: `Emergency Demand (${data.latestDemand.quantity}x ${data.latestDemand.component}) - ${data.latestDemand.target_centre_id}`,
          type: 'TRAUMA_SURGE',
          targetNodeId: data.latestDemand.target_centre_id,
          urgencyMinutes: data.latestDemand.urgency_window_minutes,
          requestedUnits: [
            {
              component: data.latestDemand.component,
              bloodGroup: data.latestDemand.blood_group,
              quantity: data.latestDemand.quantity,
              priority: data.latestDemand.priority,
            },
          ],
          operationalNotes: data.latestDemand.operational_notes || 'STAT trauma redistribution required.',
          createdAt: data.latestDemand.created_at,
          status: data.latestDemand.status === 'COMMITTED' ? 'dispatched' : 'plan_ready',
        });
      }

      // Map latest plan
      if (data.latestPlan && data.latestPlan.plan) {
        const planObj = data.latestPlan.plan;
        const legsObj = data.latestPlan.legs || [];

        const allSourceApproved = legsObj.length > 0 && legsObj.every((l: any) => l.source_approved);
        const allReceivingApproved = legsObj.length > 0 && legsObj.every((l: any) => l.receiving_approved);
        const allDualApproved = allSourceApproved && allReceivingApproved;

        let approvalStatus: OptimizationPlan['approvalStatus'] = 'pending';
        if (planObj.status === 'COMMITTED') {
          approvalStatus = 'committed';
        } else if (allDualApproved) {
          approvalStatus = 'dual_approved';
        } else if (allSourceApproved) {
          approvalStatus = 'source_approved';
        } else if (allReceivingApproved) {
          approvalStatus = 'receiving_approved';
        }

        const mappedPlan: OptimizationPlan = {
          id: planObj.id,
          incidentId: planObj.demand_id,
          demandId: planObj.demand_id,
          createdAt: planObj.created_at,
          totalUnitsAllocated: planObj.total_units_allocated,
          totalUnitsRequested: data.latestDemand ? data.latestDemand.quantity : planObj.total_units_allocated,
          fulfillmentRatePercent: planObj.fulfillment_percent,
          fastestArrivalMin: legsObj[0]?.active_eta_min || 13,
          longestArrivalMin: legsObj[0]?.active_eta_min || 13,
          approvalStatus,
          approvedBy: legsObj[0]?.source_approved_by || 'Dr. R. Bannerjee',
          approvedAt: legsObj[0]?.source_approved_at,
          legs: legsObj.map((l: any) => ({
            id: l.id,
            sourceNodeId: l.source_centre_id,
            targetNodeId: l.target_centre_id,
            component: 'PLATELETS',
            bloodGroup: 'O+',
            requestedGroup: 'O+',
            allocatedUnitIds: l.allocated_unit_ids,
            distanceKm: l.distance_km,
            standardEtaMin: l.standard_route_eta_min,
            resqtechCorridorEtaMin: l.resqtech_corridor_eta_min,
            transportMode:
              l.resqtech_corridor_eta_min < l.standard_route_eta_min ? 'resqtech_priority' : 'standard_courier',
            sourceApproved: l.source_approved,
            sourceApprovedBy: l.source_approved_by,
            sourceApprovedAt: l.source_approved_at,
            receivingApproved: l.receiving_approved,
            receivingApprovedBy: l.receiving_approved_by,
            receivingApprovedAt: l.receiving_approved_at,
            dualApproved: Boolean(l.source_approved && l.receiving_approved),
            scoreBreakdown: {
              travelTimeScore: l.score_transit,
              fefoExpiryScore: l.score_fefo,
              bufferSafetyScore: l.score_safety,
              compatibilityScore: 100,
              compositeScore: l.score_composite,
            },
          })),
          candidateEvaluations: data.latestPlan.candidateEvaluations || [],
          rejectedCandidates: (data.latestPlan.rejectedCandidates || []).map((rc: any) => ({
            candidateId: rc.centreId,
            centreName: rc.centreId === 'node-mercy' ? 'Mercy Community Hospital' : rc.centreId === 'node-north' ? 'North Point Clinic' : rc.centreId,
            reasonCode: rc.reason,
            explanation: rc.details,
            stockAvailable: 2,
            reserveFloor: 2,
            distanceKm: 9.8,
          })),
          unmetQuantity: data.latestPlan.unmetQuantity ?? 0,
          unmetReasonCodes: data.latestPlan.unmetReasonCodes || [],
          baselineComparison: data.latestPlan.baselineComparison
            ? {
                unmetVitaSync: data.latestPlan.baselineComparison.vitaSync?.unmetUnits ?? 0,
                unmetStatusQuo: data.latestPlan.baselineComparison.noTransferStatusQuo?.unmetUnits ?? 2,
                unitsPreservedFefo: data.latestPlan.baselineComparison.vitaSync?.stockExcludedAsStale ?? 2,
                sourceReservePreserved: data.latestPlan.baselineComparison.vitaSync?.sourceReserveRemaining ?? 6,
              }
            : {
                unmetVitaSync: 0,
                unmetStatusQuo: 2,
                unitsPreservedFefo: 2,
                sourceReservePreserved: 6,
              },
        };
        setActivePlan(mappedPlan);
      }

      // Map dispatches
      if (Array.isArray(data.dispatches)) {
        const mappedDispatches: DispatchTracker[] = data.dispatches.map((d: any) => ({
          id: d.id,
          manifestId: d.manifestId,
          incidentId: d.demandId,
          legId: d.legId,
          sourceNodeId: d.sourceCentreId,
          targetNodeId: d.targetCentreId,
          unitIds: d.unitIds,
          transportMode: d.transportMode === 'STANDARD_COURIER' ? 'standard_courier' : 'resqtech_priority',
          status: d.status === 'DELIVERED' ? 'delivered' : 'in_transit',
          dispatchedAt: d.dispatchedAt,
          estimatedArrival: d.estimatedArrival,
          progressPercent: d.progressPercent,
          coldChainTempC: d.coldChainTempC,
          tempAlert: d.coldChainTempC < 20.0 || d.coldChainTempC > 24.5,
          corridorCheckpoints: [
            { id: '1', label: `${d.sourceCentreName} Departure Bay`, cleared: true, timestamp: '00:02' },
            { id: '2', label: 'Priority Corridor Ingress', cleared: d.progressPercent >= 40, timestamp: d.progressPercent >= 40 ? '00:06' : undefined },
            { id: '3', label: 'Central Urban Transit Ring', cleared: d.progressPercent >= 75, timestamp: d.progressPercent >= 75 ? '00:10' : undefined },
            { id: '4', label: `${d.targetCentreName} Receiving Bay`, cleared: d.progressPercent >= 100, timestamp: d.progressPercent >= 100 ? '00:14' : undefined },
          ],
          adapterDegraded: d.adapterDegraded,
          prioritySignalActive: d.prioritySignalActive,
          driverCallsign: `Rapid-Alpha-1`,
        }));
        setDispatches(mappedDispatches);
      }

      // Map manifests
      if (Array.isArray(data.manifests)) {
        const mappedManifests: TransferManifest[] = data.manifests.map((m: any) => ({
          id: m.id,
          manifestNumber: m.manifestNumber,
          incidentId: m.demandId,
          generatedAt: m.generatedAt,
          sourceNode: {
            id: m.source.id,
            name: m.source.name,
            officer: m.source.officer,
          },
          destinationNode: {
            id: m.destination.id,
            name: m.destination.name,
            officer: m.destination.officer,
          },
          units: (m.units || []).map((u: any) => ({
            id: u.id,
            din: u.din,
            bloodGroup: u.blood_group || u.bloodGroup,
            component: u.component,
            volumeMl: u.volume_ml || u.volumeMl,
            expiryDate: u.expires_at || u.expiryDate,
            originDepartureVerified: true,
            destinationArrivalVerified: Boolean(m.coldChainArrivalTempC),
          })),
          transportMode: m.transportMode,
          coldChainDepartureTempC: m.coldChainDepartureTempC,
          coldChainArrivalTempC: m.coldChainArrivalTempC,
          digitalSignature: m.verificationHash,
          verificationHash: m.verificationHash,
          legalDisclaimer: m.legalDisclaimer,
        }));
        setManifests(mappedManifests);
      }

      // ResQtech degraded flag
      setResqtechDegradedState(Boolean(data.resqtechDegraded));

      // Bulk requests
      if (Array.isArray(data.allRequests)) {
        setAllRequests(data.allRequests);
      }

      // Road network edges
      if (Array.isArray(data.roadEdges)) {
        setRoadEdges(data.roadEdges);
      }

      // Corridor requests
      if (Array.isArray(data.corridorRequests)) {
        setCorridorRequests(data.corridorRequests);
      }

      // Vehicle available
      if (data.vehicleAvailable !== undefined) {
        setVehicleAvailableState(Boolean(data.vehicleAvailable));
      }
    } catch {
      setIsBackendConnected(false);
    }
  }, []);

  /**
   * Refetches audit events
   */
  const refreshEvents = useCallback(async () => {
    try {
      const res = await apiFetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events)) {
          setEventLogs(data.events);
        }
      }
    } catch {
      // Ignore network hiccup
    }
  }, []);

  // Hydrate on mount + subscribe to SSE with polling fallback
  useEffect(() => {
    refreshAllState();
    refreshEvents();

    let sse: EventSource | null = null;
    try {
      sse = apiEventSource('/api/events/stream');
      sse.onmessage = () => {
        refreshAllState();
        refreshEvents();
      };
      sse.onerror = () => {
        if (sse) sse.close();
      };
    } catch {
      // EventSource unavailable, fallback to interval
    }

    const interval = setInterval(() => {
      refreshAllState();
      refreshEvents();
    }, 4000);

    return () => {
      if (sse) sse.close();
      clearInterval(interval);
    };
  }, [refreshAllState, refreshEvents]);

  // Set policy mode
  const setPolicyMode = useCallback(
    (mode: 'standard_demo_matrix' | 'strict_isogroup' | 'universal_emergency') => {
      setPolicyModeState(mode);
    },
    []
  );

  // Toggle ResQtech Adapter degradation
  const setResqtechDegraded = useCallback(
    async (degraded: boolean) => {
      setResqtechDegradedState(degraded);
      try {
        await apiFetch('/api/transport/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ available: !degraded }),
        });
        await refreshAllState();
      } catch (err) {
        console.error('Failed to toggle adapter availability:', err);
      }
    },
    [refreshAllState]
  );

  // Create incident & trigger real optimization solver
  const createIncident = useCallback(
    async (incidentData: Omit<SurgeIncident, 'id' | 'createdAt' | 'status'>) => {
      setIsLoading(true);
      try {
        const reqQuantity = incidentData.requestedUnits.reduce((acc, u) => acc + u.quantity, 0);
        if (DEMO_MODE) {
          const createdAt = new Date().toISOString();
          const demandId = `DEMO-${Date.now().toString(36).toUpperCase()}`;
          const requestUnit = incidentData.requestedUnits[0];
          const demoRequest: DemandRequestItem = {
            id: demandId,
            target_centre_id: incidentData.targetNodeId,
            component: requestUnit?.component || 'PLATELETS',
            blood_group: requestUnit?.bloodGroup || 'O+',
            quantity: reqQuantity,
            priority: requestUnit?.priority || 'STAT',
            urgency_tier: requestUnit?.priority || 'STAT',
            urgency_window_minutes: incidentData.urgencyMinutes,
            required_by: new Date(Date.now() + incidentData.urgencyMinutes * 60000).toISOString(),
            staff_entered_by: 'Frontend Demo Operator',
            priority_rank: 1,
            rank_reason: 'Synthetic demo request; no live backend connected.',
            fulfilled_quantity: 0,
            unmet_quantity: reqQuantity,
            operational_notes: incidentData.operationalNotes,
            status: 'SUBMITTED',
            created_at: createdAt,
          };
          setAllRequests((prev) => {
            const next = [demoRequest, ...prev.filter((r) => r.id !== demandId)];
            localStorage.setItem('vitasync_demo_requests', JSON.stringify(next));
            return next;
          });
          setActiveIncident({ ...incidentData, id: demandId, createdAt, status: 'open' });
          setIsBackendConnected(true);
          return;
        }
        const firstComp = incidentData.requestedUnits[0]?.component || 'PLATELETS';
        const firstGroup = incidentData.requestedUnits[0]?.bloodGroup || 'O+';

        // 1. Create demand record in SQLite
        const demandRes = await apiFetch('/api/demand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetCentreId: incidentData.targetNodeId,
            component: firstComp,
            bloodGroup: firstGroup,
            quantity: reqQuantity,
            priority: incidentData.requestedUnits[0]?.priority || 'STAT',
            urgencyWindowMinutes: incidentData.urgencyMinutes,
            operationalNotes: incidentData.operationalNotes,
          }),
        });

        const demandJson = await demandRes.json();
        if (!demandRes.ok) {
          throw new Error(demandJson.message || 'Failed to create demand in SQLite');
        }

        // 2. Run real mathematical optimization solver
        const optRes = await apiFetch('/api/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demandId: demandJson.demandId }),
        });

        const optJson = await optRes.json();
        if (!optRes.ok) {
          throw new Error(optJson.message || 'Solver optimization failed');
        }

        await refreshAllState();
        await refreshEvents();
      } catch (err) {
        console.error('Failed to create incident and optimize:', err);
        setIsBackendConnected(false);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshAllState, refreshEvents]
  );

  // Trigger quick presets
  const triggerPresetSurge = useCallback(
    async (presetType: SurgeIncident['type']) => {
      if (presetType === 'MASS_CASUALTY') {
        await createIncident({
          incidentNumber: 'MCI-01',
          title: 'Mass Casualty Highway Collision - Metro Trauma STAT Deficit',
          type: 'MASS_CASUALTY',
          targetNodeId: 'node-metro',
          urgencyMinutes: 30,
          requestedUnits: [
            { component: 'PLATELETS', bloodGroup: 'O+', quantity: 2, priority: 'STAT' },
          ],
          operationalNotes:
            'Trauma Bay 3-5 massive hemorrhagic resuscitation; local platelets depleted to 1 unit.',
        });
      } else if (presetType === 'OBSTETRIC_HEMORRHAGE') {
        await createIncident({
          incidentNumber: 'OBH-01',
          title: 'Post-Partum Hemorrhage Code Crimson - Metro Receiving',
          type: 'OBSTETRIC_HEMORRHAGE',
          targetNodeId: 'node-metro',
          urgencyMinutes: 20,
          requestedUnits: [
            { component: 'PLATELETS', bloodGroup: 'O+', quantity: 2, priority: 'STAT' },
          ],
          operationalNotes:
            'Critical obstetric DIC with microvascular bleeding refractory to baseline platelets.',
        });
      } else {
        await createIncident({
          incidentNumber: 'PLT-01',
          title: 'Apheresis Platelet Critical Shortage Alert',
          type: 'PLATELET_DEPLETION',
          targetNodeId: 'node-metro',
          urgencyMinutes: 45,
          requestedUnits: [
            { component: 'PLATELETS', bloodGroup: 'O+', quantity: 2, priority: 'URGENT' },
          ],
          operationalNotes:
            'Cardiovascular bypass acute consumption; regional replenishment requested.',
        });
      }
    },
    [createIncident]
  );

  // Re-plan optimization
  const replanActiveIncident = useCallback(async () => {
    if (!activePlan || !activePlan.demandId) return;
    setIsLoading(true);
    try {
      await apiFetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demandId: activePlan.demandId }),
      });
      await refreshAllState();
    } catch (err) {
      console.error('Failed to re-plan:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activePlan, refreshAllState]);

  // Step 3A: Approve Source Release Leg
  const approveSourceLeg = useCallback(
    async (planId: string, legId: string, officerName?: string): Promise<boolean> => {
      try {
        const res = await apiFetch('/api/approvals/source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId,
            legId,
            officerName: officerName || 'Dr. R. Bannerjee (Logistics Officer)',
            remarks: 'Release authorized from donor temperature-controlled storage bay.',
          }),
        });
        const data = await res.json();
        await refreshAllState();
        return res.ok && data.sourceApproved;
      } catch {
        return false;
      }
    },
    [refreshAllState]
  );

  // Step 3B: Approve Receiving Transfer Leg
  const approveReceivingLeg = useCallback(
    async (planId: string, legId: string, officerName?: string): Promise<boolean> => {
      try {
        const res = await apiFetch('/api/approvals/receiving', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId,
            legId,
            officerName: officerName || 'Dr. S. Nair (Trauma Bay Director)',
            remarks: 'Receiving trauma team readied; inbound custody verified.',
          }),
        });
        const data = await res.json();
        await refreshAllState();
        return res.ok && data.receivingApproved;
      } catch {
        return false;
      }
    },
    [refreshAllState]
  );

  // Step 3C: Commit Dual-Approved Transfer & Generate Manifest
  const commitTransferLeg = useCallback(
    async (planId: string, legId: string): Promise<boolean> => {
      try {
        const res = await apiFetch('/api/dispatches/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, legId }),
        });
        const data = await res.json();
        await refreshAllState();
        return res.ok && data.status === 'IN_TRANSIT';
      } catch {
        return false;
      }
    },
    [refreshAllState]
  );

  // One-click dual-sign and commit convenience
  const approveActivePlan = useCallback(
    async (officerName: string) => {
      if (!activePlan || activePlan.legs.length === 0) return;
      setIsLoading(true);
      try {
        const leg = activePlan.legs[0];
        // 1. Source approval
        await apiFetch('/api/approvals/source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: activePlan.id,
            legId: leg.id,
            officerName: officerName || 'Dr. R. Bannerjee (Donor Logistics)',
          }),
        });

        // 2. Receiving approval
        await apiFetch('/api/approvals/receiving', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: activePlan.id,
            legId: leg.id,
            officerName: 'Dr. S. Nair (Receiving Trauma Bay)',
          }),
        });

        // 3. Commit transfer & seal manifest
        await apiFetch('/api/dispatches/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: activePlan.id,
            legId: leg.id,
          }),
        });

        await refreshAllState();
        await refreshEvents();
      } catch (err) {
        console.error('Failed to approve active plan:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [activePlan, refreshAllState, refreshEvents]
  );

  // Reject active plan
  const rejectActivePlan = useCallback(
    (reason: string) => {
      if (!activePlan) return;
      setActivePlan({
        ...activePlan,
        approvalStatus: 'rejected',
        rejectionReason: reason || 'Coordinator requested alternative manual route.',
      });
    },
    [activePlan]
  );

  // Cancel active incident
  const cancelActiveIncident = useCallback(() => {
    setActiveIncident(null);
    setActivePlan(null);
  }, []);

  // Advance dispatch simulation progress
  const advanceDispatchProgress = useCallback(
    async (dispatchId: string) => {
      try {
        await apiFetch(`/api/dispatches/${dispatchId}/advance`, {
          method: 'POST',
        });
        await refreshAllState();
      } catch (err) {
        console.error('Failed to advance dispatch:', err);
      }
    },
    [refreshAllState]
  );

  // Complete dispatch
  const completeDispatch = useCallback(
    async (dispatchId: string) => {
      try {
        await apiFetch(`/api/dispatches/${dispatchId}/advance`, {
          method: 'POST',
        });
        await refreshAllState();
      } catch (err) {
        console.error('Failed to complete dispatch:', err);
      }
    },
    [refreshAllState]
  );

  // Disrupt dispatch
  const disruptDispatch = useCallback(
    async (dispatchId: string, reason?: string) => {
      try {
        await apiFetch('/api/dispatches/disrupt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dispatchId,
            disruptionType: 'CORRIDOR_DEGRADED',
            reason: reason || 'Simulated communications loss on urban transit link 4.',
          }),
        });
        await refreshAllState();
      } catch (err) {
        console.error('Failed to disrupt dispatch:', err);
      }
    },
    [refreshAllState]
  );

  // Verify scanned unit via backend
  const verifyScannedUnit = useCallback(
    async (
      scannedText: string,
      eventType: string = 'RECEIVE_PUT_INTO_STOCK',
      targetNodeId?: string,
      temp?: number
    ): Promise<VerificationResult> => {
      try {
        const res = await apiFetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scannedText,
            eventType,
            centreId: targetNodeId || 'node-metro',
            scanMethod: 'MANUAL_DIN_ENTRY',
            temperatureCheckC: temp,
          }),
        });

        const data = await res.json();
        await refreshAllState();

        if (!res.ok) {
          return {
            success: false,
            message: data.message || 'Scan rejected.',
          };
        }

        return {
          success: true,
          message: `Unit verified: ${data.din} (${data.bloodGroup} ${data.component}). Temperature: ${data.storageTempC}°C.`,
          actionExecuted: data.actionExecuted,
          temperatureStatus: data.temperatureStatus,
        };
      } catch (err: any) {
        return {
          success: false,
          message: err.message || 'Scan error occurred.',
        };
      }
    },
    [refreshAllState]
  );

  // Stale-record reconfirmation
  const reconfirmUnit = useCallback(
    async (unitId: string, officerName?: string, remarks?: string): Promise<boolean> => {
      try {
        const res = await apiFetch(`/api/units/${unitId}/reconfirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            officerName: officerName || 'Dr. R. Bannerjee (Logistics Officer)',
            remarks: remarks || 'Confirmed physical unit integrity and continuous temperature monitoring.',
          }),
        });
        await refreshAllState();
        await refreshEvents();
        return res.ok;
      } catch {
        return false;
      }
    },
    [refreshAllState, refreshEvents]
  );

  // Reset to baseline deterministic 4-centre seed
  const resetSimulationState = useCallback(async () => {
    setIsLoading(true);
    try {
      if (DEMO_MODE) {
        localStorage.removeItem('vitasync_demo_requests');
        setAllRequests([]);
        setActiveIncident(null);
        setActivePlan(null);
        setIsBackendConnected(true);
        return;
      }
      await apiFetch('/api/demo/reset', {
        method: 'POST',
      });
      await refreshAllState();
      await refreshEvents();
    } catch (err) {
      console.error('Failed to reset demo state:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshAllState, refreshEvents]);

  // Bulk request submission
  const createBulkRequests = useCallback(
    async (requests: any[], batchId?: string, staffEnteredBy?: string) => {
      setIsLoading(true);
      try {
        const res = await apiFetch('/api/demand/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requests, batchId, staffEnteredBy }),
        });
        const data = await res.json();
        await refreshAllState();
        await refreshEvents();
        return data;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshAllState, refreshEvents]
  );

  // Run joint batch optimization
  const runBatchOptimization = useCallback(
    async (batchId?: string) => {
      setIsLoading(true);
      try {
        if (DEMO_MODE) {
          const current = allRequests.filter((request) => !batchId || request.batch_id === batchId);
          const target = current[0];
          if (!target) return { plan: { legs: [], totalUnitsAllocated: 0 } };
          const allocated = Math.min(target.quantity, 2);
          const plan = {
            id: `DEMO-PLAN-${Date.now().toString(36).toUpperCase()}`,
            demandId: target.id,
            totalUnitsAllocated: allocated,
            totalUnitsRequested: target.quantity,
            fulfillmentPercent: Math.round((allocated / target.quantity) * 100),
            legs: [{ id: 'DEMO-LEG-1', source_centre_id: 'node-apex', target_centre_id: target.target_centre_id, allocated_unit_ids: ['VS-U-101', 'VS-U-102'].slice(0, allocated) }],
          };
          setAllRequests((prev) => {
            const next = prev.map((request) =>
              request.id === target.id
                ? { ...request, status: 'PLAN_PROPOSED' as const, fulfilled_quantity: allocated, unmet_quantity: request.quantity - allocated, allocated_plan_id: plan.id }
                : request
            );
            localStorage.setItem('vitasync_demo_requests', JSON.stringify(next));
            return next;
          });
          setIsBackendConnected(true);
          return { plan };
        }
        const res = await apiFetch('/api/optimize/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId }),
        });
        const data = await res.json();
        await refreshAllState();
        await refreshEvents();
        return data;
      } finally {
        setIsLoading(false);
      }
    },
    [allRequests, refreshAllState, refreshEvents]
  );

  // Override request urgency tier
  const overrideRequestUrgency = useCallback(
    async (requestId: string, urgencyTier: string, reason: string, staffName?: string): Promise<boolean> => {
      try {
        const res = await apiFetch(`/api/demand/${requestId}/urgency`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urgencyTier, overrideReason: reason, staffName }),
        });
        await refreshAllState();
        await refreshEvents();
        return res.ok;
      } catch {
        return false;
      }
    },
    [refreshAllState, refreshEvents]
  );

  // Update road edge state (closures and additional delays)
  const updateRoadEdgeState = useCallback(
    async (edgeId: string, isClosed: boolean, additionalDelayMin: number) => {
      try {
        await apiFetch(`/api/transport/roads/${edgeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isClosed, additionalDelayMin }),
        });
        await refreshAllState();
        await refreshEvents();
      } catch (err) {
        console.error('Failed to update road edge:', err);
      }
    },
    [refreshAllState, refreshEvents]
  );

  // Request simulated priority corridor
  const requestSimulatedCorridor = useCallback(
    async (transferId: string, sourceCentreId: string, targetCentreId: string) => {
      try {
        const res = await apiFetch('/api/transport/corridors/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transferId, sourceCentreId, targetCentreId }),
        });
        const data = await res.json();
        await refreshAllState();
        await refreshEvents();
        return data;
      } catch (err) {
        console.error('Failed to request simulated corridor:', err);
      }
    },
    [refreshAllState, refreshEvents]
  );

  // Decide simulated priority corridor state
  const decideSimulatedCorridor = useCallback(
    async (corridorId: string, status: 'SIMULATED_APPROVED' | 'SIMULATED_DENIED' | 'SIMULATED_ACTIVE' | 'SIMULATED_RELEASED', reason?: string) => {
      try {
        const res = await apiFetch(`/api/transport/corridors/${corridorId}/decision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, reason }),
        });
        const data = await res.json();
        await refreshAllState();
        await refreshEvents();
        return data;
      } catch (err) {
        console.error('Failed to decide corridor:', err);
      }
    },
    [refreshAllState, refreshEvents]
  );

  // Toggle vehicle availability
  const toggleVehicleAvailability = useCallback(
    async (available: boolean) => {
      try {
        await apiFetch('/api/transport/vehicle/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ available }),
        });
        await refreshAllState();
        await refreshEvents();
      } catch (err) {
        console.error('Failed to toggle vehicle:', err);
      }
    },
    [refreshAllState, refreshEvents]
  );

  return (
    <VitaSyncContext.Provider
      value={{
        nodes,
        units,
        activeIncident,
        activePlan,
        manifests,
        dispatches,
        eventLogs,
        allRequests,
        roadEdges,
        corridorRequests,
        vehicleAvailable,
        policyMode,
        setPolicyMode,
        resqtechDegraded,
        setResqtechDegraded,
        isBackendConnected,
        isLoading,
        createIncident,
        createBulkRequests,
        runBatchOptimization,
        overrideRequestUrgency,
        updateRoadEdgeState,
        requestSimulatedCorridor,
        decideSimulatedCorridor,
        toggleVehicleAvailability,
        replanActiveIncident,
        approveSourceLeg,
        approveReceivingLeg,
        commitTransferLeg,
        approveActivePlan,
        rejectActivePlan,
        cancelActiveIncident,
        triggerPresetSurge,
        advanceDispatchProgress,
        completeDispatch,
        disruptDispatch,
        verifyScannedUnit,
        reconfirmUnit,
        resetSimulationState,
        refreshAllState,
      }}
    >
      {children}
    </VitaSyncContext.Provider>
  );
};

export function useVitaSync(): VitaSyncContextType {
  const context = useContext(VitaSyncContext);
  if (!context) {
    throw new Error('useVitaSync must be used within a VitaSyncProvider');
  }
  return context;
}
