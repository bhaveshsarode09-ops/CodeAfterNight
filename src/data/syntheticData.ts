/**
 * Synthetic Network Nodes & Blood Inventory Dataset
 * ALL DATA ARE FICTIONAL AND SYNTHETIC FOR LOGISTICS SIMULATION PROTOTYPING.
 * Zero live patient records, donor personal contact info, or external APIs.
 */

import { BloodGroup, BloodUnit, ComponentType, NetworkNode } from '../types/blood';

export const SYNTHETIC_NODES: NetworkNode[] = [
  {
    id: 'node-apex',
    name: 'Apex Regional Blood Center',
    type: 'regional_blood_bank',
    cityZone: 'Central Logistics Hub',
    lat: 12.9716,
    lng: 77.5946,
    contactOfficer: 'Dr. R. Bannerjee (Logistics Officer)',
    phoneExtension: 'Ext. 401',
    safetyReserveFloorPercent: 15,
    storageCapacity: { PRBC: 200, PLATELETS: 50, FFP: 120, CRYO: 80 },
  },
  {
    id: 'node-metro',
    name: 'Metro Trauma Center (Level 1)',
    type: 'trauma_center_level_1',
    cityZone: 'Downtown Core',
    lat: 12.9352,
    lng: 77.6245,
    contactOfficer: 'Dr. S. Nair (Trauma Bay Director)',
    phoneExtension: 'Ext. 102',
    safetyReserveFloorPercent: 25,
    storageCapacity: { PRBC: 100, PLATELETS: 30, FFP: 60, CRYO: 40 },
  },
  {
    id: 'node-stjude',
    name: 'St. Jude Specialty & Pediatric Hospital',
    type: 'maternity_specialty',
    cityZone: 'North Medical Enclave',
    lat: 13.0125,
    lng: 77.5512,
    contactOfficer: 'Nurse Supervisor M. Joshi',
    phoneExtension: 'Ext. 209',
    safetyReserveFloorPercent: 20,
    storageCapacity: { PRBC: 60, PLATELETS: 25, FFP: 40, CRYO: 30 },
  },
  {
    id: 'node-mercy',
    name: 'Mercy Community Hospital',
    type: 'community_hospital',
    cityZone: 'East Urban Zone',
    lat: 12.9821,
    lng: 77.6698,
    contactOfficer: 'K. Pillai (Blood Storage Tech)',
    phoneExtension: 'Ext. 315',
    safetyReserveFloorPercent: 20,
    storageCapacity: { PRBC: 70, PLATELETS: 20, FFP: 40, CRYO: 25 },
  },
  {
    id: 'node-bayside',
    name: 'Bayside Surgical & Cardiac Center',
    type: 'trauma_center_level_1',
    cityZone: 'South Harbor District',
    lat: 12.9101,
    lng: 77.5855,
    contactOfficer: 'Dr. A. Verma (OR Coordinator)',
    phoneExtension: 'Ext. 518',
    safetyReserveFloorPercent: 25,
    storageCapacity: { PRBC: 80, PLATELETS: 25, FFP: 50, CRYO: 35 },
  },
  {
    id: 'node-north',
    name: 'North Point Memorial Hospital',
    type: 'community_hospital',
    cityZone: 'Northwest Ring Corridor',
    lat: 13.0450,
    lng: 77.5892,
    contactOfficer: 'E. D\'Souza (Inventory Dispatch)',
    phoneExtension: 'Ext. 620',
    safetyReserveFloorPercent: 18,
    storageCapacity: { PRBC: 65, PLATELETS: 15, FFP: 35, CRYO: 20 },
  },
];

/**
 * Synthetic Historical Tabular Dataset (modeled on Open Healthcare Logistics Studies)
 * License: CC0 / Public Synthetic Logistics Benchmark.
 * Note: Purely historical aggregate consumption metrics. No live donor records or PII.
 */
export interface KaggleHistoricalDemandRow {
  date: string;
  weekday: string;
  totalCollections: number;
  routineIssues: number;
  emergencySurgeDemands: number;
  unfulfilledEmergencyUnits: number;
  oNegDeficitPercentage: number;
  plateletWastagePercent: number;
  trafficDisruptionFlag: boolean;
}

export const SYNTHETIC_KAGGLE_HISTORICAL_DATA: KaggleHistoricalDemandRow[] = [
  { date: '2026-03-01', weekday: 'Sunday', totalCollections: 42, routineIssues: 38, emergencySurgeDemands: 14, unfulfilledEmergencyUnits: 2, oNegDeficitPercentage: 18, plateletWastagePercent: 3.2, trafficDisruptionFlag: false },
  { date: '2026-03-02', weekday: 'Monday', totalCollections: 58, routineIssues: 51, emergencySurgeDemands: 8, unfulfilledEmergencyUnits: 0, oNegDeficitPercentage: 8, plateletWastagePercent: 2.1, trafficDisruptionFlag: false },
  { date: '2026-03-03', weekday: 'Tuesday', totalCollections: 52, routineIssues: 46, emergencySurgeDemands: 11, unfulfilledEmergencyUnits: 1, oNegDeficitPercentage: 12, plateletWastagePercent: 2.8, trafficDisruptionFlag: false },
  { date: '2026-03-04', weekday: 'Wednesday', totalCollections: 49, routineIssues: 45, emergencySurgeDemands: 6, unfulfilledEmergencyUnits: 0, oNegDeficitPercentage: 5, plateletWastagePercent: 1.9, trafficDisruptionFlag: false },
  { date: '2026-03-05', weekday: 'Thursday', totalCollections: 55, routineIssues: 52, emergencySurgeDemands: 9, unfulfilledEmergencyUnits: 0, oNegDeficitPercentage: 9, plateletWastagePercent: 2.4, trafficDisruptionFlag: false },
  { date: '2026-03-06', weekday: 'Friday', totalCollections: 64, routineIssues: 60, emergencySurgeDemands: 19, unfulfilledEmergencyUnits: 4, oNegDeficitPercentage: 24, plateletWastagePercent: 4.1, trafficDisruptionFlag: true },
  { date: '2026-03-07', weekday: 'Saturday', totalCollections: 71, routineIssues: 58, emergencySurgeDemands: 23, unfulfilledEmergencyUnits: 6, oNegDeficitPercentage: 28, plateletWastagePercent: 3.9, trafficDisruptionFlag: true },
  { date: '2026-03-08', weekday: 'Sunday', totalCollections: 44, routineIssues: 36, emergencySurgeDemands: 16, unfulfilledEmergencyUnits: 3, oNegDeficitPercentage: 21, plateletWastagePercent: 3.5, trafficDisruptionFlag: false },
  { date: '2026-03-09', weekday: 'Monday', totalCollections: 60, routineIssues: 49, emergencySurgeDemands: 7, unfulfilledEmergencyUnits: 0, oNegDeficitPercentage: 7, plateletWastagePercent: 1.8, trafficDisruptionFlag: false },
  { date: '2026-03-10', weekday: 'Tuesday', totalCollections: 53, routineIssues: 47, emergencySurgeDemands: 10, unfulfilledEmergencyUnits: 1, oNegDeficitPercentage: 11, plateletWastagePercent: 2.2, trafficDisruptionFlag: false },
  { date: '2026-03-11', weekday: 'Wednesday', totalCollections: 51, routineIssues: 44, emergencySurgeDemands: 8, unfulfilledEmergencyUnits: 0, oNegDeficitPercentage: 6, plateletWastagePercent: 2.0, trafficDisruptionFlag: false },
  { date: '2026-03-12', weekday: 'Thursday', totalCollections: 58, routineIssues: 50, emergencySurgeDemands: 12, unfulfilledEmergencyUnits: 1, oNegDeficitPercentage: 14, plateletWastagePercent: 2.6, trafficDisruptionFlag: false },
  { date: '2026-03-13', weekday: 'Friday', totalCollections: 62, routineIssues: 57, emergencySurgeDemands: 22, unfulfilledEmergencyUnits: 5, oNegDeficitPercentage: 26, plateletWastagePercent: 4.3, trafficDisruptionFlag: true },
  { date: '2026-03-14', weekday: 'Saturday', totalCollections: 68, routineIssues: 55, emergencySurgeDemands: 26, unfulfilledEmergencyUnits: 7, oNegDeficitPercentage: 32, plateletWastagePercent: 4.8, trafficDisruptionFlag: true },
  { date: '2026-03-15', weekday: 'Sunday', totalCollections: 41, routineIssues: 34, emergencySurgeDemands: 15, unfulfilledEmergencyUnits: 2, oNegDeficitPercentage: 19, plateletWastagePercent: 3.1, trafficDisruptionFlag: false },
];

/**
 * Generator for realistic initial synthetic blood units with ISBT-128 DINs
 */
function generateInitialUnits(): BloodUnit[] {
  const units: BloodUnit[] = [];
  const groups: BloodGroup[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
  const components: ComponentType[] = ['PRBC', 'PLATELETS', 'FFP', 'CRYO'];
  const nodes = ['node-apex', 'node-metro', 'node-stjude', 'node-mercy', 'node-bayside', 'node-north'];

  let seq = 100;

  // Apex (Regional Bank) holds heavy inventory of all types
  // Metro Trauma holds active trauma inventory with low O- buffer
  // Others hold local reserves

  const nodeStockDistribution: Record<string, { prbc: number; plat: number; ffp: number; cryo: number }> = {
    'node-apex': { prbc: 42, plat: 14, ffp: 22, cryo: 12 },
    'node-metro': { prbc: 18, plat: 6, ffp: 10, cryo: 6 },
    'node-mercy': { prbc: 14, plat: 4, ffp: 8, cryo: 4 },
    'node-stjude': { prbc: 12, plat: 5, ffp: 6, cryo: 4 },
    'node-bayside': { prbc: 16, plat: 4, ffp: 8, cryo: 5 },
    'node-north': { prbc: 12, plat: 3, ffp: 6, cryo: 3 },
  };

  const now = new Date('2026-10-09T08:00:00Z');

  for (const nodeId of nodes) {
    const counts = nodeStockDistribution[nodeId];

    // Helper to push units
    const addUnits = (comp: ComponentType, count: number, maxDaysLeft: number) => {
      for (let i = 0; i < count; i++) {
        seq++;
        // Weight blood groups realistically: O+ and A+ common, O- valuable, AB rare
        const rand = Math.random();
        let group: BloodGroup = 'O+';
        if (rand < 0.35) group = 'O+';
        else if (rand < 0.50) group = 'A+';
        else if (rand < 0.65) group = 'B+';
        else if (rand < 0.77) group = 'O-'; // 12% O-
        else if (rand < 0.85) group = 'A-';
        else if (rand < 0.92) group = 'B-';
        else if (rand < 0.97) group = 'AB+';
        else group = 'AB-';

        // Some units near expiration (FEFO triage demonstration)
        const daysRemaining = Math.max(1, Math.floor(Math.random() * maxDaysLeft) + 1);
        const expiryDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
        const collectionDate = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));

        let temp = 3.5;
        let vol = 300;
        let anticoagulant = 'CPDA-1';

        if (comp === 'PRBC') {
          temp = 3.2 + (Math.random() * 1.6);
          vol = 280 + Math.floor(Math.random() * 40);
        } else if (comp === 'PLATELETS') {
          temp = 21.8 + (Math.random() * 1.2);
          vol = 240 + Math.floor(Math.random() * 30);
          anticoagulant = 'ACD-A';
        } else if (comp === 'FFP') {
          temp = -22.5 + (Math.random() * 3);
          vol = 250 + Math.floor(Math.random() * 20);
        } else if (comp === 'CRYO') {
          temp = -24.0 + (Math.random() * 2);
          vol = 15 + Math.floor(Math.random() * 5);
        }

        const din = `=W123426${String(seq).padStart(5, '0')}00=`;

        units.push({
          id: `VS-U-${seq}`,
          din,
          bloodGroup: group,
          component: comp,
          volumeMl: vol,
          collectionDate: collectionDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          currentLocationNodeId: nodeId,
          status: 'available',
          tempC: Math.round(temp * 10) / 10,
          anticoagulant,
          isSyntheticMock: true,
        });
      }
    };

    addUnits('PRBC', counts.prbc, 35);
    addUnits('PLATELETS', counts.plat, 4); // platelets short shelf life
    addUnits('FFP', counts.ffp, 180);
    addUnits('CRYO', counts.cryo, 180);
  }

  return units;
}

export const INITIAL_SYNTHETIC_UNITS: BloodUnit[] = generateInitialUnits();
