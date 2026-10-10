# VitaSync Build Plan & Architecture Specification

## 1. Executive Summary & System Identity

**VitaSync** is an operational logistics prototype for emergency inter-facility blood inventory redistribution. It models the algorithmic triage, dual-custody approval, priority corridor routing simulation, and barcode verification required to transfer scarce blood units (specifically platelets in the baseline demo) between medical centres during critical deficits.

### Critical Safety & Non-Clinical Regulatory Boundary
- **Operational Logistics Only:** VitaSync is strictly an operational supply-chain redistribution simulation.
- **Never Claims Clinical Authority:** VitaSync never performs serological crossmatching, antibody screening, biological blood release, pre-transfusion safety clearance, or transfusion authorization.
- **No Lives-Saved Claims:** The system strictly evaluates supply levels, travel times, and shelf-life expiration risks.
- **No Live Hardware or Agency Connections:** No connection to live e-RaktKosh servers, hospital EHRs, patient registries, or physical municipal traffic signal controllers (NTCIP/ATSPM).
- **Synthetic Data Boundary:** All unit DINs, centres, and stock records are synthetic test artifacts.

---

## 2. Workspace Inspection & Stack Decision

### Environment Audit Findings
1. **Operating System & Runtime:** Linux x86_64; Node.js v22.23.2; npm 10.9.8.
2. **Python Environment:** Python 3.10.12 exists at `/usr/bin/python3`, but **no `pip` package manager is installed** (`python3 -m pip list` returns `No pip`). External PyPI installation of FastAPI, Uvicorn, PuLP, HiGHS, or OR-Tools is not supported by the container sandbox.
3. **Node Runtime Capabilities:**
   - Node v22 features built-in native SQLite (`node:sqlite` with `DatabaseSync`), allowing zero-dependency, transactional, ACID database persistence without native C++ compilation issues.
   - `express` (v4.21.2) is already installed in `package.json`.
   - `tsx` (v4.21.0) is already installed for executing TypeScript server code directly.
4. **Dev Server & Hosting Constraints:**
   - The AI Studio development server runs on **Port 3000** via an iframe.
   - Full-stack applications must serve both the API endpoints (`/api/*`) and the Vite React frontend on port 3000 via an Express server (`server.ts`) mounting `vite.middlewares` in development.
5. **Kaggle Dataset Audit:**
   - Zero external CSV files or Kaggle datasets exist in the project directory.
   - Synthetic data generation with realistic schema definitions will be used exclusively.

### Chosen Stack
| Layer | Chosen Technology | Justification |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Vite + Tailwind CSS | Fast rendering, modular architecture, responsive dashboards. |
| **Backend** | Express + TypeScript (`server.ts` on Node 22) | Native compatibility with the sandbox container and dev server port 3000. |
| **Database** | SQLite via built-in `node:sqlite` (`data/vitasync.db`) | Guaranteed transactional persistence, foreign keys, and zero-dependency reliability. |
| **Optimization Solver** | Exact Multi-Objective Mathematical Solver | Server-side deterministic Mixed-Integer Linear Programming / Min-Cost Bipartite Matching engine that rigorously optimizes travel time, FEFO shelf-life, and safety reserve floor constraints with mathematical proof of optimality. |
| **Priority Transport** | ResQtech Transport Adapter (Simulator) | Simulates corridor speed enhancement vs. normal traffic fallback with no real signal hardware commands. |
| **Unit Verification** | ISBT-128 Mock Barcode / QR Scanner | Optical frame parsing of synthetic labels with guaranteed manual-ID fallback. |

---

## 3. Minimal Deterministic Demo Scope

The initial prototype is intentionally constrained to a crisp, fully verifiable 4-centre scenario:

### The 4 Fictional Medical Centres
1. **Centre 1 (`C1` - Metro Trauma Centre Level 1):**
   - *Role:* Demand Requester / Target Bay.
   - *Baseline Platelet Stock:* 1 unit (Critical deficit, below reserve floor of 3 units).
2. **Centre 2 (`C2` - Apex Regional Blood Repository):**
   - *Role:* Feasible Candidate Donor.
   - *Baseline Platelet Stock:* 8 units (Surplus well above reserve floor of 2 units; distance: 8.4 km; fresh units with 3 days shelf-life).
3. **Centre 3 (`C3` - Mercy Community Hospital):**
   - *Role:* Stale Candidate (Rejection Showcase).
   - *Baseline Platelet Stock:* 2 units (Units expired or <12 hours remaining; rejected by FEFO feasibility filter).
4. **Centre 4 (`C4` - North Point Clinic):**
   - *Role:* Reserve Floor & ETA Rejection (Rejection Showcase).
   - *Baseline Platelet Stock:* 2 units (Reserve floor is 2 units; transferring any unit would breach donor safety reserve; distance: 24 km, exceeding emergency ETA).

### Scenario Narrative
1. **Demand Creation:** `C1` submits a STAT emergency request for **2 platelet units** with a 30-minute deadline.
2. **Solver Execution:**
   - Evaluates `C2`, `C3`, and `C4`.
   - Explains rejection of `C3` (stale/expired units).
   - Explains rejection of `C4` (donor safety floor protection & ETA breach).
   - Selects optimal units from `C2` (highest composite score).
3. **Dual-Approval Gate:**
   - Step 3A: `C2` Dispatch Officer reviews and approves release.
   - Step 3B: `C1` Trauma Bay Coordinator reviews and approves receiving.
   - *Rule:* Transfer commits to active transit **only** when both approvals are recorded.
4. **Transit & Disruption:**
   - Active dispatch begins via simulated ResQtech priority corridor.
   - Coordinator triggers simulated disruption (corridor offline).
   - ResQtech adapter automatically fails over to standard-route courier; solver evaluates ETA impact.
5. **Reception & QR Scan:**
   - Units arrive at `C1`.
   - Operator scans mock ISBT-128 label QR/barcode (or enters manual DIN `=W1234260010100=`).
   - System verifies against manifest, updates cold-chain log, and commits unit transfer to `C1` inventory.
6. **Deterministic Reset:**
   - Clicking `Reset Demo` executes `POST /api/demo/reset`, restoring SQLite database to pristine seed state.

---

## 4. Run & Development Commands

```bash
# Start full-stack development server on Port 3000
npm run dev

# Run static type checking and linting
npm run lint

# Compile production bundle
npm run build

# Deterministic database reset via CLI (equivalent to POST /api/demo/reset)
node --experimental-sqlite -e "require('./server/db').resetDatabase()"
```

---

## 5. Ordered Agent Execution Plan

```
Agent 0: VitaSync Lead Architect (CURRENT)
  ├── Inspect workspace & environment constraints [DONE]
  ├── Select stack (React 19 + Express + Node:SQLite + Exact Math Solver) [DONE]
  ├── Create VITASYNC_BUILD_PLAN.md [DONE]
  ├── Create docs/api-contract.md [DONE]
  └── Create docs/data-dictionary.md [DONE]
      │
      ▼
Agent 1: Backend Foundation & Persistence
  ├── Create server.ts mounting Express API routes + Vite dev middleware on Port 3000
  ├── Implement SQLite schema and migrations in server/db.ts via node:sqlite
  ├── Seed 4 deterministic fictional centres and platelet inventory
  └── Implement baseline REST endpoints (Centres, Inventory, Demand, Reset)
      │
      ▼
Agent 2: Optimization Engine & ResQtech Simulator
  ├── Implement exact mathematical solver (FEFO, Reserve Floor, Transit Time)
  ├── Implement ResQtech Transport Adapter simulator with degradation fallback
  ├── Implement Dual-Approval state transition validator
  └── Implement Manifest generation with SHA-256 custody checksum
      │
      ▼
Agent 3: Frontend Integration & Interactive Workflow
  ├── Connect React views to backend REST endpoints
  ├── Implement Dual-Approval visual workflow (Source + Receiving gates)
  ├── Implement ResQtech disruption trigger & live corridor telemetry
  └── Implement ISBT-128 label inspector and camera/manual scanner
      │
      ▼
Agent 4: End-to-End Verification & Audit Hardening
  ├── Execute automated integration test script validating full state machine
  ├── Verify cold-chain temperature boundary enforcement
  ├── Audit non-clinical disclaimers and zero-PII guarantees
  └── Prepare final handoff documentation
```
