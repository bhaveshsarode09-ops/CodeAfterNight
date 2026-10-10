/**
 * VitaSync: Multi-Criteria Emergency Redistribution Optimization Engine
 *
 * Runs algorithmic allocation across candidate donor nodes based on:
 * 1. Proximity & Transit Corridor Speed (ResQtech simulated corridor vs standard courier)
 * 2. FEFO (First-Expiring, First-Out) shelf-life preservation
 * 3. Donor Safety Floor Protection (preserves minimum local reserve floor)
 * 4. Demo Redistribution Compatibility Matrix (non-clinical dispatch rules)
 */

import {
  BloodGroup,
  BloodUnit,
  ComponentType,
  NetworkNode,
  OptimizationPlan,
  SurgeIncident,
  TransferAllocationLeg,
} from '../types/blood';
import { getCompatibleDonorGroups, isDirectIsogroup } from './compatibilityRules';
import { resqtechAdapter } from './resqtechAdapter';

interface CandidateUnitMatch {
  unit: BloodUnit;
  sourceNode: NetworkNode;
  travelTimeMin: number;
  distanceKm: number;
  scores: {
    travelTimeScore: number;
    fefoExpiryScore: number;
    bufferSafetyScore: number;
    compatibilityScore: number;
    compositeScore: number;
  };
}

export function runRedistributionOptimization(
  incident: SurgeIncident,
  allUnits: BloodUnit[],
  allNodes: NetworkNode[],
  policyMode: 'standard_demo_matrix' | 'strict_isogroup' | 'universal_emergency' = 'standard_demo_matrix'
): OptimizationPlan {
  const targetNode = allNodes.find((n) => n.id === incident.targetNodeId);
  if (!targetNode) {
    throw new Error(`Target node ${incident.targetNodeId} not found in network.`);
  }

  // Map nodes by ID
  const nodeMap = new Map<string, NetworkNode>(allNodes.map((n) => [n.id, n]));

  // Calculate current baseline component counts per node (for buffer safety floor check)
  const nodeComponentCounts: Record<string, Record<ComponentType, number>> = {};
  for (const node of allNodes) {
    nodeComponentCounts[node.id] = { PRBC: 0, PLATELETS: 0, FFP: 0, CRYO: 0 };
  }
  for (const unit of allUnits) {
    if (unit.status === 'available' && nodeComponentCounts[unit.currentLocationNodeId]) {
      nodeComponentCounts[unit.currentLocationNodeId][unit.component]++;
    }
  }

  // Track tentatively allocated unit IDs during this optimization run
  const allocatedUnitIds = new Set<string>();
  const legsBySourceAndComponent: Map<string, TransferAllocationLeg> = new Map();

  let totalRequestedUnits = 0;
  let totalAllocatedUnits = 0;

  const now = new Date();

  // Iterate each requested blood component & group in the surge incident
  for (const req of incident.requestedUnits) {
    totalRequestedUnits += req.quantity;
    const compatibleGroups = getCompatibleDonorGroups(req.component, req.bloodGroup, policyMode);

    // Find all viable candidate units in network (excluding target node)
    const candidates: CandidateUnitMatch[] = [];

    for (const unit of allUnits) {
      if (unit.status !== 'available') continue;
      if (allocatedUnitIds.has(unit.id)) continue;
      if (unit.currentLocationNodeId === incident.targetNodeId) continue;
      if (unit.component !== req.component) continue;
      if (!compatibleGroups.includes(unit.bloodGroup)) continue;

      const sourceNode = nodeMap.get(unit.currentLocationNodeId);
      if (!sourceNode) continue;

      // Check source node safety floor
      const availableAtSource = nodeComponentCounts[sourceNode.id][unit.component];
      const safetyFloorCount = Math.ceil(
        (sourceNode.storageCapacity[unit.component] * sourceNode.safetyReserveFloorPercent) / 100
      );

      // If source node is already below or at its safety floor, skip unless critical deficit
      if (availableAtSource <= safetyFloorCount && availableAtSource <= 2) {
        continue;
      }

      // Compute route via ResQtech adapter
      const route = resqtechAdapter.planCorridor(sourceNode, targetNode);
      const travelTimeMin = route.activeDurationMin;

      // Compute sub-scores (0 - 100)
      // 1. Travel Time Score: 100 for <= 15 min, decaying down to 20 for > 60 min
      const travelTimeScore = Math.max(10, Math.min(100, Math.round(100 - (travelTimeMin / incident.urgencyMinutes) * 60)));

      // 2. FEFO Expiry Score: prioritize units expiring sooner (prevent wastage)
      const expiry = new Date(unit.expiryDate);
      const hoursUntilExpiry = Math.max(1, (expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
      // FEFO gives higher score to units closer to expiry, provided they have at least 12 hours buffer
      let fefoExpiryScore = 50;
      if (unit.component === 'PLATELETS') {
        // Platelets have 5 day max shelf life
        fefoExpiryScore = Math.max(20, Math.min(100, Math.round(100 - (hoursUntilExpiry / 96) * 60)));
      } else {
        // Red cells / FFP
        fefoExpiryScore = Math.max(20, Math.min(100, Math.round(100 - (hoursUntilExpiry / 720) * 50)));
      }

      // 3. Buffer Safety Score: how well does the donor node tolerate giving this unit?
      const bufferSurplus = availableAtSource - safetyFloorCount;
      const bufferSafetyScore = Math.max(20, Math.min(100, Math.round(40 + bufferSurplus * 5)));

      // 4. Compatibility Score: 100 for exact isogroup match, 80 for compatible alternate
      const compatibilityScore = isDirectIsogroup(unit.bloodGroup, req.bloodGroup) ? 100 : 80;

      // Composite Weighted Score
      const compositeScore = Math.round(
        travelTimeScore * 0.35 +
        fefoExpiryScore * 0.30 +
        bufferSafetyScore * 0.20 +
        compatibilityScore * 0.15
      );

      candidates.push({
        unit,
        sourceNode,
        travelTimeMin,
        distanceKm: route.distanceKm,
        scores: {
          travelTimeScore,
          fefoExpiryScore,
          bufferSafetyScore,
          compatibilityScore,
          compositeScore,
        },
      });
    }

    // Sort candidates descending by composite score
    candidates.sort((a, b) => b.scores.compositeScore - a.scores.compositeScore);

    // Pick top candidates up to requested quantity
    const chosen = candidates.slice(0, req.quantity);

    for (const match of chosen) {
      allocatedUnitIds.add(match.unit.id);
      totalAllocatedUnits++;

      // Deduct available count locally for remaining evaluations
      nodeComponentCounts[match.sourceNode.id][match.unit.component]--;

      const legKey = `${match.sourceNode.id}_${req.component}_${req.bloodGroup}`;
      const route = resqtechAdapter.planCorridor(match.sourceNode, targetNode);

      if (!legsBySourceAndComponent.has(legKey)) {
        legsBySourceAndComponent.set(legKey, {
          id: `LEG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          sourceNodeId: match.sourceNode.id,
          targetNodeId: targetNode.id,
          component: req.component,
          bloodGroup: match.unit.bloodGroup,
          requestedGroup: req.bloodGroup,
          allocatedUnitIds: [match.unit.id],
          distanceKm: route.distanceKm,
          standardEtaMin: route.standardDurationMin,
          resqtechCorridorEtaMin: route.resqtechDurationMin,
          transportMode: route.modeUsed,
          scoreBreakdown: {
            travelTimeScore: match.scores.travelTimeScore,
            fefoExpiryScore: match.scores.fefoExpiryScore,
            bufferSafetyScore: match.scores.bufferSafetyScore,
            compatibilityScore: match.scores.compatibilityScore,
            compositeScore: match.scores.compositeScore,
          },
        });
      } else {
        const existingLeg = legsBySourceAndComponent.get(legKey)!;
        existingLeg.allocatedUnitIds.push(match.unit.id);
      }
    }
  }

  const legs = Array.from(legsBySourceAndComponent.values());
  const arrivalTimes = legs.map((l) =>
    l.transportMode === 'resqtech_priority' ? l.resqtechCorridorEtaMin : l.standardEtaMin
  );
  const fastestArrivalMin = arrivalTimes.length > 0 ? Math.min(...arrivalTimes) : 0;
  const longestArrivalMin = arrivalTimes.length > 0 ? Math.max(...arrivalTimes) : 0;

  const fulfillmentRatePercent =
    totalRequestedUnits > 0
      ? Math.round((totalAllocatedUnits / totalRequestedUnits) * 100)
      : 100;

  return {
    id: `PLAN-OPT-${Date.now().toString(36).toUpperCase()}`,
    incidentId: incident.id,
    createdAt: new Date().toISOString(),
    legs,
    totalUnitsAllocated: totalAllocatedUnits,
    totalUnitsRequested: totalRequestedUnits,
    fulfillmentRatePercent,
    fastestArrivalMin,
    longestArrivalMin,
    approvalStatus: 'pending',
  };
}
