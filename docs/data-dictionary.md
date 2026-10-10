# VitaSync Data Dictionary & Governance Specification

## 1. Synthetic Data & Provenance Notice

### Sandbox Inspection & Zero-PII Policy
- **Workspace Dataset Audit:** An inspection of the workspace filesystem confirmed that **no external Kaggle datasets or CSV files are currently present** in the environment.
- **Purely Synthetic Seed Data:** All records (centres, medical personnel names, blood unit DINs, barcodes, timestamps, and locations) are 100% synthetic and generated exclusively for logistics algorithm validation.
- **Privacy Assurance:** Contains zero Personally Identifiable Information (PII), donor names, donor phone numbers, donor email addresses, donor home addresses, patient hospital charts, or Electronic Health Records (EHR).
- **Tabular Data Governance Rules:**
  1. *Demand History Is Not Live Stock:* Historical consumption patterns represent statistical time-series demand; they never indicate current physical units sitting in a blood refrigerator.
  2. *Tabular CSV Is Not a Vision Training Set:* Tabular datasets provide numerical weights and transition probabilities; they must never be represented as visual ground-truth for optical camera classification.
  3. *No Clinical Inference:* Camera images decode alphanumeric barcode/QR text strings; ordinary cameras cannot analyze biological sterility, blood group antigens, or safety release status.

---

## 2. Global Standard Units & Conventions

| Measurement | Standard Unit | Format / Range | Notes |
| :--- | :--- | :--- | :--- |
| **Timestamps** | UTC ISO-8601 | `YYYY-MM-DDTHH:mm:ssZ` | All transitions recorded with explicit UTC timezone. |
| **Distance** | Kilometres (km) | Float, 1 decimal place | Calculated via Haversine formula with 1.35x urban road curvature factor. |
| **Duration / ETA** | Minutes (min) | Integer | Transit time including dispatch overhead. |
| **Temperature** | Celsius (°C) | Float, 1 decimal place | Cold chain sensor readings. |
| **Liquid Volume** | Millilitres (mL) | Integer | Typical platelet unit: 200–300 mL. |
| **Scores** | Normalised points | Integer, `0` to `100` | Multi-objective solver evaluation metrics. |

---

## 3. Entity Schemas

### 3.1 `Centre` (Medical Facility Node)
Represents a hospital, trauma center, or regional blood bank in the metropolitan grid.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(32)` | Primary Key | Machine identifier e.g. `node-metro`, `node-apex`. |
| `code` | `VARCHAR(4)` | Unique, Not Null | Short reference code: `C1`, `C2`, `C3`, `C4`. |
| `name` | `VARCHAR(128)` | Not Null | Human-readable facility name. |
| `cityZone` | `VARCHAR(64)` | Not Null | Metropolitan district or transit zone. |
| `lat` | `DOUBLE` | Latitude, `[-90, 90]` | Geospatial latitude coordinate. |
| `lng` | `DOUBLE` | Longitude, `[-180, 180]` | Geospatial longitude coordinate. |
| `contactOfficer` | `VARCHAR(96)` | Not Null | Named dispatch or receiving officer. |
| `phoneExtension`| `VARCHAR(16)` | Not Null | Internal phone extension e.g. `Ext. 102`. |
| `safetyReserveFloor` | `INTEGER` | Minimum units $\ge 1$ | Absolute minimum reserve units required to be retained locally. |
| `currentPlateletStock` | `INTEGER` | $\ge 0$ | Current active units physically housed at centre. |
| `status` | `VARCHAR(32)` | Enum | `SURPLUS` \| `NOMINAL` \| `AT_SAFETY_FLOOR` \| `CRITICAL_DEFICIT` \| `STALE_STOCK`. |
| `demoRole` | `VARCHAR(48)` | Enum | `DEMAND_REQUESTER` \| `FEASIBLE_DONOR` \| `STALE_CANDIDATE_REJECTION` \| `RESERVE_ETA_REJECTION`. |

---

### 3.2 `BloodUnit` (Synthetic Inventory Item)
Represents a discrete blood container with synthetic ISBT-128 barcode encoding.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(32)` | Primary Key | Synthetic internal ID e.g. `VS-U-101`. |
| `din` | `VARCHAR(24)` | Unique, Not Null | Synthetic ISBT-128 DIN format e.g. `=W1234260010100=`. |
| `bloodGroup` | `VARCHAR(4)` | Enum | `O-` \| `O+` \| `A-` \| `A+` \| `B-` \| `B+` \| `AB-` \| `AB+`. |
| `component` | `VARCHAR(16)` | Enum | Constrained to `PLATELETS` in baseline demo (`PRBC`, `FFP`, `CRYO` supported). |
| `volumeMl` | `INTEGER` | `150`–`400` mL | Net volume of the container. |
| `collectedAt` | `DATETIME` | ISO-8601 UTC | Harvest/donation collection timestamp. |
| `expiresAt` | `DATETIME` | ISO-8601 UTC | Mandatory discard deadline (5 days max for platelets). |
| `currentCentreId`| `VARCHAR(32)` | Foreign Key | Currently holding centre ID. |
| `status` | `VARCHAR(24)` | Enum | `AVAILABLE` \| `RESERVED` \| `IN_TRANSIT` \| `DELIVERED` \| `DISCARDED`. |
| `storageTempC` | `DOUBLE` | Platelets: `20.0`–`24.0`°C | Real-time cold chain temperature reading. |
| `agitationActive`| `BOOLEAN` | Default `true` | Mechanical agitation flag (mandatory for platelets). |
| `isSyntheticMock`| `BOOLEAN` | Default `true` | Explicit audit flag denoting fictional test unit. |

---

### 3.3 `DemandRequest` (Emergency Surge Request)
Created by a receiving medical bay during an acute blood shortage.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(32)` | Primary Key | Identifier e.g. `DEM-2026-001`. |
| `targetCentreId` | `VARCHAR(32)` | Foreign Key | Medical centre receiving the transfer. |
| `component` | `VARCHAR(16)` | `PLATELETS` | Requested blood component. |
| `bloodGroup` | `VARCHAR(4)` | Enum | Target recipient blood group. |
| `quantity` | `INTEGER` | `1`–`10` | Number of units requested. |
| `priority` | `VARCHAR(12)` | Enum | `STAT` (15–30 min) \| `URGENT` (30–60 min) \| `ROUTINE`. |
| `urgencyWindowMinutes` | `INTEGER` | `10`–`180` min | Maximum permissible arrival delay. |
| `operationalNotes` | `TEXT` | Max 500 chars | Non-clinical triage context notes. |
| `status` | `VARCHAR(24)` | Enum | `OPEN` \| `PLAN_GENERATED` \| `COMMITTED` \| `FULFILLED` \| `CANCELLED`. |
| `createdAt` | `DATETIME` | ISO-8601 UTC | Timestamp of submission. |

---

### 3.4 `AllocationPlan` & `AllocationLeg`
The exact mathematical solver output recommending inter-facility transfers.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `planId` | `VARCHAR(32)` | Primary Key | Identifier e.g. `PLAN-2026-OPT-01`. |
| `demandId` | `VARCHAR(32)` | Foreign Key | Associated demand request. |
| `legId` | `VARCHAR(32)` | Unique | Sub-route identifier e.g. `LEG-01`. |
| `sourceCentreId` | `VARCHAR(32)` | Foreign Key | Donor facility. |
| `targetCentreId` | `VARCHAR(32)` | Foreign Key | Recipient facility. |
| `allocatedUnitIds`| `JSON ARRAY` | List of `unit.id` | Locked blood units allocated to leg. |
| `distanceKm` | `DOUBLE` | $> 0` | Transit distance between nodes. |
| `resqtechEtaMin` | `INTEGER` | $> 0` | Duration with simulated priority corridor. |
| `standardEtaMin` | `INTEGER` | $> 0` | Duration with normal traffic fallback. |
| `transitScore` | `INTEGER` | `0`–`100` | Speed score based on urgency window. |
| `fefoExpiryScore` | `INTEGER` | `0`–`100` | Score prioritizing units closest to expiration (reducing waste). |
| `safetyScore` | `INTEGER` | `0`–`100` | Score evaluating donor centre reserve safety. |
| `compositeScore`| `DOUBLE` | `0.0`–`100.0` | Weighted objective score ($0.35 \times \text{Transit} + 0.30 \times \text{FEFO} + 0.35 \times \text{Reserve}$). |
| `sourceApproved` | `BOOLEAN` | Default `false` | Gate 1: Source officer approval flag. |
| `receivingApproved`| `BOOLEAN` | Default `false` | Gate 2: Receiving coordinator approval flag. |

---

### 3.5 `DispatchTracker`
Represents an active transit mission in the metropolitan corridor.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(32)` | Primary Key | Identifier e.g. `DSP-2026-001`. |
| `manifestId` | `VARCHAR(32)` | Foreign Key | Associated certified digital manifest. |
| `legId` | `VARCHAR(32)` | Foreign Key | Associated allocation leg. |
| `status` | `VARCHAR(32)` | Enum | `PREPARING` \| `IN_TRANSIT` \| `FALLBACK_STANDARD_ROUTE` \| `DELIVERED`. |
| `transportMode` | `VARCHAR(32)` | Enum | `RESQTECH_PRIORITY_CORRIDOR` \| `STANDARD_COURIER`. |
| `adapterDegraded`| `BOOLEAN` | Default `false` | Simulated priority link outage indicator. |
| `coldChainTempC` | `DOUBLE` | Float | Telemetry temperature from transit sensor. |
| `progressPercent` | `INTEGER` | `0` to `100` | Transit progress towards destination. |
| `estimatedArrival` | `DATETIME` | ISO-8601 UTC | Dynamically updated arrival time. |

---

### 3.6 `TransferManifest` (Digital Custody Document)
Certified custody record accompanying units in transit.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(32)` | Primary Key | Identifier e.g. `MAN-4401`. |
| `manifestNumber` | `VARCHAR(32)` | Unique | Formal tracking code e.g. `MNF-2026-4401`. |
| `generatedAt` | `DATETIME` | ISO-8601 UTC | Manifest timestamp. |
| `sourceOfficer` | `VARCHAR(96)` | Not Null | Signatory releasing the batch. |
| `receivingOfficer`| `VARCHAR(96)` | Not Null | Signatory receiving the batch. |
| `departureTempC` | `DOUBLE` | Float | Temperature logged at dispatch gate. |
| `arrivalTempC` | `DOUBLE` | Nullable | Temperature logged at receiving bay scan. |
| `verificationHash`| `VARCHAR(96)` | Checksum | Cryptographic custody hash (`SHA256:VS-...`). |
| `legalDisclaimer` | `TEXT` | Not Null | Mandatory operational non-clinical disclaimer text. |

---

### 3.7 `EventLog` (Immutable Audit Trail)
Chronological log of every operational mutation.

| Field Name | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(32)` | Primary Key | Identifier e.g. `EVT-101`. |
| `timestamp` | `DATETIME` | ISO-8601 UTC | Event logging time. |
| `eventType` | `VARCHAR(32)` | Not Null | Mutation event e.g. `DEMAND_CREATED`, `SOURCE_APPROVED`, `QR_VERIFIED`. |
| `actor` | `VARCHAR(64)` | Not Null | System component or user initiating event. |
| `summary` | `TEXT` | Max 256 chars | Human-readable explanation. |
| `payloadJson` | `JSON` | Optional | Serialized state snapshot. |
