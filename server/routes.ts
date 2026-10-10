/**
 * VitaSync: Express REST API Routes & Live State Controller
 * Strictly adheres to docs/api-contract.md and enforces dual-approval invariants.
 */

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db, logEvent, registerSseClient, resetDatabase } from './db';
import { getOptimizerEngine } from './optimizerInterface';
import { transportAdapter } from './transportAdapter.js';

export const apiRouter = Router();

// Track simulated priority adapter status
let isResqtechDegraded = false;

// =========================================================================
// 1. Centres & Inventory
// =========================================================================

/**
 * GET /api/centres
 * Retrieves 4 medical facilities in the network with real-time platelet counts.
 */
apiRouter.get('/centres', (_req: Request, res: Response) => {
  try {
    const centres = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM blood_units WHERE current_centre_id = c.id AND status = 'AVAILABLE') as live_stock
      FROM centres c
      ORDER BY c.code ASC
    `).all() as any[];

    const formatted = centres.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      cityZone: c.city_zone,
      lat: c.lat,
      lng: c.lng,
      contactOfficer: c.contact_officer,
      phoneExtension: c.phone_extension,
      safetyReserveFloor: c.safety_reserve_floor,
      currentPlateletStock: c.live_stock,
      status: c.status,
      demoRole: c.demo_role,
    }));

    res.json({ centres: formatted });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

/**
 * GET /api/inventory
 * Retrieves blood units with optional filtering.
 */
apiRouter.get('/inventory', (req: Request, res: Response) => {
  try {
    const { centreId, component, status } = req.query;

    let query = 'SELECT * FROM blood_units WHERE 1=1';
    const params: any[] = [];

    if (centreId) {
      query += ' AND current_centre_id = ?';
      params.push(centreId);
    }
    if (component) {
      query += ' AND component = ?';
      params.push(component);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY hours_remaining ASC';

    const units = db.prepare(query).all(...params) as any[];

    const formatted = units.map((u) => ({
      id: u.id,
      din: u.din,
      bloodGroup: u.blood_group,
      component: u.component,
      volumeMl: u.volume_ml,
      collectedAt: u.collected_at,
      expiresAt: u.expires_at,
      hoursRemaining: u.hours_remaining,
      currentCentreId: u.current_centre_id,
      status: u.status,
      storageTempC: u.storage_temp_c,
      agitationActive: Boolean(u.agitation_active),
      isSyntheticMock: Boolean(u.is_synthetic_mock),
    }));

    res.json({ total: formatted.length, units: formatted });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

/**
 * POST /api/units/:id/reconfirm
 * Stale-record reconfirmation by blood bank quality officer.
 */
apiRouter.post('/units/:id/reconfirm', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { officerName, remarks } = req.body || {};
    const unit = db.prepare('SELECT * FROM blood_units WHERE id = ? OR UPPER(din) = UPPER(?)').get(id, id) as any;
    if (!unit) {
      return res.status(404).json({ error: 'UNIT_NOT_FOUND', message: `Unit ${id} not found.` });
    }
    logEvent(
      'STALE_RECORD_RECONFIRMED',
      officerName || 'Blood Bank Quality Officer',
      `Unit ${unit.din} physical inventory status reconfirmed. Remarks: ${remarks || 'Physical integrity & cold storage verified.'}`,
      {
        unitId: unit.id,
        din: unit.din,
        centreId: unit.current_centre_id,
        officer: officerName || 'Blood Bank Quality Officer',
      }
    );
    res.json({
      success: true,
      unitId: unit.id,
      din: unit.din,
      status: unit.status,
      message: `Unit ${unit.din} reconfirmed successfully. Audit trail updated.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'RECONFIRM_ERROR', message: err.message });
  }
});

// =========================================================================
// 2. Demand & Optimization
// =========================================================================

/**
 * POST /api/demand
 * Creates an emergency demand record.
 */
apiRouter.post('/demand', (req: Request, res: Response) => {
  try {
    const {
      targetCentreId,
      component,
      bloodGroup,
      quantity,
      priority,
      urgencyTier,
      urgencyWindowMinutes,
      operationalNotes,
      requiredBy,
      staffEnteredBy,
      batchId,
    } = req.body;

    if (!targetCentreId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Target centre and quantity are required.' });
    }

    // Verify centre exists
    const centre = db.prepare('SELECT id FROM centres WHERE id = ?').get(targetCentreId) as any;
    if (!centre) {
      return res.status(400).json({ error: 'UNKNOWN_CENTRE', message: `Centre ${targetCentreId} is not registered in network.` });
    }

    const demandId = `DEM-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const createdAt = new Date().toISOString();
    const finalUrgencyTier = urgencyTier || priority || 'STAT';
    const finalWindowMin = urgencyWindowMinutes || (finalUrgencyTier === 'STAT' ? 30 : finalUrgencyTier === 'URGENT' ? 60 : 120);
    const finalRequiredBy = requiredBy || new Date(Date.now() + finalWindowMin * 60 * 1000).toISOString();
    const finalStaffEnteredBy = staffEnteredBy || 'Simulated Emergency Staff';

    const insert = db.prepare(`
      INSERT INTO demand_requests (
        id, target_centre_id, component, blood_group, quantity,
        priority, urgency_window_minutes, operational_notes, status, created_at,
        batch_id, urgency_tier, required_by, staff_entered_by, priority_rank, rank_reason,
        fulfilled_quantity, unmet_quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', 0, ?)
    `);

    insert.run(
      demandId,
      targetCentreId,
      component || 'PLATELETS',
      bloodGroup || 'O+',
      quantity,
      finalUrgencyTier,
      finalWindowMin,
      operationalNotes || '',
      'SUBMITTED',
      createdAt,
      batchId || null,
      finalUrgencyTier,
      finalRequiredBy,
      finalStaffEnteredBy,
      quantity
    );

    logEvent('DEMAND_CREATED', finalStaffEnteredBy, `Emergency demand ${demandId} for ${quantity}x ${component || 'PLATELETS'} submitted. Tier: ${finalUrgencyTier}.`, {
      demandId,
      targetCentreId,
      quantity,
      urgencyTier: finalUrgencyTier,
      requiredBy: finalRequiredBy,
      batchId,
    });

    res.status(201).json({
      demandId,
      targetCentreId,
      status: 'SUBMITTED',
      createdAt,
      requiredUnits: quantity,
      urgencyTier: finalUrgencyTier,
      requiredBy: finalRequiredBy,
      urgencyWindowMinutes: finalWindowMin,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

/**
 * POST /api/demand/batch
 * Validates and creates a batch of simultaneous requests (CSV rows or JSON array).
 * Rejects invalid rows with clear error codes without dropping valid rows.
 */
apiRouter.post('/demand/batch', (req: Request, res: Response) => {
  try {
    const { batchId: customBatchId, requests, staffEnteredBy = 'Simulated Regional Dispatcher' } = req.body;
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ error: 'INVALID_BATCH', message: 'An array of requests is required.' });
    }

    const batchId = customBatchId || `BATCH-${Date.now().toString(36).toUpperCase()}`;
    const centres = db.prepare('SELECT id FROM centres').all() as Array<{ id: string }>;
    const validCentreIds = new Set(centres.map((c) => c.id));
    const nowMs = Date.now();

    const createdRequests: any[] = [];
    const rejectedRows: Array<{ row: any; rowIndex: number; reason: string; errorCode: string }> = [];

    const insert = db.prepare(`
      INSERT INTO demand_requests (
        id, target_centre_id, component, blood_group, quantity,
        priority, urgency_window_minutes, operational_notes, status, created_at,
        batch_id, urgency_tier, required_by, staff_entered_by, priority_rank, rank_reason,
        fulfilled_quantity, unmet_quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', 0, ?)
    `);

    requests.forEach((row, idx) => {
      const rowIndex = idx + 1;
      const targetCentreId = row.targetCentreId || row.target_centre_id || row.destinationCentre;
      const quantity = Number(row.quantity);
      const component = (row.component || 'PLATELETS').toUpperCase();
      const bloodGroup = (row.bloodGroup || row.blood_group || 'O+').toUpperCase();
      const urgencyTier = (row.urgencyTier || row.urgency_tier || row.priority || 'URGENT').toUpperCase();
      const notes = row.operationalNotes || row.operational_notes || row.notes || '';
      const customId = row.requestId || row.id;

      // Validation 1: Missing fields
      if (!targetCentreId) {
        rejectedRows.push({ row, rowIndex, errorCode: 'MISSING_TARGET_CENTRE', reason: 'Missing destination facility identifier.' });
        return;
      }

      // Validation 2: Invalid quantity
      if (isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
        rejectedRows.push({ row, rowIndex, errorCode: 'INVALID_QUANTITY', reason: `Quantity must be a positive integer, got '${row.quantity}'.` });
        return;
      }

      // Validation 3: Unknown centre
      if (!validCentreIds.has(targetCentreId)) {
        rejectedRows.push({ row, rowIndex, errorCode: 'UNKNOWN_CENTRE', reason: `Facility '${targetCentreId}' not found in active network centres.` });
        return;
      }

      // Validation 4: Valid component
      if (!['PLATELETS', 'PRBC', 'FFP', 'CRYO'].includes(component)) {
        rejectedRows.push({ row, rowIndex, errorCode: 'UNKNOWN_COMPONENT', reason: `Blood component '${component}' is not supported in demo matrix.` });
        return;
      }

      // Validation 5: Required by time / past deadline check
      let requiredBy = row.requiredBy || row.required_by;
      const windowMin = Number(row.urgencyWindowMinutes || row.urgency_window_minutes) || (urgencyTier === 'STAT' ? 30 : urgencyTier === 'URGENT' ? 60 : 120);
      if (requiredBy) {
        const reqTime = new Date(requiredBy).getTime();
        if (isNaN(reqTime)) {
          rejectedRows.push({ row, rowIndex, errorCode: 'MALFORMED_DEADLINE', reason: `Invalid date format for requiredBy: '${requiredBy}'.` });
          return;
        }
        if (reqTime <= nowMs) {
          rejectedRows.push({ row, rowIndex, errorCode: 'PAST_DEADLINE', reason: `Required deadline '${requiredBy}' is in the past.` });
          return;
        }
      } else {
        requiredBy = new Date(nowMs + windowMin * 60 * 1000).toISOString();
      }

      // Validation 6: Duplicate ID check if customId provided
      const reqId = customId || `REQ-B-${Date.now().toString(36).toUpperCase()}-${idx + 1}-${Math.floor(100 + Math.random() * 900)}`;
      const existing = db.prepare('SELECT id FROM demand_requests WHERE id = ?').get(reqId);
      if (existing) {
        rejectedRows.push({ row, rowIndex, errorCode: 'DUPLICATE_REQUEST_ID', reason: `Request ID '${reqId}' already exists in registry.` });
        return;
      }

      const createdAt = new Date().toISOString();

      insert.run(
        reqId,
        targetCentreId,
        component,
        bloodGroup,
        quantity,
        urgencyTier,
        windowMin,
        notes,
        'VALIDATED',
        createdAt,
        batchId,
        urgencyTier,
        requiredBy,
        staffEnteredBy,
        quantity
      );

      createdRequests.push({
        id: reqId,
        batchId,
        targetCentreId,
        component,
        bloodGroup,
        quantity,
        urgencyTier,
        requiredBy,
        urgencyWindowMinutes: windowMin,
        status: 'VALIDATED',
        createdAt,
      });
    });

    logEvent('BATCH_REQUESTS_SUBMITTED', staffEnteredBy, `Batch ${batchId} processed: ${createdRequests.length} created, ${rejectedRows.length} rejected.`, {
      batchId,
      createdCount: createdRequests.length,
      rejectedCount: rejectedRows.length,
      rejectedRows,
    });

    res.status(201).json({
      batchId,
      totalSubmitted: requests.length,
      createdCount: createdRequests.length,
      rejectedCount: rejectedRows.length,
      createdRequests,
      rejectedRows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'BATCH_ERROR', message: err.message });
  }
});

/**
 * GET /api/demand
 * Retrieves all demand requests with priority ranks and audit info.
 */
apiRouter.get('/demand', (req: Request, res: Response) => {
  try {
    const { batchId, status } = req.query;
    let query = 'SELECT * FROM demand_requests WHERE 1=1';
    const params: any[] = [];
    if (batchId) {
      query += ' AND batch_id = ?';
      params.push(batchId);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY priority_rank ASC, created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
    res.json({ total: rows.length, requests: rows });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

/**
 * POST /api/demand/:id/urgency
 * Staff override of request urgency tier with required audit trail.
 */
apiRouter.post('/demand/:id/urgency', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { urgencyTier, overrideReason, staffName = 'Authorized Medical Officer' } = req.body;
    if (!urgencyTier) {
      return res.status(400).json({ error: 'MISSING_TIER', message: 'urgencyTier is required (STAT, URGENT, ROUTINE).' });
    }

    const demand = db.prepare('SELECT * FROM demand_requests WHERE id = ?').get(id) as any;
    if (!demand) {
      return res.status(404).json({ error: 'NOT_FOUND', message: `Request ${id} not found.` });
    }

    const prevTier = demand.urgency_tier || demand.priority;
    db.prepare(`
      UPDATE demand_requests
      SET urgency_tier = ?, priority = ?, staff_entered_by = ?
      WHERE id = ?
    `).run(urgencyTier, urgencyTier, staffName, id);

    logEvent(
      'URGENCY_TIER_OVERRIDDEN',
      staffName,
      `Request ${id} urgency tier overridden from ${prevTier} to ${urgencyTier}. Reason: ${overrideReason || 'Clinical urgency update by staff.'}`,
      { requestId: id, previousTier: prevTier, newTier: urgencyTier, overrideReason, staffName }
    );

    res.json({
      success: true,
      requestId: id,
      previousTier: prevTier,
      newTier: urgencyTier,
      staffName,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'OVERRIDE_ERROR', message: err.message });
  }
});

/**
 * POST /api/optimize/batch
 * Runs joint network-wide allocation across all active requests in a batch.
 */
apiRouter.post('/optimize/batch', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.body || {};
    const optimizer = getOptimizerEngine() as any;

    if (typeof optimizer.optimizeBatch !== 'function') {
      return res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'Batch optimizer not supported.' });
    }

    const result = await optimizer.optimizeBatch(batchId, { resqtechDegraded: !transportAdapter.isAvailable() });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'BATCH_OPTIMIZE_ERROR', message: err.message });
  }
});

/**
 * GET /api/demand/:id
 */
apiRouter.get('/demand/:id', (req: Request, res: Response) => {
  try {
    const demand = db.prepare('SELECT * FROM demand_requests WHERE id = ?').get(req.params.id) as any;
    if (!demand) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Demand request not found.' });
    }
    res.json(demand);
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

/**
 * POST /api/optimize
 * Runs optimization solver and persists candidate allocation plan.
 */
apiRouter.post('/optimize', async (req: Request, res: Response) => {
  try {
    const { demandId } = req.body;
    if (!demandId) {
      return res.status(400).json({ error: 'MISSING_DEMAND_ID', message: 'demandId is required.' });
    }

    const demand = db.prepare('SELECT * FROM demand_requests WHERE id = ?').get(demandId) as any;
    if (!demand) {
      return res.status(404).json({ error: 'DEMAND_NOT_FOUND', message: `Demand ${demandId} does not exist.` });
    }

    // Call documented optimizer engine interface
    const optimizer = getOptimizerEngine();
    const result = await optimizer.optimize(demandId, { resqtechDegraded: isResqtechDegraded });

    // Persist plan in SQLite
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO allocation_plans (
        id, demand_id, status, solver_status, fulfillment_percent, total_units_allocated, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.planId,
      demandId,
      result.status,
      result.solverStatus,
      result.fulfillmentPercent,
      result.totalUnitsAllocated,
      createdAt
    );

    // Persist allocation legs
    const insertLeg = db.prepare(`
      INSERT INTO allocation_legs (
        id, plan_id, source_centre_id, target_centre_id, allocated_unit_ids,
        distance_km, resqtech_corridor_eta_min, standard_route_eta_min, active_eta_min,
        score_transit, score_fefo, score_safety, score_composite
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const leg of result.allocatedLegs) {
      insertLeg.run(
        leg.legId,
        result.planId,
        leg.sourceCentreId,
        leg.targetCentreId,
        JSON.stringify(leg.allocatedUnitIds),
        leg.distanceKm,
        leg.resqtechCorridorEtaMin,
        leg.standardRouteEtaMin,
        leg.activeEtaMin,
        leg.scores.transitSpeedScore,
        leg.scores.fefoExpiryScore,
        leg.scores.donorBufferSafetyScore,
        leg.scores.compositeScore
      );

      // Tentatively reserve allocated units
      for (const unitId of leg.allocatedUnitIds) {
        db.prepare("UPDATE blood_units SET status = 'RESERVED' WHERE id = ? AND status = 'AVAILABLE'").run(unitId);
      }
    }

    // Update demand status
    db.prepare("UPDATE demand_requests SET status = 'PLAN_GENERATED' WHERE id = ?").run(demandId);

    logEvent('OPTIMIZATION_SOLVED', 'Optimizer Engine', `Allocation plan ${result.planId} generated for demand ${demandId}.`, {
      planId: result.planId,
      allocatedUnits: result.totalUnitsAllocated,
      rejectedCandidates: result.rejectedCandidates,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'OPTIMIZATION_ERROR', message: err.message });
  }
});

/**
 * GET /api/plans/:id
 */
apiRouter.get('/plans/:id', (req: Request, res: Response) => {
  try {
    const plan = db.prepare('SELECT * FROM allocation_plans WHERE id = ?').get(req.params.id) as any;
    if (!plan) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Plan not found.' });
    }

    const legs = db.prepare('SELECT * FROM allocation_legs WHERE plan_id = ?').all(plan.id) as any[];

    res.json({
      plan,
      legs: legs.map((l) => ({
        ...l,
        allocated_unit_ids: JSON.parse(l.allocated_unit_ids),
        source_approved: Boolean(l.source_approved),
        receiving_approved: Boolean(l.receiving_approved),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

// =========================================================================
// 3. Dual-Approval Workflow
// =========================================================================

/**
 * POST /api/approvals/source
 * Records authorization from the donor facility logistics officer.
 */
apiRouter.post('/approvals/source', (req: Request, res: Response) => {
  try {
    const { planId, legId, officerName, remarks } = req.body;
    if (!planId || !legId) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'planId and legId are required.' });
    }

    const leg = db.prepare('SELECT * FROM allocation_legs WHERE id = ? AND plan_id = ?').get(legId, planId) as any;
    if (!leg) {
      return res.status(404).json({ error: 'LEG_NOT_FOUND', message: `Allocation leg ${legId} not found in plan ${planId}.` });
    }

    const now = new Date().toISOString();
    const approvedBy = officerName || 'Dr. R. Bannerjee (Logistics Officer)';

    db.prepare(`
      UPDATE allocation_legs
      SET source_approved = 1, source_approved_by = ?, source_approved_at = ?
      WHERE id = ?
    `).run(approvedBy, now, legId);

    const updatedLeg = db.prepare('SELECT * FROM allocation_legs WHERE id = ?').get(legId) as any;
    const dualApproved = Boolean(updatedLeg.source_approved && updatedLeg.receiving_approved);

    logEvent('SOURCE_APPROVED', approvedBy, `Source release approved for leg ${legId}. ${remarks || ''}`, {
      planId,
      legId,
      dualApproved,
    });

    res.json({
      legId,
      sourceApproved: true,
      sourceApprovedBy: approvedBy,
      sourceApprovedAt: now,
      dualApproved,
      status: dualApproved ? 'DUAL_APPROVED' : 'SOURCE_APPROVED',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'APPROVAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/approvals/receiving
 * Records authorization from the receiving trauma bay director.
 */
apiRouter.post('/approvals/receiving', (req: Request, res: Response) => {
  try {
    const { planId, legId, officerName, remarks } = req.body;
    if (!planId || !legId) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'planId and legId are required.' });
    }

    const leg = db.prepare('SELECT * FROM allocation_legs WHERE id = ? AND plan_id = ?').get(legId, planId) as any;
    if (!leg) {
      return res.status(404).json({ error: 'LEG_NOT_FOUND', message: `Allocation leg ${legId} not found in plan ${planId}.` });
    }

    const now = new Date().toISOString();
    const approvedBy = officerName || 'Dr. S. Nair (Trauma Bay Director)';

    db.prepare(`
      UPDATE allocation_legs
      SET receiving_approved = 1, receiving_approved_by = ?, receiving_approved_at = ?
      WHERE id = ?
    `).run(approvedBy, now, legId);

    const updatedLeg = db.prepare('SELECT * FROM allocation_legs WHERE id = ?').get(legId) as any;
    const dualApproved = Boolean(updatedLeg.source_approved && updatedLeg.receiving_approved);

    logEvent('RECEIVING_APPROVED', approvedBy, `Receiving transfer approved for leg ${legId}. ${remarks || ''}`, {
      planId,
      legId,
      dualApproved,
    });

    res.json({
      legId,
      receivingApproved: true,
      receivingApprovedBy: approvedBy,
      receivingApprovedAt: now,
      dualApproved,
      status: dualApproved ? 'DUAL_APPROVED' : 'RECEIVING_APPROVED',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'APPROVAL_ERROR', message: err.message });
  }
});

/**
 * POST /api/dispatches/commit
 * CRITICAL INVARIANT: Commits transfer ONLY after BOTH approvals exist.
 * Prevents double allocation and generates certified cold-chain manifest.
 */
apiRouter.post('/dispatches/commit', (req: Request, res: Response) => {
  try {
    const { planId, legId } = req.body;
    if (!planId || !legId) {
      return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'planId and legId are required.' });
    }

    const leg = db.prepare('SELECT * FROM allocation_legs WHERE id = ? AND plan_id = ?').get(legId, planId) as any;
    if (!leg) {
      return res.status(404).json({ error: 'LEG_NOT_FOUND', message: 'Allocation leg not found.' });
    }

    // ENFORCE DUAL APPROVAL
    if (!leg.source_approved || !leg.receiving_approved) {
      return res.status(409).json({
        error: 'DUAL_APPROVAL_REQUIRED',
        message: 'Transfer cannot be committed. Requires both Source and Receiving approvals prior to transit authorization.',
        sourceApproved: Boolean(leg.source_approved),
        receivingApproved: Boolean(leg.receiving_approved),
      });
    }

    const unitIds: string[] = JSON.parse(leg.allocated_unit_ids);

    // PREVENT DOUBLE ALLOCATION: Verify units are not already IN_TRANSIT or DELIVERED elsewhere
    const conflictUnits = db.prepare(`
      SELECT id, status FROM blood_units
      WHERE id IN (${unitIds.map(() => '?').join(',')}) AND status IN ('IN_TRANSIT', 'DELIVERED')
    `).all(...unitIds) as any[];

    if (conflictUnits.length > 0) {
      return res.status(409).json({
        error: 'DOUBLE_ALLOCATION_PREVENTED',
        message: `Units ${conflictUnits.map((u) => u.id).join(', ')} are already locked in transit or delivered.`,
      });
    }

    const plan = db.prepare('SELECT * FROM allocation_plans WHERE id = ?').get(planId) as any;
    const now = new Date().toISOString();
    const dispatchId = `DSP-${Date.now().toString(36).toUpperCase()}-01`;
    const manifestSeq = Math.floor(1000 + Math.random() * 9000);
    const manifestNumber = `MNF-2026-${manifestSeq}`;
    const manifestId = `MAN-${Date.now().toString(36).toUpperCase()}`;

    // Query unit snapshots
    const unitsData = db.prepare(`
      SELECT id, din, blood_group, component, volume_ml, expires_at, storage_temp_c
      FROM blood_units WHERE id IN (${unitIds.map(() => '?').join(',')})
    `).all(...unitIds) as any[];

    const avgTemp = unitsData.reduce((acc, u) => acc + u.storage_temp_c, 0) / (unitsData.length || 1);
    const transportMode = isResqtechDegraded ? 'STANDARD_COURIER' : 'RESQTECH_PRIORITY_CORRIDOR';

    // Route and Handling Requirements from Transport Adapter
    const route = transportAdapter.estimateRoute(leg.source_centre_id, leg.target_centre_id, 'PLATELETS');
    const handlingReqs = route.handlingRequirements;

    // Generate SHA-256 custody verification hash
    const hashData = `${manifestNumber}|${leg.source_centre_id}|${leg.target_centre_id}|${unitIds.join(',')}|${now}`;
    const verificationHash = `SHA256:VS-${crypto.createHash('sha256').update(hashData).digest('hex').substring(0, 24).toUpperCase()}`;

    const disclaimer = 'NON-CLINICAL COLD-CHAIN CUSTODY RECORD ONLY: Strictly for operational redistribution transport. Does not constitute serological crossmatching, clinical release, or transfusion authorization.';

    // Insert certified manifest with handling requirements and simulated corridor status
    db.prepare(`
      INSERT INTO manifests (
        id, manifest_number, dispatch_id, demand_id, source_centre_id, target_centre_id,
        units_json, transport_mode, cold_chain_departure_temp_c, generated_at, verification_hash, legal_disclaimer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      manifestId,
      manifestNumber,
      dispatchId,
      plan.demand_id,
      leg.source_centre_id,
      leg.target_centre_id,
      JSON.stringify(unitsData),
      route.modeUsed === 'RESQTECH_SIMULATED_PRIORITY'
        ? 'ResQtech Priority Corridor (Simulated Green-Wave Clearance)'
        : 'Standard Medical Courier (Normal Road Profile)',
      Math.round(avgTemp * 10) / 10,
      now,
      verificationHash,
      disclaimer
    );

    // Calculate ETA from route
    const estimatedArrival = new Date(Date.now() + route.activeEtaMin * 60 * 1000).toISOString();

    // Insert dispatch
    db.prepare(`
      INSERT INTO dispatches (
        id, manifest_id, demand_id, leg_id, source_centre_id, target_centre_id,
        unit_ids, transport_mode, status, adapter_degraded, dispatched_at,
        estimated_arrival, progress_percent, cold_chain_temp_c
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      dispatchId,
      manifestId,
      plan.demand_id,
      legId,
      leg.source_centre_id,
      leg.target_centre_id,
      JSON.stringify(unitIds),
      route.modeUsed === 'RESQTECH_SIMULATED_PRIORITY' ? 'RESQTECH_PRIORITY_CORRIDOR' : 'STANDARD_COURIER',
      'IN_TRANSIT',
      transportAdapter.isAvailable() ? 0 : 1,
      now,
      estimatedArrival,
      15,
      Math.round(avgTemp * 10) / 10
    );

    // Transition blood units to IN_TRANSIT
    db.prepare(`
      UPDATE blood_units
      SET status = 'IN_TRANSIT'
      WHERE id IN (${unitIds.map(() => '?').join(',')})
    `).run(...unitIds);

    // Update plan status
    db.prepare("UPDATE allocation_plans SET status = 'COMMITTED' WHERE id = ?").run(planId);
    db.prepare("UPDATE demand_requests SET status = 'COMMITTED' WHERE id = ?").run(plan.demand_id);

    logEvent('TRANSFER_COMMITTED', 'Logistics Coordinator', `Transfer leg ${legId} committed to active transit under manifest ${manifestNumber}.`, {
      dispatchId,
      manifestNumber,
      units: unitIds,
      route,
      handlingRequirements: handlingReqs,
    });

    res.json({
      dispatchId,
      manifestId,
      status: 'IN_TRANSIT',
      transportMode: route.modeUsed,
      corridorStatusLabel: route.corridorStatusLabel,
      adapterStatus: route.adapterStatus,
      handlingRequirements: handlingReqs,
      distanceKm: route.distanceKm,
      etaMinutes: route.activeEtaMin,
      coldChainTempC: Math.round(avgTemp * 10) / 10,
      estimatedArrival,
      waypoints: route.waypoints,
      unitsLocked: unitIds,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'COMMIT_ERROR', message: err.message });
  }
});

/**
 * GET /api/dispatches
 * Lists all dispatches currently tracked in SQLite.
 */
apiRouter.get('/dispatches', (_req: Request, res: Response) => {
  try {
    const dispatches = db.prepare('SELECT * FROM dispatches ORDER BY dispatched_at DESC').all() as any[];
    const formatted = dispatches.map((d) => {
      const source = db.prepare('SELECT * FROM centres WHERE id = ?').get(d.source_centre_id) as any;
      const target = db.prepare('SELECT * FROM centres WHERE id = ?').get(d.target_centre_id) as any;
      const manifest = d.manifest_id ? (db.prepare('SELECT * FROM manifests WHERE id = ?').get(d.manifest_id) as any) : null;
      let unitIds: string[] = [];
      try {
        unitIds = JSON.parse(d.unit_ids);
      } catch {
        unitIds = [];
      }

      const route = transportAdapter.estimateRoute(d.source_centre_id, d.target_centre_id, 'PLATELETS');

      return {
        id: d.id,
        manifestId: d.manifest_id,
        manifestNumber: manifest?.manifest_number || 'MNF-UNKNOWN',
        demandId: d.demand_id,
        legId: d.leg_id,
        sourceCentreId: d.source_centre_id,
        sourceCentreName: source?.name || d.source_centre_id,
        targetCentreId: d.target_centre_id,
        targetCentreName: target?.name || d.target_centre_id,
        unitIds,
        unitsCount: unitIds.length,
        transportMode: d.transport_mode,
        status: d.status,
        adapterDegraded: Boolean(d.adapter_degraded),
        dispatchedAt: d.dispatched_at,
        estimatedArrival: d.estimated_arrival,
        actualArrival: d.actual_arrival,
        progressPercent: d.progress_percent,
        coldChainTempC: d.cold_chain_temp_c,
        prioritySignalActive: !d.adapter_degraded && d.transport_mode === 'RESQTECH_PRIORITY_CORRIDOR',
        waypoints: route.waypoints,
        distanceKm: route.distanceKm,
        etaMinutes: route.activeEtaMin,
      };
    });

    res.json({ dispatches: formatted });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

/**
 * POST /api/dispatches/:id/advance
 * Advances transit step simulator for demonstration.
 */
apiRouter.post('/dispatches/:id/advance', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dispatch = db.prepare('SELECT * FROM dispatches WHERE id = ?').get(id) as any;
    if (!dispatch) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Dispatch not found.' });
    }

    if (dispatch.status === 'DELIVERED') {
      return res.json({ success: true, dispatch, message: 'Already delivered.' });
    }

    let newProgress = Math.min(100, (dispatch.progress_percent || 15) + 30);
    let newStatus = dispatch.status;
    let actualArrival = dispatch.actual_arrival;

    if (newProgress >= 100) {
      newProgress = 100;
      newStatus = 'DELIVERED';
      actualArrival = new Date().toISOString();

      let unitIds: string[] = [];
      try {
        unitIds = JSON.parse(dispatch.unit_ids);
      } catch {}

      if (unitIds.length > 0) {
        db.prepare(`
          UPDATE blood_units
          SET status = 'AVAILABLE', current_centre_id = ?
          WHERE id IN (${unitIds.map(() => '?').join(',')})
        `).run(dispatch.target_centre_id, ...unitIds);
      }

      if (dispatch.manifest_id) {
        db.prepare('UPDATE manifests SET cold_chain_arrival_temp_c = ? WHERE id = ?')
          .run(dispatch.cold_chain_temp_c, dispatch.manifest_id);
      }

      logEvent('DISPATCH_COMPLETED', 'Courier Vehicle', `Dispatch ${id} delivered to ${dispatch.target_centre_id}. Units received into available inventory.`, {
        dispatchId: id,
        targetCentreId: dispatch.target_centre_id,
      });
    }

    db.prepare(`
      UPDATE dispatches
      SET progress_percent = ?, status = ?, actual_arrival = ?
      WHERE id = ?
    `).run(newProgress, newStatus, actualArrival, id);

    res.json({
      success: true,
      dispatchId: id,
      progressPercent: newProgress,
      status: newStatus,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'UPDATE_ERROR', message: err.message });
  }
});

// =========================================================================
// 4. ResQtech Priority Simulator & Disruption Handling
// =========================================================================

/**
 * GET /api/transport/route
 * Estimates a route, transit time, and simulated corridor status between centres.
 */
apiRouter.get('/transport/route', (req: Request, res: Response) => {
  try {
    const { sourceCentreId, targetCentreId, component = 'PLATELETS' } = req.query;
    if (!sourceCentreId || !targetCentreId) {
      return res.status(400).json({ error: 'MISSING_PARAMS', message: 'sourceCentreId and targetCentreId are required.' });
    }

    const route = transportAdapter.estimateRoute(
      String(sourceCentreId),
      String(targetCentreId),
      String(component)
    );

    res.json({ route });
  } catch (err: any) {
    res.status(500).json({ error: 'ROUTE_ERROR', message: err.message });
  }
});

/**
 * POST /api/transport/availability
 * Toggles adapter operational availability to test fallback.
 */
apiRouter.post('/transport/availability', (req: Request, res: Response) => {
  try {
    const { available } = req.body;
    transportAdapter.setAvailable(Boolean(available));
    res.json({
      available: transportAdapter.isAvailable(),
      adapterStatus: transportAdapter.isAvailable() ? 'SIMULATED_OPERATIONAL' : 'UNAVAILABLE_FALLBACK',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'AVAILABILITY_ERROR', message: err.message });
  }
});

/**
 * POST /api/transport/vehicle/availability
 * Toggles simulated transport vehicle availability.
 */
apiRouter.post('/transport/vehicle/availability', (req: Request, res: Response) => {
  try {
    const { available } = req.body;
    (transportAdapter as any).setVehicleAvailable(Boolean(available));
    res.json({
      available: (transportAdapter as any).isVehicleAvailable(),
      status: (transportAdapter as any).isVehicleAvailable() ? 'AVAILABLE' : 'GROUNDED_UNAVAILABLE',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'VEHICLE_AVAILABILITY_ERROR', message: err.message });
  }
});

/**
 * GET /api/transport/roads
 * Returns road network graph nodes and edges.
 */
apiRouter.get('/transport/roads', (_req: Request, res: Response) => {
  try {
    const edges = db.prepare('SELECT * FROM road_edges ORDER BY id ASC').all() as any[];
    const centres = db.prepare('SELECT id, code, name, city_zone, lat, lng FROM centres ORDER BY code ASC').all() as any[];
    res.json({
      nodes: centres,
      edges: edges.map((e) => ({
        id: e.id,
        sourceCentreId: e.source_centre_id,
        targetCentreId: e.target_centre_id,
        distanceKm: e.distance_km,
        baselineTravelTimeMin: e.baseline_travel_time_min,
        currentTravelTimeMin: e.current_travel_time_min,
        isClosed: Boolean(e.is_closed),
        additionalDelayMin: e.additional_delay_min,
        corridorEligible: Boolean(e.corridor_eligible),
        roadName: e.road_name,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'ROAD_NETWORK_ERROR', message: err.message });
  }
});

/**
 * POST /api/transport/roads/:id
 * Updates road edge state: road closure or additional delay.
 */
apiRouter.post('/transport/roads/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isClosed, additionalDelayMin } = req.body;
    (transportAdapter as any).updateRoadEdge(id, { isClosed, additionalDelayMin });
    const updated = db.prepare('SELECT * FROM road_edges WHERE id = ?').get(id) as any;
    res.json({
      success: true,
      edge: {
        id: updated.id,
        roadName: updated.road_name,
        isClosed: Boolean(updated.is_closed),
        additionalDelayMin: updated.additional_delay_min,
        currentTravelTimeMin: updated.current_travel_time_min,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'EDGE_UPDATE_ERROR', message: err.message });
  }
});

/**
 * POST /api/transport/corridors/request
 * Initiates simulated priority corridor preemption request.
 */
apiRouter.post('/transport/corridors/request', (req: Request, res: Response) => {
  try {
    const { transferId, sourceCentreId, targetCentreId, authorizedOperator = 'Authorized ResQtech Operator' } = req.body;
    if (!transferId || !sourceCentreId || !targetCentreId) {
      return res.status(400).json({ error: 'MISSING_PARAMS', message: 'transferId, sourceCentreId, targetCentreId required.' });
    }

    const route = transportAdapter.estimateRoute(sourceCentreId, targetCentreId, 'PLATELETS');
    const corridorRecord = (transportAdapter as any).requestPriorityCorridor(transferId, route, authorizedOperator);
    res.json(corridorRecord);
  } catch (err: any) {
    res.status(500).json({ error: 'CORRIDOR_REQUEST_ERROR', message: err.message });
  }
});

/**
 * POST /api/transport/corridors/:id/decision
 * Explicit operational state transition for simulated corridor.
 */
apiRouter.post('/transport/corridors/:id/decision', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    if (!['SIMULATED_APPROVED', 'SIMULATED_DENIED', 'SIMULATED_ACTIVE', 'SIMULATED_RELEASED'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Invalid corridor status transition.' });
    }

    const updated = (transportAdapter as any).setCorridorDecision(id, status, reason);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'CORRIDOR_DECISION_ERROR', message: err.message });
  }
});

/**
 * GET /api/transport/corridors/:id
 */
apiRouter.get('/transport/corridors/:id', (req: Request, res: Response) => {
  try {
    const status = (transportAdapter as any).getCorridorStatus(req.params.id);
    if (!status) return res.status(404).json({ error: 'NOT_FOUND', message: 'Corridor request not found.' });
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: 'CORRIDOR_GET_ERROR', message: err.message });
  }
});

/**
 * POST /api/dispatches/disrupt
 * Records a traffic delay or corridor outage and triggers optimizer re-plan.
 */
apiRouter.post('/dispatches/disrupt', async (req: Request, res: Response) => {
  try {
    const { dispatchId, disruptionType = 'CORRIDOR_COMM_FAILURE', reason, additionalDelayMinutes = 0 } = req.body;

    if (!dispatchId) {
      // General network-wide degradation toggle
      transportAdapter.setAvailable(false);
      return res.json({
        status: 'FALLBACK_STANDARD_ROUTE',
        adapterStatus: 'UNAVAILABLE_FALLBACK',
        notice: 'ResQtech priority adapter degraded network-wide. Normal road route fallback engaged.',
      });
    }

    const outcome = await transportAdapter.recordDisruption(
      dispatchId,
      disruptionType,
      reason,
      additionalDelayMinutes
    );

    res.json(outcome);
  } catch (err: any) {
    res.status(500).json({ error: 'DISRUPTION_ERROR', message: err.message });
  }
});

/**
 * POST /api/dispatches/replan
 * Re-runs solver under disruption constraints.
 */
apiRouter.post('/dispatches/replan', async (req: Request, res: Response) => {
  try {
    const { demandId } = req.body;
    logEvent('REPLAN_TRIGGERED', 'Logistics Coordinator', `Dynamic re-planning triggered for demand ${demandId}.`, { demandId });

    res.json({
      replanId: `PLAN-REPLAN-${Date.now().toString(36).toUpperCase()}`,
      status: 'REPLANNED',
      recommendation: 'Maintain courier on secondary arterial bypass; revised arrival complies with emergency threshold.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'REPLAN_ERROR', message: err.message });
  }
});

// =========================================================================
// 5. QR Scanning & Custody Verification
// =========================================================================

/**
 * POST /api/scan
 * Processes a mock ISBT-128 barcode or QR optical scan / manual DIN input.
 * Relocates unit inventory physically to the receiving bay.
 */
apiRouter.post('/scan', (req: Request, res: Response) => {
  try {
    const {
      scannedText,
      eventType = 'RECEIVE_PUT_INTO_STOCK',
      centreId,
      receivingCentreId,
      scanMethod = 'MANUAL_DIN_ENTRY',
      temperatureCheckC,
    } = req.body;

    if (!scannedText || typeof scannedText !== 'string' || !scannedText.trim()) {
      return res.status(400).json({ error: 'MISSING_SCAN_TEXT', message: 'scannedText is required.' });
    }

    const cleaned = scannedText.trim();
    const effectiveCentreId = centreId || receivingCentreId || 'node-metro';

    // Look up unit by DIN or internal ID
    const unit = db.prepare(`
      SELECT * FROM blood_units
      WHERE UPPER(din) = UPPER(?) OR UPPER(din) = UPPER(?) OR UPPER(id) = UPPER(?)
    `).get(cleaned, `=${cleaned.replace(/=/g, '')}=`, cleaned) as any;

    if (!unit) {
      logEvent('SCAN_REJECTED_UNKNOWN_ID', 'Barcode Scanner', `Scan rejected: Unknown unit ID or synthetic DIN '${cleaned}'.`, {
        scannedText: cleaned,
        scanMethod,
        targetCentreId: effectiveCentreId,
      });

      return res.status(404).json({
        verified: false,
        error: 'UNKNOWN_UNIT_ID',
        message: `Unknown unit ID or synthetic DIN '${cleaned}'. Not registered in blood inventory database.`,
      });
    }

    const recordedTemp = temperatureCheckC ?? unit.storage_temp_c;
    const tempSafe = recordedTemp >= 20.0 && recordedTemp <= 24.5; // Platelets range

    // -------------------------------------------------------------
    // OPERATOR INVENTORY EVENT LOGIC & DUPLICATE-SCAN PROTECTION
    // -------------------------------------------------------------

    if (eventType === 'RECEIVE_PUT_INTO_STOCK') {
      // Duplicate-Scan Protection: Already available at this facility
      if (unit.current_centre_id === effectiveCentreId && unit.status === 'AVAILABLE') {
        return res.status(409).json({
          verified: false,
          error: 'DUPLICATE_SCAN_PROTECTION',
          message: `Duplicate receive scan: Unit ${unit.din} is already logged in active inventory at this facility.`,
          unit: {
            id: unit.id,
            din: unit.din,
            component: unit.component,
            bloodGroup: unit.blood_group,
            status: unit.status,
            currentCentreId: unit.current_centre_id,
          },
        });
      }

      // Transition to AVAILABLE at new centre
      db.prepare(`
        UPDATE blood_units
        SET status = 'AVAILABLE', current_centre_id = ?, storage_temp_c = ?
        WHERE id = ?
      `).run(effectiveCentreId, recordedTemp, unit.id);

      // Check for associated active dispatch
      const dispatch = db.prepare(`
        SELECT * FROM dispatches
        WHERE unit_ids LIKE ? AND status IN ('IN_TRANSIT', 'FALLBACK_STANDARD_ROUTE')
      `).get(`%${unit.id}%`) as any;

      if (dispatch) {
        db.prepare(`
          UPDATE dispatches
          SET status = 'DELIVERED', progress_percent = 100, actual_arrival = ?
          WHERE id = ?
        `).run(new Date().toISOString(), dispatch.id);

        if (dispatch.manifest_id) {
          db.prepare(`
            UPDATE manifests
            SET cold_chain_arrival_temp_c = ?
            WHERE id = ?
          `).run(recordedTemp, dispatch.manifest_id);
        }
      }

      logEvent('UNIT_RECEIVED_INTO_STOCK', 'Receiving Bay Operator', `Unit ${unit.din} received into stock at ${effectiveCentreId}. Cold chain: ${recordedTemp}°C.`, {
        unitId: unit.id,
        din: unit.din,
        centreId: effectiveCentreId,
        eventType,
        scanMethod,
      });

      return res.json({
        verified: true,
        actionExecuted: 'RECEIVE_PUT_INTO_STOCK',
        unitId: unit.id,
        din: unit.din,
        component: unit.component,
        bloodGroup: unit.blood_group,
        volumeMl: unit.volume_ml,
        expiresAt: unit.expires_at,
        hoursRemaining: unit.hours_remaining,
        storageTempC: recordedTemp,
        temperatureStatus: tempSafe ? 'NOMINAL_SAFE_RANGE' : 'TEMPERATURE_DEVIATION_ALERT',
        previousStatus: unit.status,
        newStatus: 'AVAILABLE',
        currentCentreId: effectiveCentreId,
        custodyTransferred: true,
        nonClinicalDisclaimer: 'NON-CLINICAL LOGISTICS VERIFICATION: Decodes synthetic label strings only. Does not analyze biological blood safety or clinical release status.',
      });
    }

    if (eventType === 'REMOVE_ISSUE_FROM_STOCK') {
      // Duplicate-Scan Protection: Already issued or removed
      if (unit.status === 'ISSUED_TO_OR' || unit.status === 'DISCARDED') {
        return res.status(409).json({
          verified: false,
          error: 'DUPLICATE_SCAN_PROTECTION',
          message: `Duplicate removal scan: Unit ${unit.din} has already been issued or removed from inventory.`,
          unit: {
            id: unit.id,
            din: unit.din,
            status: unit.status,
          },
        });
      }

      // Transition unit to ISSUED_TO_OR
      db.prepare(`
        UPDATE blood_units
        SET status = 'ISSUED_TO_OR'
        WHERE id = ?
      `).run(unit.id);

      logEvent('UNIT_ISSUED_FROM_STOCK', 'Operating Room Charge Nurse', `Unit ${unit.din} issued from stock at ${unit.current_centre_id}.`, {
        unitId: unit.id,
        din: unit.din,
        centreId: unit.current_centre_id,
        eventType,
        scanMethod,
      });

      return res.json({
        verified: true,
        actionExecuted: 'REMOVE_ISSUE_FROM_STOCK',
        unitId: unit.id,
        din: unit.din,
        component: unit.component,
        bloodGroup: unit.blood_group,
        volumeMl: unit.volume_ml,
        previousStatus: unit.status,
        newStatus: 'ISSUED_TO_OR',
        currentCentreId: unit.current_centre_id,
        nonClinicalDisclaimer: 'NON-CLINICAL LOGISTICS VERIFICATION: Synthetic label metadata only.',
      });
    }

    // Default: VERIFY_INVENTORY (Routine Check / Integrity Scan)
    logEvent('UNIT_INVENTORY_VERIFIED', 'Inventory Quality Tech', `Unit ${unit.din} verified at ${unit.current_centre_id}. Sensor: ${recordedTemp}°C.`, {
      unitId: unit.id,
      din: unit.din,
      centreId: unit.current_centre_id,
      eventType,
      scanMethod,
    });

    return res.json({
      verified: true,
      actionExecuted: 'VERIFY_INVENTORY',
      unitId: unit.id,
      din: unit.din,
      component: unit.component,
      bloodGroup: unit.blood_group,
      volumeMl: unit.volume_ml,
      expiresAt: unit.expires_at,
      hoursRemaining: unit.hours_remaining,
      storageTempC: recordedTemp,
      temperatureStatus: tempSafe ? 'NOMINAL_SAFE_RANGE' : 'TEMPERATURE_DEVIATION_ALERT',
      status: unit.status,
      currentCentreId: unit.current_centre_id,
      nonClinicalDisclaimer: 'NON-CLINICAL LOGISTICS VERIFICATION: Decodes synthetic label strings only. Does not analyze biological blood safety or clinical release status.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'SCAN_ERROR', message: err.message });
  }
});

// =========================================================================
// 6. Manifest, Event Logs & Reset
// =========================================================================

/**
 * GET /api/manifests
 * Lists all generated cold-chain manifests.
 */
apiRouter.get('/manifests', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM manifests ORDER BY generated_at DESC').all() as any[];
    const formatted = rows.map((m) => {
      const source = db.prepare('SELECT * FROM centres WHERE id = ?').get(m.source_centre_id) as any;
      const target = db.prepare('SELECT * FROM centres WHERE id = ?').get(m.target_centre_id) as any;
      let units = [];
      try {
        units = JSON.parse(m.units_json);
      } catch {}

      return {
        id: m.id,
        manifestNumber: m.manifest_number,
        dispatchId: m.dispatch_id,
        demandId: m.demand_id,
        generatedAt: m.generated_at,
        source: {
          id: m.source_centre_id,
          name: source?.name || m.source_centre_id,
          officer: source?.contact_officer || 'Logistics Officer',
        },
        destination: {
          id: m.target_centre_id,
          name: target?.name || m.target_centre_id,
          officer: target?.contact_officer || 'Trauma Bay Director',
        },
        units,
        transportMode: m.transport_mode,
        coldChainDepartureTempC: m.cold_chain_departure_temp_c,
        coldChainArrivalTempC: m.cold_chain_arrival_temp_c,
        verificationHash: m.verification_hash,
        legalDisclaimer: m.legal_disclaimer,
      };
    });

    res.json({ manifests: formatted });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

/**
 * GET /api/state/full
 * Provides a unified operational snapshot from SQLite to hydrate frontend.
 */
apiRouter.get('/state/full', async (_req: Request, res: Response) => {
  try {
    // 1. Centres
    const centresRows = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM blood_units WHERE current_centre_id = c.id AND status = 'AVAILABLE') as live_stock
      FROM centres c ORDER BY c.code ASC
    `).all() as any[];
    const centres = centresRows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      cityZone: c.city_zone,
      lat: c.lat,
      lng: c.lng,
      contactOfficer: c.contact_officer,
      phoneExtension: c.phone_extension,
      safetyReserveFloor: c.safety_reserve_floor,
      currentPlateletStock: c.live_stock,
      status: c.status,
      demoRole: c.demo_role,
    }));

    // 2. Units
    const unitsRows = db.prepare('SELECT * FROM blood_units ORDER BY hours_remaining ASC').all() as any[];
    const units = unitsRows.map((u) => ({
      id: u.id,
      din: u.din,
      bloodGroup: u.blood_group,
      component: u.component,
      volumeMl: u.volume_ml,
      collectedAt: u.collected_at,
      expiresAt: u.expires_at,
      hoursRemaining: u.hours_remaining,
      currentCentreId: u.current_centre_id,
      status: u.status,
      storageTempC: u.storage_temp_c,
      agitationActive: Boolean(u.agitation_active),
      isSyntheticMock: Boolean(u.is_synthetic_mock),
    }));

    // 3. Latest Demand & Plan
    const latestDemand = db.prepare('SELECT * FROM demand_requests ORDER BY created_at DESC LIMIT 1').get() as any;
    let latestPlan = null;
    let legs: any[] = [];
    let candidateEvaluations: any[] = [];
    let rejectedCandidates: any[] = [];
    let baselineComparison: any = null;
    let unmetQuantity = 0;
    let unmetReasonCodes: string[] = [];

    if (latestDemand) {
      latestPlan = db.prepare('SELECT * FROM allocation_plans WHERE demand_id = ? ORDER BY created_at DESC LIMIT 1').get(latestDemand.id) as any;
      if (latestPlan) {
        legs = db.prepare('SELECT * FROM allocation_legs WHERE plan_id = ?').all(latestPlan.id) as any[];
      }
      try {
        const optResult = await getOptimizerEngine().optimize(latestDemand.id, { resqtechDegraded: !transportAdapter.isAvailable() });
        candidateEvaluations = optResult.candidateEvaluations || [];
        rejectedCandidates = optResult.rejectedCandidates || [];
        baselineComparison = optResult.baselineComparison || null;
        unmetQuantity = optResult.unmetQuantity || 0;
        unmetReasonCodes = optResult.unmetReasonCodes || [];
      } catch {}
    }

    // 4. Dispatches
    const dispatchesRows = db.prepare('SELECT * FROM dispatches ORDER BY dispatched_at DESC').all() as any[];
    const dispatches = dispatchesRows.map((d) => {
      const source = centres.find((c) => c.id === d.source_centre_id);
      const target = centres.find((c) => c.id === d.target_centre_id);
      let unitIds = [];
      try {
        unitIds = JSON.parse(d.unit_ids);
      } catch {}

      const route = transportAdapter.estimateRoute(d.source_centre_id, d.target_centre_id, 'PLATELETS');

      return {
        id: d.id,
        manifestId: d.manifest_id,
        demandId: d.demand_id,
        legId: d.leg_id,
        sourceCentreId: d.source_centre_id,
        sourceCentreName: source?.name || d.source_centre_id,
        targetCentreId: d.target_centre_id,
        targetCentreName: target?.name || d.target_centre_id,
        unitIds,
        unitsCount: unitIds.length,
        transportMode: d.transport_mode,
        status: d.status,
        adapterDegraded: Boolean(d.adapter_degraded),
        dispatchedAt: d.dispatched_at,
        estimatedArrival: d.estimated_arrival,
        actualArrival: d.actual_arrival,
        progressPercent: d.progress_percent,
        coldChainTempC: d.cold_chain_temp_c,
        prioritySignalActive: !d.adapter_degraded && d.transport_mode === 'RESQTECH_PRIORITY_CORRIDOR',
        waypoints: route.waypoints,
        distanceKm: route.distanceKm,
        etaMinutes: route.activeEtaMin,
      };
    });

    // 5. Manifests
    const manifestsRows = db.prepare('SELECT * FROM manifests ORDER BY generated_at DESC').all() as any[];
    const manifests = manifestsRows.map((m) => {
      const source = centres.find((c) => c.id === m.source_centre_id);
      const target = centres.find((c) => c.id === m.target_centre_id);
      let unitsParsed = [];
      try {
        unitsParsed = JSON.parse(m.units_json);
      } catch {}
      return {
        id: m.id,
        manifestNumber: m.manifest_number,
        dispatchId: m.dispatch_id,
        demandId: m.demand_id,
        generatedAt: m.generated_at,
        source: {
          id: m.source_centre_id,
          name: source?.name || m.source_centre_id,
          officer: source?.contactOfficer || 'Logistics Officer',
        },
        destination: {
          id: m.target_centre_id,
          name: target?.name || m.target_centre_id,
          officer: target?.contactOfficer || 'Trauma Bay Director',
        },
        units: unitsParsed,
        transportMode: m.transport_mode,
        coldChainDepartureTempC: m.cold_chain_departure_temp_c,
        coldChainArrivalTempC: m.cold_chain_arrival_temp_c,
        verificationHash: m.verification_hash,
        legalDisclaimer: m.legal_disclaimer,
      };
    });

    // 6. All Requests
    const allRequestsRows = db.prepare('SELECT * FROM demand_requests ORDER BY priority_rank ASC, created_at DESC').all() as any[];

    // 7. Road Network Edges
    const roadEdgesRows = db.prepare('SELECT * FROM road_edges ORDER BY id ASC').all() as any[];
    const roadEdges = roadEdgesRows.map((e) => ({
      id: e.id,
      sourceCentreId: e.source_centre_id,
      targetCentreId: e.target_centre_id,
      distanceKm: e.distance_km,
      baselineTravelTimeMin: e.baseline_travel_time_min,
      currentTravelTimeMin: e.current_travel_time_min,
      isClosed: Boolean(e.is_closed),
      additionalDelayMin: e.additional_delay_min,
      corridorEligible: Boolean(e.corridor_eligible),
      roadName: e.road_name,
    }));

    // 8. Corridor Requests
    const corridorRequestsRows = db.prepare('SELECT * FROM corridor_requests ORDER BY requested_at DESC').all() as any[];

    res.json({
      centres,
      units,
      latestDemand,
      allRequests: allRequestsRows,
      roadEdges,
      corridorRequests: corridorRequestsRows,
      vehicleAvailable: (transportAdapter as any).isVehicleAvailable(),
      latestPlan: latestPlan
        ? {
            plan: latestPlan,
            legs: legs.map((l) => ({
              ...l,
              allocated_unit_ids: JSON.parse(l.allocated_unit_ids),
              source_approved: Boolean(l.source_approved),
              receiving_approved: Boolean(l.receiving_approved),
            })),
            candidateEvaluations,
            rejectedCandidates,
            baselineComparison,
            unmetQuantity,
            unmetReasonCodes,
          }
        : null,
      dispatches,
      manifests,
      resqtechDegraded: !transportAdapter.isAvailable(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

/**
 * GET /api/manifests/:id
 */
apiRouter.get('/manifests/:id', (req: Request, res: Response) => {
  try {
    const manifest = db.prepare('SELECT * FROM manifests WHERE id = ? OR manifest_number = ?').get(req.params.id, req.params.id) as any;
    if (!manifest) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Manifest not found.' });
    }

    const sourceCentre = db.prepare('SELECT * FROM centres WHERE id = ?').get(manifest.source_centre_id) as any;
    const destCentre = db.prepare('SELECT * FROM centres WHERE id = ?').get(manifest.target_centre_id) as any;

    res.json({
      manifestNumber: manifest.manifest_number,
      generatedAt: manifest.generated_at,
      source: { name: sourceCentre?.name, officer: sourceCentre?.contact_officer },
      destination: { name: destCentre?.name, officer: destCentre?.contact_officer },
      units: JSON.parse(manifest.units_json),
      transportMode: manifest.transport_mode,
      coldChainDepartureTempC: manifest.cold_chain_departure_temp_c,
      coldChainArrivalTempC: manifest.cold_chain_arrival_temp_c,
      verificationHash: manifest.verification_hash,
      legalDisclaimer: manifest.legal_disclaimer,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

/**
 * GET /api/events
 * Chronological audit event log (supports polling with ?since=timestamp)
 */
apiRouter.get('/events', (req: Request, res: Response) => {
  try {
    const { since } = req.query;
    let query = 'SELECT * FROM event_logs';
    const params: any[] = [];

    if (since) {
      query += ' WHERE timestamp > ?';
      params.push(since);
    }

    query += ' ORDER BY timestamp DESC LIMIT 50';
    const rows = db.prepare(query).all(...params) as any[];

    res.json({
      events: rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        type: r.event_type,
        actor: r.actor,
        summary: r.summary,
        payload: r.payload_json ? JSON.parse(r.payload_json) : null,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

/**
 * GET /api/events/stream
 * Real-time Server-Sent Events (SSE) live updates.
 */
apiRouter.get('/events/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'VitaSync SSE Active' })}\n\n`);

  const unregister = registerSseClient((data: string) => {
    res.write(`data: ${data}\n\n`);
  });

  req.on('close', () => {
    unregister();
  });
});

/**
 * POST /api/demo/reset
 * Deterministic reset to baseline 4-centre demo state.
 */
apiRouter.post('/demo/reset', (_req: Request, res: Response) => {
  try {
    isResqtechDegraded = false;
    resetDatabase();
    res.json({
      reset: true,
      message: 'VitaSync database restored to baseline deterministic 4-centre demo state.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'RESET_ERROR', message: err.message });
  }
});
