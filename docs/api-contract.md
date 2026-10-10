# VitaSync REST API Contract & State Transition Specification

**Version:** 1.0.0  
**Base URL:** `/api`  
**Protocol:** HTTP/1.1 JSON (UTF-8)

---

## 1. Transfer State Machine & Invariant Rules

### Invariant Rules
1. **Dual-Approval Enforcement:** A transfer leg **cannot** enter `COMMITTED` or `DISPATCHED` status without **both** `SOURCE_APPROVED` and `RECEIVING_APPROVED` recorded.
2. **Safety Floor Protection:** A donor centre cannot commit units if doing so reduces its local stock below its `safetyReserveFloorPercent`.
3. **FEFO Viability Check:** Stale units (expiry $\le 12$ hours or already past expiration) are disqualified by the solver and cannot be allocated.
4. **ResQtech Fallback Integrity:** When ResQtech priority is degraded, the dispatch status updates to `FALLBACK_STANDARD_ROUTE`, and ETAs are automatically recalculated using commercial traffic parameters.
5. **Physical Relocation on Receipt:** Blood units remain associated with their source centre until a verified QR/barcode scan or manual DIN check-in confirms physical custody at the receiving facility.

### State Transition Diagram
```
[DRAFT / CREATED]
       │
       ▼ (POST /api/optimize)
 [PLAN_GENERATED]
       │
       ├──► (POST /api/approvals/source) ──► [SOURCE_APPROVED]
       │                                            │
       └──► (POST /api/approvals/receiving) ────────┼──► [DUAL_APPROVED]
                                                    │           │
                                                    │           ▼ (POST /api/dispatches/commit)
                                                    │      [COMMITTED]
                                                    │           │
                                                    │           ▼ (Dispatch initiated)
                                                    │      [IN_TRANSIT]
                                                    │           │
                                                    │           ├──► (POST /api/dispatches/disrupt) ──► [TRANSIT_DISRUPTED]
                                                    │           │                                               │
                                                    │           │                                               ▼ (replan)
                                                    │           │                                       [FALLBACK_REPLANNED]
                                                    │           │
                                                    │           ▼ (POST /api/scan)
                                                    └─────► [DELIVERED_AND_VERIFIED]
```

---

## 2. API Endpoints

### 2.1 Centres & Inventory

#### `GET /api/centres`
Retrieves all 4 medical facilities in the network, including current stock and reserve floors.

**Response `200 OK`:**
```json
{
  "centres": [
    {
      "id": "node-metro",
      "code": "C1",
      "name": "Metro Trauma Centre (Level 1)",
      "cityZone": "Downtown Core",
      "lat": 12.9352,
      "lng": 77.6245,
      "contactOfficer": "Dr. S. Nair (Trauma Bay Director)",
      "phoneExtension": "Ext. 102",
      "safetyReserveFloor": 3,
      "currentPlateletStock": 1,
      "status": "CRITICAL_DEFICIT",
      "demoRole": "DEMAND_REQUESTER"
    },
    {
      "id": "node-apex",
      "code": "C2",
      "name": "Apex Regional Blood Center",
      "cityZone": "Central Logistics Hub",
      "lat": 12.9716,
      "lng": 77.5946,
      "contactOfficer": "Dr. R. Bannerjee (Logistics Officer)",
      "phoneExtension": "Ext. 401",
      "safetyReserveFloor": 2,
      "currentPlateletStock": 8,
      "status": "SURPLUS",
      "demoRole": "FEASIBLE_DONOR"
    },
    {
      "id": "node-mercy",
      "code": "C3",
      "name": "Mercy Community Hospital",
      "cityZone": "East Urban Zone",
      "lat": 12.9821,
      "lng": 77.6698,
      "contactOfficer": "K. Pillai (Blood Storage Tech)",
      "phoneExtension": "Ext. 315",
      "safetyReserveFloor": 2,
      "currentPlateletStock": 2,
      "status": "STALE_STOCK",
      "demoRole": "STALE_CANDIDATE_REJECTION"
    },
    {
      "id": "node-north",
      "code": "C4",
      "name": "North Point Clinic",
      "cityZone": "Northwest Ring Corridor",
      "lat": 13.0450,
      "lng": 77.5892,
      "contactOfficer": "E. D'Souza (Inventory Dispatch)",
      "phoneExtension": "Ext. 620",
      "safetyReserveFloor": 2,
      "currentPlateletStock": 2,
      "status": "AT_SAFETY_FLOOR",
      "demoRole": "RESERVE_ETA_REJECTION"
    }
  ]
}
```

---

#### `GET /api/inventory`
Retrieves individual synthetic blood units with optional query filters.

**Query Parameters:**
- `centreId` (optional): Filter by centre ID.
- `component` (optional): `PLATELETS` | `PRBC` | `FFP` | `CRYO`.
- `status` (optional): `AVAILABLE` | `RESERVED` | `IN_TRANSIT` | `DELIVERED`.

**Response `200 OK`:**
```json
{
  "total": 13,
  "units": [
    {
      "id": "VS-U-101",
      "din": "=W1234260010100=",
      "bloodGroup": "O+",
      "component": "PLATELETS",
      "volumeMl": 250,
      "collectedAt": "2026-10-07T08:00:00Z",
      "expiresAt": "2026-10-12T08:00:00Z",
      "hoursRemaining": 72.0,
      "currentCentreId": "node-apex",
      "status": "AVAILABLE",
      "storageTempC": 21.8,
      "agitationActive": true,
      "isSyntheticMock": true
    }
  ]
}
```

---

### 2.2 Demand & Optimization

#### `POST /api/demand`
Creates a new emergency blood demand request from a medical centre.

**Request Body:**
```json
{
  "targetCentreId": "node-metro",
  "component": "PLATELETS",
  "bloodGroup": "O+",
  "quantity": 2,
  "priority": "STAT",
  "urgencyWindowMinutes": 30,
  "operationalNotes": "Massive hemorrhage shock in trauma bay 4; local platelet reserves exhausted."
}
```

**Response `201 Created`:**
```json
{
  "demandId": "DEM-2026-001",
  "targetCentreId": "node-metro",
  "status": "OPEN",
  "createdAt": "2026-10-09T11:30:00Z",
  "requiredUnits": 2,
  "urgencyWindowMinutes": 30
}
```

---

#### `POST /api/optimize`
Runs the exact mathematical solver across available network stock.

**Request Body:**
```json
{
  "demandId": "DEM-2026-001"
}
```

**Response `200 OK`:**
```json
{
  "planId": "PLAN-2026-OPT-01",
  "demandId": "DEM-2026-001",
  "status": "PLAN_GENERATED",
  "solverStatus": "OPTIMAL",
  "fulfillmentPercent": 100,
  "totalUnitsAllocated": 2,
  "allocatedLegs": [
    {
      "legId": "LEG-01",
      "sourceCentreId": "node-apex",
      "targetCentreId": "node-metro",
      "allocatedUnitIds": ["VS-U-101", "VS-U-102"],
      "distanceKm": 8.4,
      "resqtechCorridorEtaMin": 14,
      "standardRouteEtaMin": 28,
      "activeEtaMin": 14,
      "scores": {
        "transitSpeedScore": 95,
        "fefoExpiryScore": 88,
        "donorBufferSafetyScore": 90,
        "compositeScore": 91.5
      }
    }
  ],
  "rejectedCandidates": [
    {
      "centreId": "node-mercy",
      "reason": "FEFO_STALE_STOCK",
      "details": "Candidate units expired or <12h remaining shelf life (1.5h left); rejected to avoid delivering non-viable platelets."
    },
    {
      "centreId": "node-north",
      "reason": "RESERVE_FLOOR_BREACH_AND_ETA_EXCEEDED",
      "details": "Transfer would reduce stock (2 units) below local reserve floor (2 units); distance 24.2 km exceeds 30 min STAT deadline."
    }
  ]
}
```

---

### 2.3 Dual-Approval Workflow

#### `POST /api/approvals/source`
Records authorization from the donor centre's logistics officer.

**Request Body:**
```json
{
  "planId": "PLAN-2026-OPT-01",
  "legId": "LEG-01",
  "officerName": "Dr. R. Bannerjee",
  "officerRole": "SOURCE_LOGISTICS_OFFICER",
  "remarks": "Release authorized from Apex Cold Vault Bay 2."
}
```

**Response `200 OK`:**
```json
{
  "legId": "LEG-01",
  "sourceApproved": true,
  "sourceApprovedBy": "Dr. R. Bannerjee",
  "sourceApprovedAt": "2026-10-09T11:32:15Z",
  "dualApproved": false,
  "status": "SOURCE_APPROVED"
}
```

---

#### `POST /api/approvals/receiving`
Records authorization from the receiving centre's director.

**Request Body:**
```json
{
  "planId": "PLAN-2026-OPT-01",
  "legId": "LEG-01",
  "officerName": "Dr. S. Nair",
  "officerRole": "RECEIVING_TRAUMA_DIRECTOR",
  "remarks": "Inbound platelet transfer verified and bay readied."
}
```

**Response `200 OK`:**
```json
{
  "legId": "LEG-01",
  "receivingApproved": true,
  "receivingApprovedBy": "Dr. S. Nair",
  "receivingApprovedAt": "2026-10-09T11:33:00Z",
  "dualApproved": true,
  "status": "DUAL_APPROVED"
}
```

---

#### `POST /api/dispatches/commit`
Commits the transfer to active transit. Rejects execution if both approvals are not present.

**Request Body:**
```json
{
  "planId": "PLAN-2026-OPT-01",
  "legId": "LEG-01"
}
```

**Response `200 OK` (Success):**
```json
{
  "dispatchId": "DSP-2026-001",
  "manifestId": "MNF-2026-4401",
  "status": "IN_TRANSIT",
  "transportMode": "RESQTECH_PRIORITY_CORRIDOR",
  "coldChainTempC": 21.8,
  "estimatedArrival": "2026-10-09T11:47:00Z",
  "unitsLocked": ["VS-U-101", "VS-U-102"]
}
```

**Response `409 Conflict` (Approval Invariant Violation):**
```json
{
  "error": "DUAL_APPROVAL_REQUIRED",
  "message": "Transfer cannot be committed. Requires both Source and Receiving approvals prior to transit authorization.",
  "sourceApproved": true,
  "receivingApproved": false
}
```

---

### 2.4 ResQtech Priority Simulator & Disruption Handling

#### `POST /api/dispatches/disrupt`
Simulates a priority corridor disruption or street-level signal outage.

**Request Body:**
```json
{
  "dispatchId": "DSP-2026-001",
  "disruptionType": "CORRIDOR_DEGRADED",
  "reason": "Simulated communications loss on urban transit link 4."
}
```

**Response `200 OK`:**
```json
{
  "dispatchId": "DSP-2026-001",
  "status": "FALLBACK_STANDARD_ROUTE",
  "resqtechActive": false,
  "originalEtaMin": 14,
  "revisedEtaMin": 28,
  "etaDelayMin": 14,
  "notice": "ResQtech degraded. System automatically switched to standard medical courier profile with normal road traffic delays."
}
```

---

#### `POST /api/dispatches/replan`
Re-runs the optimization solver dynamically when an active route is compromised.

**Request Body:**
```json
{
  "demandId": "DEM-2026-001",
  "excludedNodeIds": []
}
```

**Response `200 OK`:**
```json
{
  "replanId": "PLAN-REPLAN-01",
  "status": "REPLANNED",
  "recommendation": "Maintain courier on secondary arterial bypass; revised arrival 11:58 UTC complies with STAT window."
}
```

---

### 2.5 QR Scanning & Custody Verification

#### `POST /api/scan`
Processes a mock ISBT-128 barcode/QR optical scan or manual DIN entry.

**Request Body:**
```json
{
  "scannedText": "=W1234260010100=",
  "receivingCentreId": "node-metro",
  "scanMethod": "CAMERA_OPTICAL_FRAME",
  "temperatureCheckC": 22.1
}
```

**Response `200 OK`:**
```json
{
  "verified": true,
  "unitId": "VS-U-101",
  "din": "=W1234260010100=",
  "component": "PLATELETS",
  "bloodGroup": "O+",
  "manifestId": "MNF-2026-4401",
  "temperatureStatus": "NOMINAL_SAFE_RANGE",
  "recordedTempC": 22.1,
  "custodyTransferred": true,
  "newLocation": "Metro Trauma Centre (Level 1)",
  "nonClinicalDisclaimer": "NON-CLINICAL LOGISTICS VERIFICATION: Camera vision verifies synthetic label metadata only; does not analyze biological blood safety or clinical release status."
}
```

---

### 2.6 Manifest, Event Logs & Reset

#### `GET /api/manifests/:id`
Retrieves certified digital transfer manifest.

**Response `200 OK`:**
```json
{
  "manifestNumber": "MNF-2026-4401",
  "generatedAt": "2026-10-09T11:33:05Z",
  "source": { "name": "Apex Regional Blood Center", "officer": "Dr. R. Bannerjee" },
  "destination": { "name": "Metro Trauma Centre (Level 1)", "officer": "Dr. S. Nair" },
  "units": [
    { "din": "=W1234260010100=", "component": "PLATELETS", "volumeMl": 250, "verified": true }
  ],
  "verificationHash": "SHA256:VS-DEM001-APEX-METRO-9F83A201",
  "legalDisclaimer": "NON-CLINICAL COLD-CHAIN CUSTODY RECORD ONLY: Not for clinical crossmatching, pre-transfusion testing, or transfusion authorization."
}
```

---

#### `GET /api/events`
Chronological audit event log of all system actions.

**Response `200 OK`:**
```json
{
  "events": [
    {
      "id": "EVT-101",
      "timestamp": "2026-10-09T11:30:00Z",
      "type": "DEMAND_CREATED",
      "actor": "Metro Trauma Bay Director",
      "summary": "STAT request for 2 platelet units created."
    },
    {
      "id": "EVT-102",
      "timestamp": "2026-10-09T11:30:05Z",
      "type": "OPTIMIZATION_SOLVED",
      "actor": "Exact Math Solver",
      "summary": "Optimal plan generated. Apex selected (score 91.5). Mercy rejected (stale). North Point rejected (reserve floor)."
    }
  ]
}
```

---

#### `POST /api/demo/reset`
Restores database to pristine initial 4-centre deterministic seed state.

**Response `200 OK`:**
```json
{
  "reset": true,
  "message": "VitaSync database restored to baseline deterministic 4-centre demo state."
}
```
