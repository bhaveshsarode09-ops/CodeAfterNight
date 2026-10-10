/**
 * VitaSync: SQLite Database Persistence Layer
 * Powered by Node.js v22 built-in native node:sqlite (DatabaseSync)
 *
 * Implements ACID persistence for the 4-centre deterministic demo.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'vitasync.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

// Enable foreign keys, WAL mode, and busy timeout to avoid concurrency lock errors
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

/**
 * Initialize all database tables according to docs/data-dictionary.md
 */
export function initializeSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS centres (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      city_zone TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      contact_officer TEXT NOT NULL,
      phone_extension TEXT NOT NULL,
      safety_reserve_floor INTEGER NOT NULL,
      current_platelet_stock INTEGER NOT NULL,
      status TEXT NOT NULL,
      demo_role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blood_units (
      id TEXT PRIMARY KEY,
      din TEXT UNIQUE NOT NULL,
      blood_group TEXT NOT NULL,
      component TEXT NOT NULL,
      volume_ml INTEGER NOT NULL,
      collected_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      hours_remaining REAL NOT NULL,
      current_centre_id TEXT NOT NULL REFERENCES centres(id),
      status TEXT NOT NULL,
      storage_temp_c REAL NOT NULL,
      agitation_active INTEGER NOT NULL DEFAULT 1,
      is_synthetic_mock INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS demand_requests (
      id TEXT PRIMARY KEY,
      target_centre_id TEXT NOT NULL REFERENCES centres(id),
      component TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      priority TEXT NOT NULL,
      urgency_window_minutes INTEGER NOT NULL,
      operational_notes TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS allocation_plans (
      id TEXT PRIMARY KEY,
      demand_id TEXT NOT NULL REFERENCES demand_requests(id),
      status TEXT NOT NULL,
      solver_status TEXT NOT NULL,
      fulfillment_percent INTEGER NOT NULL,
      total_units_allocated INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS allocation_legs (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES allocation_plans(id),
      source_centre_id TEXT NOT NULL REFERENCES centres(id),
      target_centre_id TEXT NOT NULL REFERENCES centres(id),
      allocated_unit_ids TEXT NOT NULL,
      distance_km REAL NOT NULL,
      resqtech_corridor_eta_min INTEGER NOT NULL,
      standard_route_eta_min INTEGER NOT NULL,
      active_eta_min INTEGER NOT NULL,
      score_transit INTEGER NOT NULL,
      score_fefo INTEGER NOT NULL,
      score_safety INTEGER NOT NULL,
      score_composite REAL NOT NULL,
      source_approved INTEGER NOT NULL DEFAULT 0,
      source_approved_by TEXT,
      source_approved_at TEXT,
      receiving_approved INTEGER NOT NULL DEFAULT 0,
      receiving_approved_by TEXT,
      receiving_approved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS dispatches (
      id TEXT PRIMARY KEY,
      manifest_id TEXT,
      demand_id TEXT NOT NULL,
      leg_id TEXT NOT NULL,
      source_centre_id TEXT NOT NULL,
      target_centre_id TEXT NOT NULL,
      unit_ids TEXT NOT NULL,
      transport_mode TEXT NOT NULL,
      status TEXT NOT NULL,
      adapter_degraded INTEGER NOT NULL DEFAULT 0,
      dispatched_at TEXT NOT NULL,
      estimated_arrival TEXT NOT NULL,
      actual_arrival TEXT,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      cold_chain_temp_c REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manifests (
      id TEXT PRIMARY KEY,
      manifest_number TEXT UNIQUE NOT NULL,
      dispatch_id TEXT NOT NULL,
      demand_id TEXT NOT NULL,
      source_centre_id TEXT NOT NULL,
      target_centre_id TEXT NOT NULL,
      units_json TEXT NOT NULL,
      transport_mode TEXT NOT NULL,
      cold_chain_departure_temp_c REAL NOT NULL,
      cold_chain_arrival_temp_c REAL,
      generated_at TEXT NOT NULL,
      verification_hash TEXT NOT NULL,
      legal_disclaimer TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      summary TEXT NOT NULL,
      payload_json TEXT
    );

    CREATE TABLE IF NOT EXISTS road_edges (
      id TEXT PRIMARY KEY,
      source_centre_id TEXT NOT NULL,
      target_centre_id TEXT NOT NULL,
      distance_km REAL NOT NULL,
      baseline_travel_time_min INTEGER NOT NULL,
      current_travel_time_min INTEGER NOT NULL,
      is_closed INTEGER NOT NULL DEFAULT 0,
      additional_delay_min INTEGER NOT NULL DEFAULT 0,
      corridor_eligible INTEGER NOT NULL DEFAULT 1,
      road_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS corridor_requests (
      id TEXT PRIMARY KEY,
      transfer_id TEXT NOT NULL,
      route_json TEXT NOT NULL,
      authorized_operator TEXT NOT NULL,
      status TEXT NOT NULL, -- NOT_REQUESTED, SIMULATED_REQUESTED, SIMULATED_APPROVED, SIMULATED_DENIED, SIMULATED_ACTIVE, SIMULATED_RELEASED
      requested_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      details TEXT
    );
  `);

  // Migrate demand_requests columns if they do not exist
  try {
    db.exec(`ALTER TABLE demand_requests ADD COLUMN batch_id TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE demand_requests ADD COLUMN urgency_tier TEXT DEFAULT 'STAT';`);
  } catch {}
  try {
    db.exec(`ALTER TABLE demand_requests ADD COLUMN required_by TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE demand_requests ADD COLUMN staff_entered_by TEXT DEFAULT 'Simulated Trauma Coordinator';`);
  } catch {}
  try {
    db.exec(`ALTER TABLE demand_requests ADD COLUMN priority_rank INTEGER DEFAULT 0;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE demand_requests ADD COLUMN rank_reason TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE demand_requests ADD COLUMN fulfilled_quantity INTEGER DEFAULT 0;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE demand_requests ADD COLUMN unmet_quantity INTEGER DEFAULT 0;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE demand_requests ADD COLUMN allocated_plan_id TEXT;`);
  } catch {}
}

/**
 * Seeds the deterministic initial state for the 4 fictional centres and platelet units.
 */
export function seedDeterministicDemoState(): void {
  // Clear existing records
  db.exec(`
    DELETE FROM event_logs;
    DELETE FROM manifests;
    DELETE FROM dispatches;
    DELETE FROM allocation_legs;
    DELETE FROM allocation_plans;
    DELETE FROM demand_requests;
    DELETE FROM blood_units;
    DELETE FROM centres;
    DELETE FROM road_edges;
    DELETE FROM corridor_requests;
  `);

  // 1. Seed 4 Fictional Medical Centres
  const insertCentre = db.prepare(`
    INSERT INTO centres (
      id, code, name, city_zone, lat, lng,
      contact_officer, phone_extension, safety_reserve_floor,
      current_platelet_stock, status, demo_role
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCentre.run(
    'node-metro',
    'C1',
    'Metro Trauma Centre (Level 1)',
    'Downtown Core',
    12.9352,
    77.6245,
    'Dr. S. Nair (Trauma Bay Director)',
    'Ext. 102',
    3,
    1,
    'CRITICAL_DEFICIT',
    'DEMAND_REQUESTER'
  );

  insertCentre.run(
    'node-apex',
    'C2',
    'Apex Regional Blood Center',
    'Central Logistics Hub',
    12.9716,
    77.5946,
    'Dr. R. Bannerjee (Logistics Officer)',
    'Ext. 401',
    2,
    8,
    'SURPLUS',
    'FEASIBLE_DONOR'
  );

  insertCentre.run(
    'node-mercy',
    'C3',
    'Mercy Community Hospital',
    'East Urban Zone',
    12.9821,
    77.6698,
    'K. Pillai (Blood Storage Tech)',
    'Ext. 315',
    2,
    2,
    'STALE_STOCK',
    'STALE_CANDIDATE_REJECTION'
  );

  insertCentre.run(
    'node-north',
    'C4',
    'North Point Clinic',
    'Northwest Ring Corridor',
    13.0450,
    77.5892,
    "E. D'Souza (Inventory Dispatch)",
    'Ext. 620',
    2,
    2,
    'AT_SAFETY_FLOOR',
    'RESERVE_ETA_REJECTION'
  );

  // 2. Seed Deterministic Blood Units (Platelets)
  const insertUnit = db.prepare(`
    INSERT INTO blood_units (
      id, din, blood_group, component, volume_ml,
      collected_at, expires_at, hours_remaining, current_centre_id,
      status, storage_temp_c, agitation_active, is_synthetic_mock
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date('2026-10-09T11:00:00Z');

  // C1 Unit (1 critical unit, reserved for local OR)
  insertUnit.run(
    'VS-U-METRO-01',
    '=W1234260000100=',
    'O+',
    'PLATELETS',
    240,
    new Date(now.getTime() - 48 * 3600 * 1000).toISOString(),
    new Date(now.getTime() + 48 * 3600 * 1000).toISOString(),
    48.0,
    'node-metro',
    'AVAILABLE',
    22.0,
    1,
    1
  );

  // C2 Units (8 fresh units, well above reserve floor of 2)
  for (let i = 1; i <= 8; i++) {
    const seq = String(100 + i).padStart(5, '0');
    const din = `=W123426${seq}00=`;
    const hoursLeft = 72.0 - i * 4; // Fresh units between 44 and 68 hours remaining
    insertUnit.run(
      `VS-U-${100 + i}`,
      din,
      i % 2 === 0 ? 'O+' : 'A+',
      'PLATELETS',
      250,
      new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
      new Date(now.getTime() + hoursLeft * 3600 * 1000).toISOString(),
      hoursLeft,
      'node-apex',
      'AVAILABLE',
      21.8,
      1,
      1
    );
  }

  // C3 Units (2 stale units: 1 expired, 1 with 1.5h remaining -> Stale candidate)
  insertUnit.run(
    'VS-U-301',
    '=W1234260030100=',
    'O+',
    'PLATELETS',
    230,
    new Date(now.getTime() - 120 * 3600 * 1000).toISOString(),
    new Date(now.getTime() - 2 * 3600 * 1000).toISOString(), // already expired!
    -2.0,
    'node-mercy',
    'AVAILABLE',
    22.4,
    1,
    1
  );

  insertUnit.run(
    'VS-U-302',
    '=W1234260030200=',
    'B+',
    'PLATELETS',
    245,
    new Date(now.getTime() - 118 * 3600 * 1000).toISOString(),
    new Date(now.getTime() + 1.5 * 3600 * 1000).toISOString(), // only 1.5h left!
    1.5,
    'node-mercy',
    'AVAILABLE',
    22.1,
    1,
    1
  );

  // C4 Units (2 units; exactly at safety reserve floor of 2 -> Cannot transfer without breach)
  insertUnit.run(
    'VS-U-401',
    '=W1234260040100=',
    'O+',
    'PLATELETS',
    250,
    new Date(now.getTime() - 36 * 3600 * 1000).toISOString(),
    new Date(now.getTime() + 60 * 3600 * 1000).toISOString(),
    60.0,
    'node-north',
    'AVAILABLE',
    21.9,
    1,
    1
  );

  insertUnit.run(
    'VS-U-402',
    '=W1234260040200=',
    'A+',
    'PLATELETS',
    250,
    new Date(now.getTime() - 36 * 3600 * 1000).toISOString(),
    new Date(now.getTime() + 60 * 3600 * 1000).toISOString(),
    60.0,
    'node-north',
    'AVAILABLE',
    21.7,
    1,
    1
  );

  // 3. Seed Deterministic Road Network Edges
  const insertEdge = db.prepare(`
    INSERT INTO road_edges (
      id, source_centre_id, target_centre_id, distance_km,
      baseline_travel_time_min, current_travel_time_min,
      is_closed, additional_delay_min, corridor_eligible, road_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const edges = [
    // Apex (C2) <-> Metro (C1)
    { id: 'edge-c2-c1', s: 'node-apex', t: 'node-metro', d: 8.4, t0: 22, name: 'MG Road Central Arterial' },
    { id: 'edge-c1-c2', s: 'node-metro', t: 'node-apex', d: 8.4, t0: 22, name: 'MG Road Central Arterial' },
    // Apex (C2) <-> Mercy (C3)
    { id: 'edge-c2-c3', s: 'node-apex', t: 'node-mercy', d: 7.2, t0: 19, name: 'Old Airport Corridor' },
    { id: 'edge-c3-c2', s: 'node-mercy', t: 'node-apex', d: 7.2, t0: 19, name: 'Old Airport Corridor' },
    // Metro (C1) <-> Mercy (C3)
    { id: 'edge-c1-c3', s: 'node-metro', t: 'node-mercy', d: 6.8, t0: 18, name: 'Indiranagar Cross Link' },
    { id: 'edge-c3-c1', s: 'node-mercy', t: 'node-metro', d: 6.8, t0: 18, name: 'Indiranagar Cross Link' },
    // Apex (C2) <-> North (C4)
    { id: 'edge-c2-c4', s: 'node-apex', t: 'node-north', d: 11.5, t0: 28, name: 'Bellary Expressway Ring' },
    { id: 'edge-c4-c2', s: 'node-north', t: 'node-apex', d: 11.5, t0: 28, name: 'Bellary Expressway Ring' },
    // Metro (C1) <-> North (C4)
    { id: 'edge-c1-c4', s: 'node-metro', t: 'node-north', d: 14.2, t0: 34, name: 'Outer Ring Bypass' },
    { id: 'edge-c4-c1', s: 'node-north', t: 'node-metro', d: 14.2, t0: 34, name: 'Outer Ring Bypass' },
    // Mercy (C3) <-> North (C4)
    { id: 'edge-c3-c4', s: 'node-mercy', t: 'node-north', d: 13.8, t0: 32, name: 'East-North Sector Highway' },
    { id: 'edge-c4-c3', s: 'node-north', t: 'node-mercy', d: 13.8, t0: 32, name: 'East-North Sector Highway' },
  ];

  for (const e of edges) {
    insertEdge.run(e.id, e.s, e.t, e.d, e.t0, e.t0, 0, 0, 1, e.name);
  }

  // Initial event log
  logEvent(
    'SYSTEM_RESET',
    'System Initializer',
    'Deterministic 4-centre platelet demo state seeded successfully with road network graph.',
    { centres: 4, units: 13, edges: edges.length, timestamp: now.toISOString() }
  );
}

// Active SSE client response handles
const sseClients: Set<(data: string) => void> = new Set();

export function registerSseClient(callback: (data: string) => void): () => void {
  sseClients.add(callback);
  return () => {
    sseClients.delete(callback);
  };
}

/**
 * Inserts an event into event_logs and broadcasts to active SSE subscribers.
 */
let eventCounter = 0;

export function logEvent(
  eventType: string,
  actor: string,
  summary: string,
  payload?: any
): void {
  eventCounter++;
  const eventId = `EVT-${Date.now()}-${eventCounter}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  const payloadStr = payload ? JSON.stringify(payload) : null;

  const insert = db.prepare(`
    INSERT INTO event_logs (id, timestamp, event_type, actor, summary, payload_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insert.run(eventId, timestamp, eventType, actor, summary, payloadStr);

  const eventPayload = {
    id: eventId,
    timestamp,
    type: eventType,
    actor,
    summary,
    payload,
  };

  const sseMessage = JSON.stringify(eventPayload);
  sseClients.forEach((send) => {
    try {
      send(sseMessage);
    } catch {
      // Ignore broken subscriber
    }
  });
}

/**
 * Resets the database to pristine seed state.
 */
export function resetDatabase(): void {
  initializeSchema();
  seedDeterministicDemoState();
}

// Auto-initialize schema and check if centres exist on load
initializeSchema();
const existingCentresCount = db.prepare('SELECT COUNT(*) as count FROM centres').get() as { count: number };
if (!existingCentresCount || existingCentresCount.count === 0) {
  seedDeterministicDemoState();
}
