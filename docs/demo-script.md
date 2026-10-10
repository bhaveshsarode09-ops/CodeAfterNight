# VitaSync: 2–3 Minute Live Demo Script & Operator Click Sequence

> **Audience**: Clinical Logistics Directors, Hospital Blood Bank Managers, Trauma Coordinators, Systems Evaluators  
> **Total Run Time**: Approximately 2 minutes 45 seconds  
> **Architecture**: Two Role-Based Dashboards (Requester Hospital & Provider Blood Center) with Instant Mode Switcher (`Alt+1` / `Alt+2`), Evaluator Split View (`Alt+3`), and Immutable SQLite Audit Ledger.

---

## Act 1: Clean Baseline Reset & The Role Switcher (0:00 – 0:35)

1. **Click "Reset Demo"** in the top navigation header.
   - **Narration**: *"VitaSync features a clean two-role architecture designed around the actual actors in the emergency blood supply chain: the Requesting Hospital (inbound consumer) and the Regional Blood Bank (outbound supplier). Notice the instant mode switcher in the top-left: Requester Mode (blue accent) and Provider Mode (red accent), plus an Evaluator Split View for live side-by-side demonstration."*
2. **Observe Invariant Header**:
   - Point out the **SQLite Active** indicator, persistent safety disclaimer ("Synthetic logistics records only; never for clinical crossmatching or transfusion authorization"), and **Audit Log** drawer button with live event count.
3. **Press `Alt+1` (Requester Mode)**:
   - Notice instant (<100ms) switch to the **Hospital Requester Dashboard** without page reload or data refetch.
   - Dropdown displays **Metro Trauma Center Level 1**.
   - Notice the **Hospital Safety Floor Status** card: Metro is in critical platelet shortage (1 available vs 5 floor = -4 units deficit).

---

## Act 2: Requester Hospital Submits Surge Demand (0:35 – 1:05)

1. **In Requester Mode > Tab 1: Request Hub**:
   - Under *Quick Emergency Presets*, click **"Trauma Shock STAT (4x Platelets O+)"**.
   - Review auto-populated fields: Blood Group `O+`, Component `PLATELETS`, Units `4`, Priority `STAT`, Urgency `25 minutes`.
   - Click **"Submit Emergency Surge Request"**.
2. **Observe Instant Feedback**:
   - The UI immediately transitions to **Tab 2: Live Tracking**.
   - Active demand step tracker shows: `[1. Requested (Queued)]` with ETA ~14 mins, 8.4 km distance, and ResQtech corridor active.
   - Notice the inactive **Provider Mode** toggle in the top bar now flashes a notification badge: **"1 new"**.
   - **Narration**: *"The request was written to SQLite and broadcast via WebSocket. Both dashboards share one global reactive state. The provider now has an incoming demand notification without any polling."*

---

## Act 3: Provider Blood Bank Evaluates & Approves Source Release (1:05 – 1:45)

1. **Press `Alt+2` (or click "Provider Mode")**:
   - Switches instantly to **Apex Regional Blood Center (Provider Dashboard)**.
   - Default tab is **Tab 1: Incoming Requests**.
2. **Review Priority Queue & Joint Allocation**:
   - The queue displays Metro Trauma's STAT request ranked #1.
   - Click **"Run Joint MILP Optimizer"**.
   - Inspect the proposed outbound transfer leg:
     - 4 Platelet units allocated from Apex surplus (`VS-U-101`, `VS-U-102`, `VS-U-103`, `VS-U-104`).
     - Composite Score Breakdown: **Transit Speed (94/100)**, **FEFO Freshness (98/100)**, **Buffer Safety Floor (92/100)**.
     - Apex's mandatory safety floor of 2 units is preserved.
3. **Authorize Source Release**:
   - Authorizing Officer: `Dr. R. Bannerjee (Logistics Officer)`.
   - Click **"Approve Source Release"**.
   - Badge turns green: *"Source Release Approved"*.
   - **Narration**: *"Source release is confirmed and units are staged in temperature-regulated outbound containers. The hospital’s Live Tracking screen immediately updates to Step 3 in the background."*

---

## Act 4: Split View Evaluator Demo & Dual Custody Handshake (1:45 – 2:20)

1. **Click "Split View" (or press `Alt+3`)**:
   - **Narration**: *"Let's switch to Split View so you can see both roles simultaneously. On the left: Metro Trauma Hospital. On the right: Apex Regional Blood Center."*
2. **Inspect Left Panel (Requester > Tab 2: Live Tracking)**:
   - Metro Trauma's tracker automatically advanced to `[3. Source Blood Bank Approved]`.
3. **Inspect Right Panel (Provider > Tab 3: Dispatch Bay)**:
   - Click **"Advance +25%"** to move courier progress.
   - Notice courier telemetry and cold chain monitor: `22.0°C NOMINAL`.
   - Click **"Mark Delivered"**.
4. **Authorize Receiving Signoff on Left Panel (Requester > Tab 3: Receiving)**:
   - On the left panel, switch to **Tab 3: Receiving & Scanner**.
   - Under *Pending Custodial Receiving Signoff*, click **"Sign & Accept Custody"**.
   - Both source and receiving approvals are verified!
   - Under *Physical Unit Scanner*, click **`[VS-U-101 (Platelets A+)]`**.
   - Confirmed: *"Unit VS-U-101 received and stocked in Metro Trauma inventory!"*
   - Metro's Platelet safety floor immediately increments to stable!

---

## Act 5: Disaster Surge & Immutable Audit Trail (2:20 – 2:45)

1. **Open the Immutable Event Log**:
   - Click **"Audit Log"** in the top navigation bar.
   - The side-drawer slides out from the right showing the complete cryptographically hashed timeline:
     - `SURGE_INCIDENT_CREATED` by Dr. S. Nair
     - `OPTIMIZER_PLAN_GENERATED` with algorithmic candidate evaluations
     - `SOURCE_LEG_APPROVED` by Dr. R. Bannerjee
     - `RECEIVING_LEG_APPROVED` by Dr. S. Nair
     - `INVENTORY_EVENT_COMMITTED` for physical unit receipt
2. **Review Safety Boundary**:
   - **Closing Narration**: *"VitaSync streamlines high-stress emergency blood supply chain coordination by giving hospitals and blood centers role-tailored dashboards, mathematical allocation, and guaranteed custody handoffs—grounded on an immutable audit trail and strict non-clinical safety boundaries."*
