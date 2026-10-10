# CodeAfterNight — VitaSync Emergency Blood Inventory Coordination

> **Hackathon submission | Team CodeAfterDark | Team 6**  
> **Project:** VitaSync — Multi-Branch Blood Supply Chain Optimization & Emergency Redistribution Mesh

VitaSync is a research and software prototype for coordinating fictional emergency blood-component requests across a regional facility network. It combines an interactive full-stack demonstration with a separate notebook experiment for demand forecasting, graph routing, queue ordering, and toy replenishment policy research.

**This is not clinical software.** Every facility, request, unit, route, patient context, and result in the demo is synthetic. It does not determine patient treatment or compatibility, authorize release, connect to hospitals or traffic controllers, or control real inventory or vehicles. Human approval is a required part of the proposed workflow.

## Start here

- [Algorithm explanations, equations, correctness arguments, and worked execution](docs/ALGORITHMS_AND_EXECUTION.md)
- [Evidence, reproducibility, and validation status](docs/EVIDENCE_AND_LIMITATIONS.md)
- [Submission and demo guide](docs/SUBMISSION_GUIDE.md)
- [Research paper (Word document)](resources/original-submission/Research_paper.docx) — page-layout-preserving copy
- [Original research paper (PDF)](resources/original-submission/Research_paper.pdf)
- [Original corrected notebook](resources/original-submission/VitaSync_Emergency_Inventory_Demo_Corrected.ipynb)
- [Original proof of working](resources/original-submission/PROOF_OF_WORKING.md)
- [Original ResQtech report (separate concept; see scope note)](resources/original-submission/ResQtech_IEEE_Report-2.docx)

## Links

- **Live prototype:** https://vitasync-emergency-blood-redistribu-five.vercel.app/
- **Source repository imported for this submission:** https://github.com/bhaveshsarode09-ops/vitasync-emergency-blood-redistribution
- **3D scenario video:** https://drive.google.com/file/d/1DKLGvxUZY_NdQLTfcQDsTFpkGQM9-rm0/view?usp=sharing
- **Research/supporting material folder:** https://drive.google.com/drive/folders/1XtwMaGu3fFs3acIj6JYNqvLEWdMCQygo
- **Additional proof materials:** https://drive.google.com/drive/folders/1ZfqBFbUnjgFyOAQL2ZAqHSyfSjqI2Lwx
- **Demand-data source referenced by notebook:** https://www.kaggle.com/datasets/rishi2003das/blood-demand-dataset (license/provenance must be reviewed before redistributing source data)

The supplied paper refers to a separate application walkthrough but does not provide a resolvable URL in the files received; no link has been invented.

## Repository contents

| Path | Contents |
|---|---|
| `src/`, `server/`, `server.ts` | Imported React/TypeScript frontend and Node/Express/SQLite demo backend |
| `server/optimizer.ts` | Deterministic feasible-candidate scoring and allocation logic (heuristic, not a MILP solver) |
| `server/tests/` | Automated backend, optimizer, scanner, transport, and batch/traffic tests |
| `docs/` | Existing API/data/build docs plus submission algorithm, evidence, and demo guides |
| `resources/original-submission/` | Research paper as Word and PDF, separate report, notebook, proof JSON/Markdown, and forecast chart |
| `data/vitasync.db` | Seeded fictional demo database; reset using the demo reset endpoint/UI |

## Demonstrated capabilities

Fictional request and inventory workflows; inspectable donor-candidate screening and scoring; queue and batch request handling; road-graph route/ETA simulation and simulated corridor degradation/fallback; simulated approval, manifest, scan, and audit workflows. The notebook separately demonstrates Random Forest regression, Dijkstra shortest path, a heap priority queue, a greedy inventory recommender, and an **unrun/unvalidated** PPO section.

These descriptions do not claim deployed sensors, IoT connectivity, cold-chain telemetry, hardware fail-safes, medical integration, or operational dispatch.

## Run locally

Requirements: Node.js 20+ (Node 22 recommended) and npm.

```bash
npm install
npm run lint
npm test
npm run build
npm run dev
```

Open `http://localhost:3000`. Do not enter personal, patient, or confidential data. For hosting/configuration, consult [LOCAL_PROTOTYPE.md](LOCAL_PROTOTYPE.md), [`.env.example`](.env.example), and [VITASYNC_BUILD_PLAN.md](VITASYNC_BUILD_PLAN.md).

## Algorithm overview

1. **Forecast experiment:** Random Forest regression on a chronological split of a synthetic demand series; compare with historical-use and training-mean baselines.
2. **Route experiment:** Dijkstra on nonnegative fictional edge travel times; choose the least-total-time path.
3. **Priority queue:** deterministic score and tie-break fields order fictional requests for review; this is operational ordering, not medical triage.
4. **Inventory recommendation:** rule-based eligibility filters protect the simulated reserve and avoid late routes; the notebook's greedy variant is explicitly not globally optimal.
5. **Application candidate ranking:** hard screens, normalized metrics, and deterministic scores/tie-breaks produce auditable recommendations. This is a heuristic, not a proof of global optimality.
6. **Proposed MILP:** the paper's mathematical formulation is future work; it has not been implemented and benchmarked as a solver in the supplied evidence.

See [the step-by-step algorithm guide](docs/ALGORITHMS_AND_EXECUTION.md) for equations, worked examples, complexity, and correctness scope.

## Evidence in one sentence

The supplied notebook proof records **35/35 checks passing for sections 1–6 on synthetic surrogate data**. It reports test RMSE 12.98 for Random Forest versus 27.73 and 18.96 for two baselines on that synthetic target. These are not real-hospital forecasting results; PPO training was not completed in the supplied run.

## Safety and evidence boundary

VitaSync is a logistics workflow prototype, not a blood bank information system or medical device. It does not perform blood-group compatibility/crossmatch decisions, clinical prioritization, patient-specific recommendations, product release, or transfusion authorization. Future evaluation requires authorized representative data, specialist review, security/privacy controls, and supervised validation. See [limitations and exact proof scope](docs/EVIDENCE_AND_LIMITATIONS.md).

## Provenance

The app code is imported from the linked VitaSync repository above. Supplied research and notebook files are retained under `resources/original-submission/`. The ResQtech document describes a separate ambulance/traffic-preemption concept; it is included as supplied background only and is **not evidence that VitaSync implements or validates those hardware/security claims**. Review original licenses and third-party terms before redistribution.
