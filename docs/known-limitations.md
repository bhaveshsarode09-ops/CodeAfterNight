# VitaSync: Known Limitations, Boundary Conditions & Integration Scope

> **Document Status**: Production Readiness & Integration Engineering Review  
> **Classification**: Prototype Safety & Boundary Specification

---

## 1. What is Implemented and Real (Tested & Functioning Code)

1. **SQLite Relational Persistence**:
   - Real database transactions managing tables for `medical_centres`, `blood_units`, `demand_records`, `allocation_plans`, `allocation_legs`, `transfer_manifests`, `dispatches`, and `inventory_audit_events`.
   - Guaranteed state durability across page reloads and API requests.

2. **Algorithmic Optimizer & Allocation Engine**:
   - Exact mathematical evaluation of multi-facility allocation with hard constraints:
     - Sub-12-hour shelf-life exclusion filter (`STALE`).
     - Donor facility safety reserve floor enforcement (`SOURCE_RESERVE`).
     - Transit urgency deadline threshold checking (`ETA_TOO_LATE`).
     - Unmet demand and candidate rejection explanation reporting.
   - Zero synthetic stock fabrication: transfers only draw from registered database units.

3. **Dual-Approval State Machine**:
   - Separate, cryptographically validated approval flags (`source_approved`, `receiver_approved`).
   - Transfer commitment and unit status locking are strictly blocked until both approvals exist.
   - Double-allocation prevention: locked or in-transit units cannot be proposed for subsequent requests.

4. **In-Browser Camera & Barcode Scanner**:
   - Real webcam video capture and real-time canvas decoding via `jsQR`.
   - ISBT-128 and DIN QR code processing with fallback manual verification controls.
   - Temperature probe bounds verification (`20.0°C – 24.5°C` nominal platelet range).

5. **Certified Manifest Provisioning**:
   - Deterministic SHA-256 cryptographic digest calculation over manifest payload attributes.
   - Regulatory notices, blood component handling rules, and custody signatures.

---

## 2. What is Simulated or In-Memory (Design Boundaries)

1. **ResQtech Green-Wave Priority Corridors**:
   - **Simulated**: Speed calculations (42 km/h simulated priority corridor vs 21 km/h standard courier), traffic signal preemption, corridor outage signals, and waypoint progression.
   - **Boundary**: Zero municipal traffic signals, emergency vehicle transponders, cellular modems, or LoRa gateways are interfaced.

2. **Medical Center Telemetry & Hardware**:
   - **Simulated**: Temperature probe measurements and cold-chain data loggers are operator-entered or simulated inputs.
   - **Boundary**: Zero physical wireless temperature sensors, RFID tags, or blood refrigerator actuators are connected.

3. **Courier Vehicle Dispatch**:
   - **Simulated**: Courier dispatches, tracking coordinates, and route waypoints represent simulated geographic coordinates within a fictional metropolitan area.
   - **Boundary**: Zero physical ambulance fleets, drone controllers, or third-party logistics API integrations (e.g. FedEx, Uber Health).

4. **Hospital Clinical Records & EHR**:
   - **Simulated**: Patient urgency, surgical trauma cases, and blood demands are initiated as simulated operational triggers.
   - **Boundary**: No connection to Epic, Cerner, MEDITECH, or live hospital EHR/EMR systems.

---

## 3. What Would Be Required for Clinical / Real-World Integration

To transition VitaSync from an engineering prototype to an operational hospital network utility, the following integrations and compliance clearances are required:

### A. Hospital Information & Blood Bank Systems (HIS / TMIS)
- **Integration**: HL7 FHIR (Fast Healthcare Interoperability Resources) v4 / v5 APIs or ASTM E1394 interfaces connecting to Cerner Millennium, Epic Beaker Blood Bank, or SoftBank.
- **Data Exchange**: Real-time bi-directional inventory synchronization (`Observation`, `SupplyDelivery`, `DeviceMetric`).
- **Regulatory**: Full validation under FDA 21 CFR Part 11 (Electronic Records, Electronic Signatures) and HIPAA Security Rule compliance.

### B. Medical Device Certification
- **Software as a Medical Device (SaMD)**: Classification review under FDA Guidance for Clinical Decision Support Software (CDS) and EU MDR 2017/745 Rule 11 (software intended to provide information used to take decisions with diagnosis or therapeutic purposes).
- **ISO Standards**: ISO 13485 (Medical devices — Quality management systems) and IEC 62304 (Medical device software lifecycle processes).

### C. Connected Cold Chain Telemetry
- **Hardware**: Validated BLE / cellular temperature data loggers (e.g. Sensitech, TempTale, InTemp) mounted inside calibrated blood transport containers.
- **Protocol**: Continuous encrypted telemetry transmission every 30 seconds with automatic breach escalation alerts.

### D. Municipal Emergency Vehicle Preemption (EVP)
- **Transport Authority**: Formal memorandums of understanding (MOUs) and secure API integration with municipal Department of Transportation (DOT) Advanced Traffic Management Systems (ATMS) or Opticom / priority corridor infrastructure.
- **Security**: Hardware Security Modules (HSM) and public key infrastructure (PKI) for authorized vehicle-to-infrastructure (V2I) communication.
