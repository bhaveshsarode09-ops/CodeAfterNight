/**
 * ResQtech Transport Adapter (SIMULATOR ONLY)
 *
 * CRITICAL SAFETY / COMPLIANCE NOTICE:
 * This software module is a simulated priority logistics adapter.
 * It contains ZERO connections to real-world municipal traffic signal controllers,
 * NTCIP/ATSPM hardware, emergency vehicle transponders, or radio preemption systems.
 * It provides simulated corridor routing and automated normal-route fallback.
 */

import { NetworkNode } from '../types/blood';

export interface RouteCorridorPlan {
  distanceKm: number;
  standardDurationMin: number;
  resqtechDurationMin: number;
  activeDurationMin: number;
  modeUsed: 'resqtech_priority' | 'standard_courier';
  adapterStatus: 'nominal' | 'degraded_fallback' | 'offline_fallback';
  intersectionsCount: number;
  priorityCorridorCode: string;
  checkpoints: Array<{
    id: string;
    label: string;
    distanceOffsetKm: number;
  }>;
}

/**
 * Haversine distance calculator between geographical coordinates
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rawDist = R * c;
  // Apply urban road curvature factor (~1.3x straight-line distance)
  return Math.round(rawDist * 1.35 * 10) / 10;
}

class ResQtechTransportAdapter {
  private isDegraded: boolean = false;
  private isOffline: boolean = false;

  public setDegradedMode(degraded: boolean): void {
    this.isDegraded = degraded;
  }

  public setOfflineMode(offline: boolean): void {
    this.isOffline = offline;
  }

  public getAdapterStatus(): 'nominal' | 'degraded_fallback' | 'offline_fallback' {
    if (this.isOffline) return 'offline_fallback';
    if (this.isDegraded) return 'degraded_fallback';
    return 'nominal';
  }

  public isPriorityAvailable(): boolean {
    return !this.isDegraded && !this.isOffline;
  }

  /**
   * Plans simulated corridor transport between two nodes
   */
  public planCorridor(source: NetworkNode, dest: NetworkNode): RouteCorridorPlan {
    const distanceKm = Math.max(1.5, calculateHaversineDistanceKm(source.lat, source.lng, dest.lat, dest.lng));

    // Standard courier in congested urban grid: ~22 km/h avg speed + 5 min dispatch overhead
    const standardDurationMin = Math.round((distanceKm / 22) * 60 + 5);

    // ResQtech simulated green corridor: ~44 km/h simulated clearance + 3 min dispatch overhead
    const resqtechDurationMin = Math.round((distanceKm / 44) * 60 + 3);

    const available = this.isPriorityAvailable();
    const modeUsed: 'resqtech_priority' | 'standard_courier' = available
      ? 'resqtech_priority'
      : 'standard_courier';

    const activeDurationMin = available ? resqtechDurationMin : standardDurationMin;

    const intersectionsCount = Math.max(3, Math.round(distanceKm * 2.2));
    const corridorHash = Math.abs(
      Math.sin(source.lat + dest.lng) * 10000
    ).toFixed(0).padStart(4, '0');

    const checkpoints = [
      { id: 'cp-origin', label: `${source.name} Departure Bay`, distanceOffsetKm: 0 },
      { id: 'cp-gate-1', label: `Corridor Ingress Point (Strobe S-${corridorHash})`, distanceOffsetKm: distanceKm * 0.25 },
      { id: 'cp-midway', label: `Central Transit Corridor Waypoint`, distanceOffsetKm: distanceKm * 0.55 },
      { id: 'cp-gate-2', label: `Emergency Ingress Perimeter`, distanceOffsetKm: distanceKm * 0.85 },
      { id: 'cp-dest', label: `${dest.name} Receiving Bay`, distanceOffsetKm: distanceKm },
    ];

    return {
      distanceKm,
      standardDurationMin,
      resqtechDurationMin,
      activeDurationMin,
      modeUsed,
      adapterStatus: this.getAdapterStatus(),
      intersectionsCount,
      priorityCorridorCode: `RQ-SIM-${corridorHash}`,
      checkpoints,
    };
  }
}

export const resqtechAdapter = new ResQtechTransportAdapter();
