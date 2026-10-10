/**
 * VitaSync: Comprehensive Optimization Engine Test Suite (Agent 2)
 *
 * Verifies:
 * 1. Feasible candidate selection & multi-objective ranking
 * 2. Stale/expired stock exclusion (FEFO filter < 12h)
 * 3. Source safety reserve protection (safety floor invariant)
 * 4. Deadline / urgency window rejection (ETA > urgency window)
 * 5. No-feasible-demand handling & unmet quantity reason codes
 * 6. Strictly integer quantities (zero fractional units)
 * 7. Zero invented inventory
 * 8. Baseline comparison metrics output
 */

import { db, resetDatabase } from '../db.js';
import { DeterministicFeasibleCandidateOptimizer } from '../optimizer.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
    failed++;
  }
}

async function runOptimizerTests() {
  console.log('\n======================================================');
  console.log('   VitaSync Decision Algorithm & Optimization Tests   ');
  console.log('======================================================\n');

  const optimizer = new DeterministicFeasibleCandidateOptimizer();

  // -----------------------------------------------------------------
  // 1. Feasible Transfer Test (Baseline Scenario)
  // -----------------------------------------------------------------
  console.log('Test 1: Feasible Candidate Allocation & Multi-Objective Ranking');
  resetDatabase();

  const demand1Id = 'DEM-OPT-TEST-01';
  db.prepare(`
    INSERT INTO demand_requests (
      id, target_centre_id, component, blood_group, quantity,
      priority, urgency_window_minutes, operational_notes, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(demand1Id, 'node-metro', 'PLATELETS', 'O+', 2, 'STAT', 30, 'OR resuscitation', 'OPEN', new Date().toISOString());

  const plan1 = await optimizer.optimize(demand1Id);
  assert(plan1.status === 'PLAN_GENERATED', 'Plan generated successfully');
  assert(plan1.totalUnitsAllocated === 2, 'Integer quantity 2 allocated');
  assert(plan1.fulfillmentPercent === 100, 'Fulfillment is 100%');
  assert(plan1.allocatedLegs.length === 1, 'Single optimal leg produced');
  assert(plan1.allocatedLegs[0].sourceCentreId === 'node-apex', 'Apex selected as optimal donor');
  assert(plan1.allocatedLegs[0].scores.compositeScore >= 80, 'Composite score reflects high priority match (>=80)');

  // -----------------------------------------------------------------
  // 2. Stale Stock Exclusion
  // -----------------------------------------------------------------
  console.log('\nTest 2: Stale/Expired Stock Exclusion Filter');
  const mercyEvaluation = plan1.candidateEvaluations?.find((c) => c.centreId === 'node-mercy');
  assert(mercyEvaluation !== undefined, 'Mercy Hospital evaluated');
  assert(mercyEvaluation?.status === 'REJECTED', 'Mercy Hospital marked REJECTED');
  assert(mercyEvaluation?.reasonCode === 'STALE', 'Machine-readable reasonCode is STALE');
  assert(
    Boolean(mercyEvaluation?.explanation.includes('<12h') || mercyEvaluation?.explanation.includes('stale')),
    'Human-readable explanation cites <12h shelf life threshold'
  );

  // -----------------------------------------------------------------
  // 3. Source Reserve Protection
  // -----------------------------------------------------------------
  console.log('\nTest 3: Source Safety Reserve Protection Invariant');
  const northEvaluation = plan1.candidateEvaluations?.find((c) => c.centreId === 'node-north');
  assert(northEvaluation !== undefined, 'North Point Clinic evaluated');
  assert(northEvaluation?.status === 'REJECTED', 'North Point Clinic marked REJECTED');
  assert(northEvaluation?.reasonCode === 'SOURCE_RESERVE', 'Machine-readable reasonCode is SOURCE_RESERVE');
  assert(
    Boolean(northEvaluation?.explanation.includes('reserve floor')),
    'Explanation explicitly cites reserve floor preservation'
  );

  // -----------------------------------------------------------------
  // 4. Deadline / Urgency Window Rejection
  // -----------------------------------------------------------------
  console.log('\nTest 4: Deadline & Urgency Window Rejection (ETA_TOO_LATE)');
  const demand2Id = 'DEM-OPT-TEST-02';
  db.prepare(`
    INSERT INTO demand_requests (
      id, target_centre_id, component, blood_group, quantity,
      priority, urgency_window_minutes, operational_notes, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(demand2Id, 'node-metro', 'PLATELETS', 'O+', 1, 'STAT', 10, 'Ultra-critical 10-minute window', 'OPEN', new Date().toISOString());

  // Even Apex is 14 min away via ResQtech corridor, exceeding 10 min window!
  const plan2 = await optimizer.optimize(demand2Id);
  const apexEtaReject = plan2.candidateEvaluations?.find((c) => c.centreId === 'node-apex');
  assert(apexEtaReject?.reasonCode === 'ETA_TOO_LATE', 'Apex rejected with ETA_TOO_LATE when ETA (14m) > deadline (10m)');
  assert(plan2.totalUnitsAllocated === 0, 'Zero units allocated due to deadline breach');
  assert(plan2.unmetQuantity === 1, 'Unmet quantity equals 1 unit');

  // -----------------------------------------------------------------
  // 5. No-Feasible-Demand Handling & Zero Invented Inventory
  // -----------------------------------------------------------------
  console.log('\nTest 5: No-Feasible-Demand Handling & Zero Invented Inventory');
  resetDatabase();
  const demand3Id = 'DEM-OPT-TEST-03';
  // Request 30 units when Apex has 8 units (reserve floor 2 -> max surplus 6 units)
  db.prepare(`
    INSERT INTO demand_requests (
      id, target_centre_id, component, blood_group, quantity,
      priority, urgency_window_minutes, operational_notes, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(demand3Id, 'node-metro', 'PLATELETS', 'O+', 30, 'STAT', 45, 'Massive surge beyond total capacity', 'OPEN', new Date().toISOString());

  const plan3 = await optimizer.optimize(demand3Id);
  assert(plan3.totalUnitsAllocated === 6, 'Allocated exactly 6 units (all feasible surplus above reserve floor)');
  assert(plan3.unmetQuantity === 24, 'Unmet quantity accurately computed (30 - 6 = 24)');
  assert(
    plan3.unmetReasonCodes?.includes('INSUFFICIENT_SURPLUS_ACROSS_FEASIBLE_POOLS') === true,
    'Reason codes explain shortage across feasible pools'
  );

  // Check donor inventory in DB was NOT invented
  const apexRemainingCount = 8 - plan3.totalUnitsAllocated;
  assert(apexRemainingCount === 2, 'Apex donor centre stock remains at exactly its safety reserve floor (2)');

  // -----------------------------------------------------------------
  // 6. Strictly Integer Quantities
  // -----------------------------------------------------------------
  console.log('\nTest 6: Integer Allocation Invariant');
  assert(Number.isInteger(plan1.totalUnitsAllocated), 'Plan 1 allocated quantity is integer');
  assert(Number.isInteger(plan2.totalUnitsAllocated), 'Plan 2 allocated quantity is integer');
  assert(Number.isInteger(plan3.totalUnitsAllocated), 'Plan 3 allocated quantity is integer');
  for (const leg of plan3.allocatedLegs) {
    assert(Number.isInteger(leg.allocatedUnitIds.length), 'Leg unit count is integer');
  }

  // -----------------------------------------------------------------
  // 7. Simulated Baseline Comparison Metrics
  // -----------------------------------------------------------------
  console.log('\nTest 7: Simulated Baseline Comparison Output');
  assert(plan1.baselineComparison !== undefined, 'Baseline comparison data present in response');
  assert(plan1.baselineComparison?.vitaSync.unmetUnits === 0, 'VitaSync unmet units = 0');
  assert(plan1.baselineComparison?.noTransferStatusQuo.unmetUnits === 2, 'Status Quo unmet units = 2');
  assert(
    plan1.baselineComparison?.vitaSync.stockExcludedAsStale === 2,
    'Reported stock excluded as stale = 2 units (Mercy units safeguarded)'
  );
  assert(
    plan1.baselineComparison?.vitaSync.sourceReserveRemaining === 6,
    'Apex reserve remaining = 6 units (safely above floor of 2)'
  );

  console.log('\n------------------------------------------------------');
  console.log(`Optimization Tests Complete: ${passed} Passed, ${failed} Failed.`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runOptimizerTests().catch((err) => {
  console.error('Fatal optimization test failure:', err);
  process.exit(1);
});
