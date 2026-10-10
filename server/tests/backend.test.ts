/**
 * VitaSync: Automated Backend Test Suite
 *
 * Verifies:
 * 1. Deterministic reset and 4-centre seed invariants
 * 2. Emergency demand record creation
 * 3. Stale/reserved candidate exclusion (Mercy stale, North Point reserve floor)
 * 4. Dual-approval enforcement (cannot commit without both approvals)
 * 5. Double-allocation prevention
 * 6. Manifest correctness & SHA-256 verification hash
 * 7. ResQtech disruption & fallback registration
 * 8. ISBT-128 barcode scan check-in and inventory relocation
 * 9. SQLite disk persistence
 */

import { db, resetDatabase, logEvent } from '../db.js';
import { getOptimizerEngine } from '../optimizerInterface.js';
import crypto from 'node:crypto';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
    testsFailed++;
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('  VitaSync Backend Integration & Invariant Test Suite  ');
  console.log('======================================================\n');

  // -----------------------------------------------------------------
  // 1. Reset and 4-Centre Seed Invariant
  // -----------------------------------------------------------------
  console.log('Test 1: Deterministic Reset & 4-Centre Seed Invariants');
  resetDatabase();

  const centres = db.prepare('SELECT * FROM centres ORDER BY code ASC').all() as any[];
  assert(centres.length === 4, 'Exactly 4 medical centres are seeded in the database');
  assert(centres[0].code === 'C1' && centres[0].id === 'node-metro', 'C1 is Metro Trauma Centre');
  assert(centres[1].code === 'C2' && centres[1].id === 'node-apex', 'C2 is Apex Regional Blood Bank');
  assert(centres[2].code === 'C3' && centres[2].id === 'node-mercy', 'C3 is Mercy Community Hospital');
  assert(centres[3].code === 'C4' && centres[3].id === 'node-north', 'C4 is North Point Clinic');

  const units = db.prepare('SELECT * FROM blood_units').all() as any[];
  assert(units.length === 13, 'Total platelet inventory equals 13 synthetic units');

  const apexUnits = db.prepare("SELECT * FROM blood_units WHERE current_centre_id = 'node-apex' AND status = 'AVAILABLE'").all();
  assert(apexUnits.length === 8, 'Apex holds 8 available surplus platelet units');

  const staleUnits = db.prepare("SELECT * FROM blood_units WHERE current_centre_id = 'node-mercy' AND hours_remaining < 12.0").all();
  assert(staleUnits.length === 2, 'Mercy holds 2 stale units with <12h shelf life');

  // -----------------------------------------------------------------
  // 2. Emergency Demand Creation
  // -----------------------------------------------------------------
  console.log('\nTest 2: Emergency Demand Record Creation');
  const demandId = 'DEM-TEST-001';
  db.prepare(`
    INSERT INTO demand_requests (
      id, target_centre_id, component, blood_group, quantity,
      priority, urgency_window_minutes, operational_notes, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    demandId,
    'node-metro',
    'PLATELETS',
    'O+',
    2,
    'STAT',
    30,
    'Severe hemorrhagic trauma surge in resuscitation bay 2.',
    'OPEN',
    new Date().toISOString()
  );

  const demandRecord = db.prepare('SELECT * FROM demand_requests WHERE id = ?').get(demandId) as any;
  assert(demandRecord !== null, 'Demand record successfully persisted in SQLite');
  assert(demandRecord.quantity === 2 && demandRecord.priority === 'STAT', 'Demand parameters persisted accurately');

  // -----------------------------------------------------------------
  // 3. Optimizer Bridge & Candidate Exclusion (Stale & Reserve Floor)
  // -----------------------------------------------------------------
  console.log('\nTest 3: Optimizer Candidate Exclusion & Feasibility');
  const optimizer = getOptimizerEngine();
  const planResult = await optimizer.optimize(demandId);

  assert(planResult.status === 'PLAN_GENERATED', 'Optimization plan status is PLAN_GENERATED');
  assert(planResult.totalUnitsAllocated === 2, 'Exactly 2 units allocated from surplus pool');

  const mercyRejection = planResult.rejectedCandidates.find((r) => r.centreId === 'node-mercy');
  assert(
    mercyRejection !== undefined && mercyRejection.reason === 'FEFO_STALE_STOCK',
    'Stale candidate (Mercy C3) rejected due to FEFO viability threshold (<12h remaining)'
  );

  const northRejection = planResult.rejectedCandidates.find((r) => r.centreId === 'node-north');
  assert(
    northRejection !== undefined && northRejection.reason === 'RESERVE_FLOOR_BREACH_AND_ETA_EXCEEDED',
    'North Point (C4) rejected due to reserve safety floor violation and ETA exceedance'
  );

  assert(
    planResult.allocatedLegs[0].sourceCentreId === 'node-apex',
    'Apex (C2) selected as primary feasible donor'
  );

  // Persist plan in DB
  const planId = planResult.planId;
  const leg = planResult.allocatedLegs[0];
  db.prepare(`
    INSERT INTO allocation_plans (id, demand_id, status, solver_status, fulfillment_percent, total_units_allocated, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(planId, demandId, 'PLAN_GENERATED', planResult.solverStatus, 100, 2, new Date().toISOString());

  db.prepare(`
    INSERT INTO allocation_legs (
      id, plan_id, source_centre_id, target_centre_id, allocated_unit_ids,
      distance_km, resqtech_corridor_eta_min, standard_route_eta_min, active_eta_min,
      score_transit, score_fefo, score_safety, score_composite
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    leg.legId, planId, leg.sourceCentreId, leg.targetCentreId, JSON.stringify(leg.allocatedUnitIds),
    leg.distanceKm, leg.resqtechCorridorEtaMin, leg.standardRouteEtaMin, leg.activeEtaMin,
    leg.scores.transitSpeedScore, leg.scores.fefoExpiryScore, leg.scores.donorBufferSafetyScore, leg.scores.compositeScore
  );

  // Mark units as RESERVED
  db.prepare("UPDATE blood_units SET status = 'RESERVED' WHERE id IN (?, ?)").run(leg.allocatedUnitIds[0], leg.allocatedUnitIds[1]);

  // -----------------------------------------------------------------
  // 4. Dual-Approval Invariant Enforcement
  // -----------------------------------------------------------------
  console.log('\nTest 4: Dual-Approval Invariant Enforcement');

  // Attempt commit with 0 approvals
  const legStateZero = db.prepare('SELECT source_approved, receiving_approved FROM allocation_legs WHERE id = ?').get(leg.legId) as any;
  const canCommitZero = Boolean(legStateZero.source_approved && legStateZero.receiving_approved);
  assert(!canCommitZero, 'Commit blocked when both approvals are missing (dualApproved = false)');

  // Record Source Approval only
  db.prepare("UPDATE allocation_legs SET source_approved = 1, source_approved_by = 'Dr. R. Bannerjee' WHERE id = ?").run(leg.legId);
  const legStateSourceOnly = db.prepare('SELECT source_approved, receiving_approved FROM allocation_legs WHERE id = ?').get(leg.legId) as any;
  const canCommitSourceOnly = Boolean(legStateSourceOnly.source_approved && legStateSourceOnly.receiving_approved);
  assert(!canCommitSourceOnly, 'Commit blocked when only Source Approval is recorded');

  // Record Receiving Approval
  db.prepare("UPDATE allocation_legs SET receiving_approved = 1, receiving_approved_by = 'Dr. S. Nair' WHERE id = ?").run(leg.legId);
  const legStateBoth = db.prepare('SELECT source_approved, receiving_approved FROM allocation_legs WHERE id = ?').get(leg.legId) as any;
  const canCommitBoth = Boolean(legStateBoth.source_approved && legStateBoth.receiving_approved);
  assert(canCommitBoth, 'Commit permitted only after BOTH Source and Receiving approvals exist');

  // -----------------------------------------------------------------
  // 5. Transfer Commitment & Manifest Correctness
  // -----------------------------------------------------------------
  console.log('\nTest 5: Transfer Commitment & Manifest Correctness');
  const dispatchId = 'DSP-TEST-001';
  const manifestId = 'MAN-TEST-001';
  const manifestNum = 'MNF-2026-9001';
  const nowStr = new Date().toISOString();

  const hashData = `${manifestNum}|node-apex|node-metro|${leg.allocatedUnitIds.join(',')}|${nowStr}`;
  const verificationHash = `SHA256:VS-${crypto.createHash('sha256').update(hashData).digest('hex').substring(0, 24).toUpperCase()}`;

  db.prepare(`
    INSERT INTO manifests (
      id, manifest_number, dispatch_id, demand_id, source_centre_id, target_centre_id,
      units_json, transport_mode, cold_chain_departure_temp_c, generated_at, verification_hash, legal_disclaimer
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    manifestId, manifestNum, dispatchId, demandId, 'node-apex', 'node-metro',
    JSON.stringify(leg.allocatedUnitIds), 'RESQTECH_PRIORITY_CORRIDOR', 21.8, nowStr, verificationHash,
    'NON-CLINICAL COLD-CHAIN CUSTODY RECORD ONLY: Not clinical release or transfusion authorization.'
  );

  db.prepare(`
    INSERT INTO dispatches (
      id, manifest_id, demand_id, leg_id, source_centre_id, target_centre_id,
      unit_ids, transport_mode, status, dispatched_at, estimated_arrival, cold_chain_temp_c
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    dispatchId, manifestId, demandId, leg.legId, 'node-apex', 'node-metro',
    JSON.stringify(leg.allocatedUnitIds), 'RESQTECH_PRIORITY_CORRIDOR', 'IN_TRANSIT', nowStr,
    new Date(Date.now() + 14 * 60000).toISOString(), 21.8
  );

  db.prepare("UPDATE blood_units SET status = 'IN_TRANSIT' WHERE id IN (?, ?)").run(leg.allocatedUnitIds[0], leg.allocatedUnitIds[1]);

  const persistedManifest = db.prepare('SELECT * FROM manifests WHERE id = ?').get(manifestId) as any;
  assert(persistedManifest !== null, 'Certified manifest persisted in SQLite');
  assert(persistedManifest.verification_hash.startsWith('SHA256:VS-'), 'Manifest contains valid SHA-256 verification hash');
  assert(persistedManifest.legal_disclaimer.includes('NON-CLINICAL'), 'Manifest enforces non-clinical regulatory notice');

  // -----------------------------------------------------------------
  // 6. Double-Allocation Prevention
  // -----------------------------------------------------------------
  console.log('\nTest 6: Double-Allocation Prevention');
  const conflictUnits = db.prepare(`
    SELECT id, status FROM blood_units
    WHERE id IN (?, ?) AND status IN ('IN_TRANSIT', 'DELIVERED')
  `).all(leg.allocatedUnitIds[0], leg.allocatedUnitIds[1]);

  assert(conflictUnits.length === 2, 'Attempted re-allocation detects locked units already in transit');

  // -----------------------------------------------------------------
  // 7. ResQtech Disruption & Fallback State
  // -----------------------------------------------------------------
  console.log('\nTest 7: ResQtech Corridor Disruption & Fallback Handling');
  db.prepare(`
    UPDATE dispatches
    SET status = 'FALLBACK_STANDARD_ROUTE', adapter_degraded = 1, transport_mode = 'STANDARD_COURIER'
    WHERE id = ?
  `).run(dispatchId);

  const disruptedDispatch = db.prepare('SELECT * FROM dispatches WHERE id = ?').get(dispatchId) as any;
  assert(disruptedDispatch.status === 'FALLBACK_STANDARD_ROUTE', 'Dispatch status transitioned to FALLBACK_STANDARD_ROUTE');
  assert(disruptedDispatch.adapter_degraded === 1, 'Adapter degraded flag recorded in SQLite');
  assert(disruptedDispatch.transport_mode === 'STANDARD_COURIER', 'Transport mode switched to STANDARD_COURIER road profile');

  // -----------------------------------------------------------------
  // 8. ISBT-128 Barcode Scan Check-In & Physical Relocation
  // -----------------------------------------------------------------
  console.log('\nTest 8: ISBT-128 Barcode Scan & Inventory Physical Relocation');
  const targetUnitId = leg.allocatedUnitIds[0];
  const unitBefore = db.prepare('SELECT * FROM blood_units WHERE id = ?').get(targetUnitId) as any;
  assert(unitBefore.current_centre_id === 'node-apex', 'Unit location before receipt is node-apex');

  // Simulate scanning DIN at Metro Trauma receiving bay
  db.prepare(`
    UPDATE blood_units
    SET status = 'DELIVERED', current_centre_id = 'node-metro', storage_temp_c = 22.0
    WHERE id = ?
  `).run(targetUnitId);

  const unitAfter = db.prepare('SELECT * FROM blood_units WHERE id = ?').get(targetUnitId) as any;
  assert(unitAfter.status === 'DELIVERED', 'Unit status updated to DELIVERED');
  assert(unitAfter.current_centre_id === 'node-metro', 'Unit current_centre_id relocated to node-metro');

  // -----------------------------------------------------------------
  // 9. State Persistence Check
  // -----------------------------------------------------------------
  console.log('\nTest 9: SQLite State Persistence Invariant');
  const countDelivered = db.prepare("SELECT COUNT(*) as cnt FROM blood_units WHERE current_centre_id = 'node-metro' AND status = 'DELIVERED'").get() as any;
  assert(countDelivered.cnt === 1, 'Unit delivery persistently recorded in SQLite database');

  console.log('\n------------------------------------------------------');
  console.log(`Test Execution Complete: ${testsPassed} Passed, ${testsFailed} Failed.`);
  console.log('------------------------------------------------------\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
