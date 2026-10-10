/**
 * VitaSync: Synthetic Emergency Blood-Inventory Redistribution Types
 * Non-clinical operational dispatch data models.
 */

export type BloodGroup = 'O-' | 'O+' | 'A-' | 'A+' | 'B-' | 'B+' | 'AB-' | 'AB+';

export type ComponentType = 'PRBC' | 'PLATELETS' | 'FFP' | 'CRYO';

export interface ComponentMetadata {
  type: ComponentType;
  fullName: string;
  storageTempMinC: number;
  storageTempMaxC: number;
  shelfLifeDays: number;
  typicalUnitVolumeMl: number;
  specialHandling: string;
}

export const COMPONENT_METADATA: Record<ComponentType, ComponentMetadata> = {
  PRBC: {
    type: 'PRBC',
    fullName: 'Packed Red Blood Cells (Leukoreduced)',
    storageTempMinC: 1,
    storageTempMaxC: 6,
    shelfLifeDays: 42,
    typicalUnitVolumeMl: 300,
    specialHandling: 'Cold-chain insulated container (1°C to 6°C), no freezing.',
  },
  PLATELETS: {
    type: 'PLATELETS',
    fullName: 'Platelet Concentrate (RDP / Apheresis SDP)',
    storageTempMinC: 20,
    storageTempMaxC: 24,
    shelfLifeDays: 5,
    typicalUnitVolumeMl: 250,
    specialHandling: 'Continuous gentle agitation at 20°C to 24°C; DO NOT REFRIGERATE.',
  },
  FFP: {
    type: 'FFP',
    fullName: 'Fresh Frozen Plasma',
    storageTempMinC: -25,
    storageTempMaxC: -18,
    shelfLifeDays: 365,
    typicalUnitVolumeMl: 250,
    specialHandling: 'Frozen solid below -18°C; requires dry ice/freeze pack during transit.',
  },
  CRYO: {
    type: 'CRYO',
    fullName: 'Cryoprecipitated AHF',
    storageTempMinC: -25,
    storageTempMaxC: -18,
    shelfLifeDays: 365,
    typicalUnitVolumeMl: 15,
    specialHandling: 'Frozen solid below -18°C; thaw only immediately prior to transfusion.',
  },
};

export interface BloodUnit {
  id: string; // e.g. "VS-U-0104"
  din: string; // Synthetic ISBT-128 format e.g. "=W1234260010400="
  bloodGroup: BloodGroup;
  component: ComponentType;
  volumeMl: number;
  collectionDate: string; // ISO string
  expiryDate: string; // ISO string
  currentLocationNodeId: string;
  status: 'available' | 'reserved' | 'in_transit' | 'delivered' | 'quarantine';
  tempC: number;
  anticoagulant: string;
  isSyntheticMock: true;
}

export interface NetworkNode {
  id: string;
  name: string;
  type: 'regional_blood_bank' | 'trauma_center_level_1' | 'community_hospital' | 'maternity_specialty';
  cityZone: string;
  lat: number;
  lng: number;
  contactOfficer: string;
  phoneExtension: string;
  safetyReserveFloorPercent: number; // minimum % stock retained locally
  storageCapacity: Record<ComponentType, number>;
}

export interface SurgeIncident {
  id: string;
  incidentNumber: string;
  title: string;
  type: 'MASS_CASUALTY' | 'OBSTETRIC_HEMORRHAGE' | 'TRAUMA_SURGE' | 'PLATELET_DEPLETION';
  targetNodeId: string;
  urgencyMinutes: number;
  requestedUnits: Array<{
    component: ComponentType;
    bloodGroup: BloodGroup;
    quantity: number;
    priority: 'STAT' | 'URGENT' | 'ROUTINE';
  }>;
  operationalNotes: string;
  createdAt: string;
  status: 'open' | 'optimizing' | 'plan_ready' | 'approved' | 'dispatched' | 'completed' | 'cancelled';
}

export interface TransferAllocationLeg {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  component: ComponentType;
  bloodGroup: BloodGroup;
  requestedGroup: BloodGroup;
  allocatedUnitIds: string[];
  distanceKm: number;
  standardEtaMin: number;
  resqtechCorridorEtaMin: number;
  transportMode: 'resqtech_priority' | 'standard_courier';
  sourceApproved?: boolean;
  sourceApprovedBy?: string;
  sourceApprovedAt?: string;
  receivingApproved?: boolean;
  receivingApprovedBy?: string;
  receivingApprovedAt?: string;
  dualApproved?: boolean;
  scoreBreakdown: {
    travelTimeScore: number; // 0-100
    fefoExpiryScore: number; // 0-100 (prioritize units closer to expiry)
    bufferSafetyScore: number; // 0-100 (impact on donor node reserve)
    compatibilityScore: number; // 0-100 (isogroup vs compatible)
    compositeScore: number;
  };
}

export interface RejectedCandidate {
  candidateId: string;
  centreName: string;
  reasonCode: string;
  explanation: string;
  stockAvailable: number;
  reserveFloor: number;
  distanceKm?: number;
}

export interface CandidateEvaluationReport {
  centreId: string;
  code: string;
  status: 'SELECTED' | 'REJECTED';
  reasonCode:
    | 'SELECTED'
    | 'STALE'
    | 'RESERVED'
    | 'SOURCE_RESERVE'
    | 'ETA_TOO_LATE'
    | 'EXPIRED'
    | 'HANDLING_UNAVAILABLE'
    | 'NO_STOCK';
  explanation: string;
  metrics: {
    distanceKm: number;
    activeEtaMin: number;
    viableUnits: number;
    staleUnitsExcluded: number;
    reserveFloor: number;
    donorStockRemaining: number;
    compositeScore?: number;
  };
}

export interface OptimizationPlan {
  id: string;
  incidentId: string;
  demandId?: string;
  createdAt: string;
  legs: TransferAllocationLeg[];
  rejectedCandidates?: RejectedCandidate[];
  candidateEvaluations?: CandidateEvaluationReport[];
  totalUnitsAllocated: number;
  totalUnitsRequested: number;
  fulfillmentRatePercent: number;
  fastestArrivalMin: number;
  longestArrivalMin: number;
  unmetQuantity?: number;
  unmetReasonCodes?: string[];
  approvalStatus: 'pending' | 'source_approved' | 'receiving_approved' | 'dual_approved' | 'approved' | 'committed' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  baselineComparison?: {
    unmetVitaSync: number;
    unmetStatusQuo: number;
    unitsPreservedFefo: number;
    sourceReservePreserved: number;
  };
}

export interface DispatchTracker {
  id: string;
  manifestId: string;
  incidentId: string;
  legId: string;
  sourceNodeId: string;
  targetNodeId: string;
  unitIds: string[];
  transportMode: 'resqtech_priority' | 'standard_courier';
  status: 'preparing' | 'in_transit' | 'delivered';
  dispatchedAt: string;
  estimatedArrival: string;
  progressPercent: number;
  coldChainTempC: number;
  tempAlert: boolean;
  corridorCheckpoints: Array<{
    id: string;
    label: string;
    cleared: boolean;
    timestamp?: string;
  }>;
  adapterDegraded: boolean; // simulated fallback trigger
  prioritySignalActive: boolean;
  driverCallsign: string;
}

export interface TransferManifest {
  id: string;
  manifestNumber: string;
  incidentId: string;
  generatedAt: string;
  sourceNode: {
    id: string;
    name: string;
    officer: string;
  };
  destinationNode: {
    id: string;
    name: string;
    officer: string;
  };
  units: Array<{
    id: string;
    din: string;
    bloodGroup: BloodGroup;
    component: ComponentType;
    volumeMl: number;
    expiryDate: string;
    originDepartureVerified: boolean;
    destinationArrivalVerified: boolean;
  }>;
  transportMode: string;
  coldChainDepartureTempC: number;
  coldChainArrivalTempC?: number;
  digitalSignature: string;
  verificationHash: string;
  legalDisclaimer: string;
}

export interface CompatibilityMatrixRule {
  patientGroup: BloodGroup;
  component: ComponentType;
  primaryCompatible: BloodGroup[];
  secondaryCompatible: BloodGroup[];
  incompatible: BloodGroup[];
  clinicalRationale: string;
}

export type UrgencyTier = 'STAT' | 'URGENT' | 'ROUTINE';

export type DemandLifecycleStatus =
  | 'SUBMITTED'
  | 'VALIDATED'
  | 'RANKED'
  | 'PLAN_PROPOSED'
  | 'PARTIALLY_FULFILLED'
  | 'SOURCE_APPROVED'
  | 'RECEIVER_APPROVED'
  | 'DISPATCH_READY'
  | 'IN_TRANSIT_SIMULATED'
  | 'DISRUPTED'
  | 'ARRIVED_SIMULATED'
  | 'COMPLETED_SIMULATED'
  | 'UNMET'
  | 'REJECTED'
  | 'CANCELLED'
  | 'OPEN'
  | 'COMMITTED';

export interface DemandRequestItem {
  id: string;
  batch_id?: string;
  target_centre_id: string;
  component: ComponentType;
  blood_group: BloodGroup;
  quantity: number;
  priority: string;
  urgency_tier: UrgencyTier;
  urgency_window_minutes: number;
  required_by: string;
  staff_entered_by: string;
  priority_rank: number;
  rank_reason?: string;
  fulfilled_quantity: number;
  unmet_quantity: number;
  allocated_plan_id?: string;
  operational_notes?: string;
  status: DemandLifecycleStatus;
  created_at: string;
}

export interface RoadEdgeItem {
  id: string;
  sourceCentreId: string;
  targetCentreId: string;
  distanceKm: number;
  baselineTravelTimeMin: number;
  currentTravelTimeMin: number;
  isClosed: boolean;
  additionalDelayMin: number;
  corridorEligible: boolean;
  roadName: string;
}

export interface CorridorRequestItem {
  id: string;
  transferId: string;
  routeJson: string;
  authorizedOperator: string;
  status:
    | 'NOT_REQUESTED'
    | 'SIMULATED_REQUESTED'
    | 'SIMULATED_APPROVED'
    | 'SIMULATED_DENIED'
    | 'SIMULATED_ACTIVE'
    | 'SIMULATED_RELEASED';
  requestedAt: string;
  updatedAt: string;
  details?: string;
}

