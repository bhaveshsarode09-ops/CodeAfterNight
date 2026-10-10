/**
 * VitaSync: Documented Optimizer Engine Integration Point
 *
 * =========================================================================
 * ARCHITECTURAL CONTRACT:
 * Defines optimizer data types and provides active singleton instance.
 * Preserves all Agent 1 database bindings, route handlers, and API schemas.
 * =========================================================================
 */

export interface AllocationLegDraft {
  legId: string;
  sourceCentreId: string;
  targetCentreId: string;
  allocatedUnitIds: string[];
  distanceKm: number;
  resqtechCorridorEtaMin: number;
  standardRouteEtaMin: number;
  activeEtaMin: number;
  scores: {
    transitSpeedScore: number;
    fefoExpiryScore: number;
    donorBufferSafetyScore: number;
    compositeScore: number;
  };
}

export interface RejectedCandidateEvaluation {
  centreId: string;
  reason: 'FEFO_STALE_STOCK' | 'RESERVE_FLOOR_BREACH_AND_ETA_EXCEEDED' | 'COMPATIBILITY_MISMATCH' | 'DISRUPTED_TRANSIT';
  details: string;
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

export interface BaselineComparisonMetrics {
  method: 'VITA_SYNC_HEURISTIC' | 'NEAREST_CENTRE_FIRST' | 'NO_TRANSFER_STATUS_QUO';
  unmetUnits: number;
  fastestEtaMin: number;
  stockExcludedAsStale: number;
  sourceReserveRemaining: number;
  expiryRiskScore: number;
}

export interface OptimizationPlanResult {
  planId: string;
  demandId: string;
  status: 'PLAN_GENERATED';
  solverStatus: 'OPTIMAL' | 'FEASIBLE' | 'FEASIBLE_HEURISTIC_OPTIMAL' | 'PARTIAL_FEASIBLE' | 'PENDING_AGENT2_SOLVER';
  fulfillmentPercent: number;
  totalUnitsAllocated: number;
  unmetQuantity?: number;
  unmetReasonCodes?: string[];
  allocatedLegs: AllocationLegDraft[];
  rejectedCandidates: RejectedCandidateEvaluation[];
  candidateEvaluations?: CandidateEvaluationReport[];
  baselineComparison?: {
    vitaSync: BaselineComparisonMetrics;
    nearestCentreFirst: BaselineComparisonMetrics;
    noTransferStatusQuo: BaselineComparisonMetrics;
  };
  algorithmMetadata?: {
    solverType: string;
    dependencyStatus: string;
    objectiveFunction: string;
  };
}

export interface BatchAllocationPlanResult {
  batchId: string;
  planId: string;
  status: 'PLAN_GENERATED';
  solverStatus: 'FEASIBLE_HEURISTIC_OPTIMAL' | 'PARTIAL_FEASIBLE' | 'NO_FEASIBLE_DONORS';
  totalRequests: number;
  fullyFulfilledRequests: number;
  partiallyFulfilledRequests: number;
  unmetRequests: number;
  totalUnitsAllocated: number;
  totalUnitsRequested: number;
  allocatedLegs: AllocationLegDraft[];
  requestResults: Array<{
    requestId: string;
    targetCentreId: string;
    requestedQuantity: number;
    fulfilledQuantity: number;
    unmetQuantity: number;
    priorityTier: string;
    priorityRank: number;
    rankReason: string;
    deadlineSlackMin: number;
    bestFeasibleArrivalMin: number;
    status: string;
    legs: AllocationLegDraft[];
    unmetReasonCodes: string[];
    explanation: string;
  }>;
  candidateEvaluations: CandidateEvaluationReport[];
  rejectedCandidates: RejectedCandidateEvaluation[];
  algorithmMetadata: {
    solverType: string;
    objectiveFunction: string;
    tieBreakerPolicy: string;
  };
}

export interface IOptimizerEngine {
  optimize(
    demandId: string,
    options?: { resqtechDegraded?: boolean }
  ): Promise<OptimizationPlanResult>;

  optimizeBatch?(
    batchId?: string,
    options?: { resqtechDegraded?: boolean }
  ): Promise<BatchAllocationPlanResult>;
}

// Import and set active optimizer engine
import { DeterministicFeasibleCandidateOptimizer } from './optimizer.js';

let activeOptimizer: IOptimizerEngine | null = null;

export function getOptimizerEngine(): IOptimizerEngine {
  if (!activeOptimizer) {
    activeOptimizer = new DeterministicFeasibleCandidateOptimizer();
  }
  return activeOptimizer;
}

export function setOptimizerEngine(engine: IOptimizerEngine): void {
  activeOptimizer = engine;
}

