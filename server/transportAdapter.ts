/**
 * VitaSync: ResQtech Emergency Priority Transport Adapter & Deterministic Simulator
 *
 * SAFETY & HARDWARE BOUNDARY SPECIFICATION:
 * - This module is a strictly local deterministic adapter and routing simulator.
 * - ZERO LoRa radio packets, ZERO NTCIP/ATSPM traffic signal commands,
 *   and ZERO external municipal traffic control network calls are executed.
 * - All green-wave corridor preemption statuses are simulated locally.
 * - In the event of adapter unavailability, road closure, or traffic congestion,
 *   the adapter dynamically finds the optimal graph path or falls back to
 *   a standard commercial medical courier profile.
 */

import { db, logEvent } from './db.js';
import { getOptimizerEngine } from './optimizerInterface.js';

export interface RouteWaypoint {
  id: string;
  label: string;
  distanceOffsetKm: number;
}

export type TransportVehicleType = 'EMERGENCY_COURIER_VAN' | 'RAPID_RESPONSE_SEDAN' | 'DRONE_RESERVE_SIMULATED';

export interface RouteEstimate {
  sourceCentreId: string;
  targetCentreId: string;
  distanceKm: number;
  standardCourierEtaMin: number;
  resqtechCorridorEtaMin: number;
  activeEtaMin: number;
  modeUsed: 'RESQTECH_SIMULATED_PRIORITY' | 'NORMAL_ROUTE_FALLBACK';
  adapterStatus: 'SIMULATED_OPERATIONAL' | 'UNAVAILABLE_FALLBACK' | 'DISRUPTED_FALLBACK';
  vehicleType: TransportVehicleType;
  vehicleCapacity: number;
  vehicleAvailable: boolean;
  routePath: string[]; // sequence of centre IDs
  roadNames: string[];
  isDirectEdge: boolean;
  intersectionsCount: number;
  priorityCorridorCode: string;
  corridorStatusLabel: string;
  handlingRequirements: string[];
  waypoints: RouteWaypoint[];
  deadlineMet?: boolean;
}

export interface DisruptionRecord {
  dispatchId?: string;
  disruptionType:
    | 'CORRIDOR_COMM_FAILURE'
    | 'ROAD_BLOCKAGE'
    | 'ADAPTER_SERVICE_UNAVAILABLE'
    | 'VEHICLE_BREAKDOWN'
    | 'TRAFFIC_SURGE';
  delayAddedMinutes: number;
  reason: string;
  edgeId?: string;
  timestamp: string;
}

export interface ReplanOutcome {
  dispatchId?: string;
  demandId?: string;
  previousMode: string;
  newMode: 'NORMAL_ROUTE_FALLBACK' | 'RESQTECH_SIMULATED_PRIORITY';
  previousEtaMin: number;
  newEtaMin: number;
  urgencyWindowMinutes: number;
  isFeasible: boolean;
  outcomeCode: 'FEASIBLE_ON_FALLBACK' | 'DEADLINE_BREACH_NO_FEASIBLE_ROUTE' | 'RE_ROUTED_OPTIMAL';
  details: string;
}

export interface CorridorRequestRecord {
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

export interface ITransportAdapter {
  estimateRoute(
    sourceCentreId: string,
    targetCentreId: string,
    component?: string,
    vehicleType?: TransportVehicleType,
    urgencyTier?: string
  ): RouteEstimate;

  isAvailable(): boolean;
  setAvailable(available: boolean): void;

  setVehicleAvailable(available: boolean): void;
  isVehicleAvailable(): boolean;

  requestPriorityCorridor(
    transferId: string,
    route: RouteEstimate,
    authorizedOperator?: string
  ): CorridorRequestRecord;

  getCorridorStatus(requestId: string): CorridorRequestRecord | null;

  setCorridorDecision(
    requestId: string,
    status: 'SIMULATED_APPROVED' | 'SIMULATED_DENIED' | 'SIMULATED_ACTIVE' | 'SIMULATED_RELEASED',
    reason?: string
  ): CorridorRequestRecord;

  updateRoadEdge(
    edgeId: string,
    updates: { isClosed?: boolean; additionalDelayMin?: number }
  ): void;

  recordDisruption(
    dispatchId: string,
    disruptionType: DisruptionRecord['disruptionType'],
    reason?: string,
    additionalDelayMinutes?: number
  ): Promise<ReplanOutcome>;
}

export class ResQtechTransportSimulator implements ITransportAdapter {
  private adapterAvailable: boolean = true;
  private vehicleAvailableState: boolean = true;

  /**
   * Calculates Haversine distance with urban curvature factor
   */
  private calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 1.35 * 10) / 10;
  }

  /**
   * Resolves component-specific handling requirements
   */
  public getHandlingRequirements(component: string = 'PLATELETS'): string[] {
    switch (component.toUpperCase()) {
      case 'PLATELETS':
        return [
          'TEMPERATURE_STABILIZED_20_TO_24C',
          'CONTINUOUS_MECHANICAL_AGITATION_MANDATORY',
          'DO_NOT_REFRIGERATE_OR_EXPOSE_TO_ICE',
          'VERTICAL_PLATELET_CARRIER_PACKAGING',
        ];
      case 'PRBC':
        return [
          'COLD_CHAIN_TEMPERATURE_1_TO_6C',
          'INSULATED_CONTAINER_WITH_CALIBRATED_CHILL_PACKS',
          'DO_NOT_FREEZE',
        ];
      case 'FFP':
      case 'CRYO':
        return [
          'DEEP_FROZEN_BELOW_MINUS_18C',
          'DRY_ICE_CRYO_CONTAINMENT',
          'THAW_STRICTLY_AT_RECEIVING_BLOOD_BANK',
        ];
      default:
        return ['CLIMATE_CONTROLLED_MEDICAL_CARRIER'];
    }
  }

  public isAvailable(): boolean {
    return this.adapterAvailable;
  }

  public setAvailable(available: boolean): void {
    this.adapterAvailable = available;
    logEvent(
      'ADAPTER_AVAILABILITY_CHANGED',
      'ResQtech Transport Simulator',
      `ResQtech Priority Adapter status toggled: ${available ? 'OPERATIONAL' : 'UNAVAILABLE (Fallback Engaged)'}`,
      { available }
    );
  }

  public setVehicleAvailable(available: boolean): void {
    this.vehicleAvailableState = available;
    logEvent(
      'VEHICLE_AVAILABILITY_CHANGED',
      'ResQtech Transport Simulator',
      `Transport vehicle availability toggled: ${available ? 'AVAILABLE' : 'GROUNDED / UNAVAILABLE'}`,
      { available }
    );
  }

  public isVehicleAvailable(): boolean {
    return this.vehicleAvailableState;
  }

  /**
   * Updates road edge state in SQLite
   */
  public updateRoadEdge(
    edgeId: string,
    updates: { isClosed?: boolean; additionalDelayMin?: number }
  ): void {
    const edge = db.prepare('SELECT * FROM road_edges WHERE id = ?').get(edgeId) as any;
    if (!edge) {
      throw new Error(`Road edge ${edgeId} not found.`);
    }

    const isClosed = updates.isClosed !== undefined ? (updates.isClosed ? 1 : 0) : edge.is_closed;
    const additionalDelay = updates.additionalDelayMin !== undefined ? updates.additionalDelayMin : edge.additional_delay_min;
    const currentTravelTime = edge.baseline_travel_time_min + additionalDelay;

    db.prepare(`
      UPDATE road_edges
      SET is_closed = ?, additional_delay_min = ?, current_travel_time_min = ?
      WHERE id = ?
    `).run(isClosed, additionalDelay, currentTravelTime, edgeId);

    logEvent(
      'ROAD_NETWORK_UPDATED',
      'ResQtech Traffic Control Simulator',
      `Road segment ${edge.road_name} (${edge.id}) updated. Closed: ${Boolean(isClosed)}, Additional Delay: +${additionalDelay}m.`,
      { edgeId, isClosed: Boolean(isClosed), additionalDelay, currentTravelTime }
    );
  }

  /**
   * Dijkstra Shortest-Time Path algorithm over current road edges in SQLite
   */
  public findShortestPath(sourceCentreId: string, targetCentreId: string): {
    totalDistanceKm: number;
    totalStandardTimeMin: number;
    path: string[];
    roadNames: string[];
    edgesTraversed: any[];
    isDirect: boolean;
  } {
    const centres = db.prepare('SELECT id FROM centres').all() as Array<{ id: string }>;
    const edges = db.prepare('SELECT * FROM road_edges WHERE is_closed = 0').all() as any[];

    // Graph adjacency
    const adj: Record<string, Array<{ to: string; time: number; distance: number; name: string; edge: any }>> = {};
    for (const c of centres) {
      adj[c.id] = [];
    }
    for (const e of edges) {
      if (!adj[e.source_centre_id]) adj[e.source_centre_id] = [];
      adj[e.source_centre_id].push({
        to: e.target_centre_id,
        time: e.current_travel_time_min,
        distance: e.distance_km,
        name: e.road_name,
        edge: e,
      });
    }

    const dist: Record<string, number> = {};
    const prev: Record<string, { from: string; distance: number; name: string; edge: any } | null> = {};
    const unvisited = new Set<string>();

    for (const c of centres) {
      dist[c.id] = Infinity;
      prev[c.id] = null;
      unvisited.add(c.id);
    }
    dist[sourceCentreId] = 0;

    while (unvisited.size > 0) {
      let u: string | null = null;
      let minVal = Infinity;
      for (const node of unvisited) {
        if (dist[node] < minVal) {
          minVal = dist[node];
          u = node;
        }
      }

      if (!u || dist[u] === Infinity || u === targetCentreId) {
        break;
      }

      unvisited.delete(u);

      for (const neighbor of adj[u] || []) {
        if (unvisited.has(neighbor.to)) {
          const alt = dist[u] + neighbor.time;
          if (alt < dist[neighbor.to]) {
            dist[neighbor.to] = alt;
            prev[neighbor.to] = { from: u, distance: neighbor.distance, name: neighbor.name, edge: neighbor.edge };
          }
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    const roadNames: string[] = [];
    const edgesTraversed: any[] = [];
    let totalDist = 0;

    if (dist[targetCentreId] !== Infinity) {
      let curr = targetCentreId;
      while (curr !== sourceCentreId) {
        path.unshift(curr);
        const p = prev[curr];
        if (!p) break;
        totalDist += p.distance;
        roadNames.unshift(p.name);
        edgesTraversed.unshift(p.edge);
        curr = p.from;
      }
      path.unshift(sourceCentreId);
    }

    const isDirect = path.length === 2;

    return {
      totalDistanceKm: totalDist > 0 ? Math.round(totalDist * 10) / 10 : 8.4,
      totalStandardTimeMin: dist[targetCentreId] !== Infinity ? dist[targetCentreId] : 999,
      path,
      roadNames,
      edgesTraversed,
      isDirect,
    };
  }

  /**
   * Estimates transit route, duration, and simulated preemption status
   */
  public estimateRoute(
    sourceCentreId: string,
    targetCentreId: string,
    component: string = 'PLATELETS',
    vehicleType: TransportVehicleType = 'EMERGENCY_COURIER_VAN',
    _urgencyTier?: string
  ): RouteEstimate {
    const source = db.prepare('SELECT * FROM centres WHERE id = ?').get(sourceCentreId) as any;
    const target = db.prepare('SELECT * FROM centres WHERE id = ?').get(targetCentreId) as any;

    if (!source || !target) {
      throw new Error(`Centres ${sourceCentreId} or ${targetCentreId} not found in database.`);
    }

    const vehicleCapacity = vehicleType === 'EMERGENCY_COURIER_VAN' ? 12 : vehicleType === 'RAPID_RESPONSE_SEDAN' ? 6 : 4;
    const vehicleAvailable = this.vehicleAvailableState;

    // Use shortest path across road graph
    const pathResult = this.findShortestPath(sourceCentreId, targetCentreId);

    let distanceKm = pathResult.totalDistanceKm;
    let standardCourierEtaMin = pathResult.totalStandardTimeMin;

    if (standardCourierEtaMin >= 999) {
      // Direct graph disconnected due to closures - use geometric fallback with large delay penalty
      distanceKm = Math.max(1.5, this.calculateDistanceKm(source.lat, source.lng, target.lat, target.lng));
      standardCourierEtaMin = Math.round((distanceKm / 15) * 60 + 25); // Heavy detour penalty
    }

    // ResQtech simulated green corridor speed (simulated 44 km/h vs standard 22 km/h)
    // Dispatch overhead: 3 min (corridor) vs 5 min (standard)
    const resqtechCorridorEtaMin = Math.max(4, Math.round((distanceKm / 44) * 60 + 3));

    const isEligibleForCorridor = this.isAvailable() && vehicleAvailable;
    const modeUsed = isEligibleForCorridor ? 'RESQTECH_SIMULATED_PRIORITY' : 'NORMAL_ROUTE_FALLBACK';
    const adapterStatus = !vehicleAvailable
      ? 'DISRUPTED_FALLBACK'
      : this.isAvailable()
      ? 'SIMULATED_OPERATIONAL'
      : 'UNAVAILABLE_FALLBACK';

    const activeEtaMin = modeUsed === 'RESQTECH_SIMULATED_PRIORITY' ? resqtechCorridorEtaMin : standardCourierEtaMin;

    const corridorHash = Math.abs(Math.sin(source.lat + target.lng) * 10000)
      .toFixed(0)
      .padStart(4, '0');
    const priorityCorridorCode = `RQ-SIM-${corridorHash}`;

    const corridorStatusLabel = isEligibleForCorridor
      ? 'SIMULATED_PRIORITY_CORRIDOR_ACTIVE (Simulated Green-Wave - No Real Signal Hardware Commands)'
      : !vehicleAvailable
      ? 'VEHICLE_UNAVAILABLE_FALLBACK (Commercial Road Profile / Delayed)'
      : 'NORMAL_ROUTE_FALLBACK (Commercial Road Traffic Profile)';

    const intersectionsCount = Math.max(3, Math.round(distanceKm * 2.2));

    const waypoints: RouteWaypoint[] = [
      { id: 'wp-0', label: `${source.name} Departure Bay`, distanceOffsetKm: 0 },
      { id: 'wp-1', label: `Corridor Ingress Gate S-${corridorHash}`, distanceOffsetKm: Math.round(distanceKm * 0.25 * 10) / 10 },
      { id: 'wp-2', label: `Arterial Transit Link (${pathResult.roadNames[0] || 'Main Route'})`, distanceOffsetKm: Math.round(distanceKm * 0.55 * 10) / 10 },
      { id: 'wp-3', label: `Emergency Perimeter Ingress`, distanceOffsetKm: Math.round(distanceKm * 0.85 * 10) / 10 },
      { id: 'wp-4', label: `${target.name} Trauma Bay 4`, distanceOffsetKm: distanceKm },
    ];

    const handlingRequirements = this.getHandlingRequirements(component);

    return {
      sourceCentreId,
      targetCentreId,
      distanceKm,
      standardCourierEtaMin,
      resqtechCorridorEtaMin,
      activeEtaMin,
      modeUsed,
      adapterStatus,
      vehicleType,
      vehicleCapacity,
      vehicleAvailable,
      routePath: pathResult.path.length > 0 ? pathResult.path : [sourceCentreId, targetCentreId],
      roadNames: pathResult.roadNames.length > 0 ? pathResult.roadNames : ['Standard Metropolitan Link'],
      isDirectEdge: pathResult.isDirect,
      intersectionsCount,
      priorityCorridorCode,
      corridorStatusLabel,
      handlingRequirements,
      waypoints,
    };
  }

  /**
   * Request a simulated green-wave priority corridor for a transfer
   */
  public requestPriorityCorridor(
    transferId: string,
    route: RouteEstimate,
    authorizedOperator: string = 'Authorized ResQtech Operator'
  ): CorridorRequestRecord {
    const requestId = `CRQ-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    // Check if eligible
    const isApproved = this.isAvailable() && this.isVehicleAvailable();
    const initialStatus = isApproved ? 'SIMULATED_APPROVED' : 'SIMULATED_DENIED';
    const details = isApproved
      ? 'Simulated green-wave preemption authorized by deterministic simulation policy. Real signals untouched.'
      : 'Simulated priority corridor denied: adapter degraded or vehicle unavailable.';

    db.prepare(`
      INSERT INTO corridor_requests (
        id, transfer_id, route_json, authorized_operator, status, requested_at, updated_at, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestId,
      transferId,
      JSON.stringify(route),
      authorizedOperator,
      initialStatus,
      now,
      now,
      details
    );

    logEvent(
      'CORRIDOR_REQUEST_LOGGED',
      authorizedOperator,
      `Simulated corridor ${requestId} for transfer ${transferId} evaluated: ${initialStatus}.`,
      { requestId, transferId, status: initialStatus }
    );

    return {
      id: requestId,
      transferId,
      routeJson: JSON.stringify(route),
      authorizedOperator,
      status: initialStatus,
      requestedAt: now,
      updatedAt: now,
      details,
    };
  }

  public getCorridorStatus(requestId: string): CorridorRequestRecord | null {
    const row = db.prepare('SELECT * FROM corridor_requests WHERE id = ?').get(requestId) as any;
    if (!row) return null;
    return {
      id: row.id,
      transferId: row.transfer_id,
      routeJson: row.route_json,
      authorizedOperator: row.authorized_operator,
      status: row.status,
      requestedAt: row.requested_at,
      updatedAt: row.updated_at,
      details: row.details,
    };
  }

  public setCorridorDecision(
    requestId: string,
    status: 'SIMULATED_APPROVED' | 'SIMULATED_DENIED' | 'SIMULATED_ACTIVE' | 'SIMULATED_RELEASED',
    reason?: string
  ): CorridorRequestRecord {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE corridor_requests
      SET status = ?, updated_at = ?, details = ?
      WHERE id = ?
    `).run(status, now, reason || `Status updated to ${status} by simulator.`, requestId);

    const updated = this.getCorridorStatus(requestId);
    if (!updated) {
      throw new Error(`Corridor request ${requestId} not found.`);
    }

    logEvent(
      'CORRIDOR_STATE_TRANSITION',
      'ResQtech Traffic Simulator',
      `Corridor ${requestId} transitioned to ${status}. Reason: ${reason || 'Operator simulation control'}`,
      { requestId, status, reason }
    );

    return updated;
  }

  /**
   * Records a traffic delay or corridor outage and triggers re-planning
   */
  public async recordDisruption(
    dispatchId: string,
    disruptionType: DisruptionRecord['disruptionType'] = 'CORRIDOR_COMM_FAILURE',
    reason: string = 'Simulated telemetry loss along arterial corridor',
    additionalDelayMinutes: number = 0
  ): Promise<ReplanOutcome> {
    const dispatch = db.prepare('SELECT * FROM dispatches WHERE id = ?').get(dispatchId) as any;
    if (!dispatch) {
      throw new Error(`Dispatch mission ${dispatchId} not found in database.`);
    }

    const demand = db.prepare('SELECT * FROM demand_requests WHERE id = ?').get(dispatch.demand_id) as any;
    const urgencyWindowMinutes = demand ? demand.urgency_window_minutes : 30;

    // Mark adapter as degraded for this corridor
    this.setAvailable(false);

    // Calculate revised route via fallback
    const route = this.estimateRoute(dispatch.source_centre_id, dispatch.target_centre_id, 'PLATELETS');
    const revisedEtaMin = route.standardCourierEtaMin + additionalDelayMinutes;
    const previousEtaMin = route.resqtechCorridorEtaMin;

    // Check feasibility against emergency deadline
    const isFeasible = revisedEtaMin <= urgencyWindowMinutes;
    const outcomeCode: ReplanOutcome['outcomeCode'] = isFeasible
      ? 'FEASIBLE_ON_FALLBACK'
      : 'DEADLINE_BREACH_NO_FEASIBLE_ROUTE';

    const details = isFeasible
      ? `ResQtech priority degraded. Courier switched to normal route. Revised ETA (${revisedEtaMin} min) meets emergency window (${urgencyWindowMinutes} min).`
      : `CRITICAL ROUTE INFEASIBLE: Revised normal-route ETA (${revisedEtaMin} min) breaches emergency window (${urgencyWindowMinutes} min). Re-routing or alternate donor required.`;

    // Update dispatch record in SQLite
    const revisedEstimatedArrival = new Date(Date.now() + revisedEtaMin * 60 * 1000).toISOString();

    db.prepare(`
      UPDATE dispatches
      SET status = ?, transport_mode = 'STANDARD_COURIER', adapter_degraded = 1, estimated_arrival = ?
      WHERE id = ?
    `).run(isFeasible ? 'FALLBACK_STANDARD_ROUTE' : 'DISRUPTED_DEADLINE_BREACH', revisedEstimatedArrival, dispatchId);

    // Trigger the actual optimizer to recalculate with degraded adapter
    const optimizer = getOptimizerEngine();
    await optimizer.optimize(dispatch.demand_id, { resqtechDegraded: true });

    logEvent(
      'CORRIDOR_DISRUPTION_RECORDED',
      'ResQtech Transport Simulator',
      `Disruption '${disruptionType}' logged on dispatch ${dispatchId}. ${details}`,
      {
        dispatchId,
        demandId: dispatch.demand_id,
        disruptionType,
        previousEtaMin,
        revisedEtaMin,
        urgencyWindowMinutes,
        outcomeCode,
        isFeasible,
      }
    );

    return {
      dispatchId,
      demandId: dispatch.demand_id,
      previousMode: dispatch.transport_mode,
      newMode: 'NORMAL_ROUTE_FALLBACK',
      previousEtaMin,
      newEtaMin: revisedEtaMin,
      urgencyWindowMinutes,
      isFeasible,
      outcomeCode,
      details,
    };
  }
}

// Active singleton instance
export const transportAdapter = new ResQtechTransportSimulator();
