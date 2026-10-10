# Evidence, Reproducibility, and Limitations

## Evidence supplied in the archive

The original proof file states that notebook sections 1–6 were executed top-to-bottom on a synthetic surrogate dataset, with 35/35 checks passing. It records an additional rerun with stand-ins for unavailable RL libraries; that rerun is **not** PPO training evidence.

| Evidence item | Recorded details | What it supports | What it does not support |
|---|---|---|---|
| Forecast | 1,827 synthetic rows; chronological split 1,278/274/275; Random Forest test RMSE 12.98, MAE 10.22, R² 0.507 | Reproduction of one run on its synthetic target | Accuracy on real hospital data or clinical utility |
| Baselines | Historical usage RMSE 27.73; train mean RMSE 18.96 | RF outscored those baselines in that synthetic test | Broad model superiority or generalization |
| Route check | Four-node toy graph; Depot-A→Site-B→Site-C = 28 min vs direct 31 min | Shortest-path code/check in that toy graph | Real traffic time or delivery feasibility |
| Queue/recommender | Stable toy ordering; score/range checks; simulated inventory ledger guards | Deterministic policy and edge-case checks | Clinically correct triage or optimal network allocation |
| Late route case | SIM-101: 28 min against a 12-min deadline; no reservation | A test case can be flagged before simulated reservation | A real transport decision |
| PPO | Not run in supplied proof | Only that an intended experiment exists in notebook | Trained agent, successful learning, benchmark win |
| MILP | Mathematical formulation proposed in paper | The optimization problem has been sketched | Implemented MILP, solver optimality, or benchmark |
| Web app | Imported app repository includes automated test suites | Source code and test infrastructure are present | A fresh run in this packaging session unless tested below |

The model artifact SHA-256 recorded by the supplied proof is `e35ee9947bd5698afcb67ef3658651c42ebc7a214767ef93185d088792bde33c`. The original chart, proof JSON, and notebook are preserved in `resources/original-submission/`.

## Reproducing the web application checks

From the repository root:

```bash
npm install
npm run lint
npm test
npm run build
npm run dev
```

Open `http://localhost:3000`. The demo has a reset action/endpoint. Avoid personal or clinical data. Record actual output and environment when re-running; do not reuse old test claims if tests change.

## Reproducing the notebook

Open `resources/original-submission/VitaSync_Emergency_Inventory_Demo_Corrected.ipynb` in Jupyter/Colab. Follow its own setup and section order. Inspect the printed data mode. If it says `SURROGATE`, metrics only characterize the synthetic surrogate. The supplied proof recommends Colab with internet for the data-source test and indicates section 7 needs `gymnasium`, `stable-baselines3`, and `torch`. Running section 7 would create new evidence; the present submission must continue to label it pending until actually completed and reviewed.

Before redistributing data/model outputs, inspect dataset terms and the notebook's stated GPL-3.0 note. The original training proof reports use of synthetic surrogate data, not downloaded hospital records.

## Material limitations

- No live hospital/blood bank, patient registry, e-RaktKosh, dispatch, traffic-controller, or physical sensor integration is established by supplied evidence.
- Facilities, inventory units, urgency inputs, requests, routes, and scenario outputs are fictional.
- The research paper's IoT/GPS/temperature/LoRa/offline resilience/security ideas are proposed design options unless a distinct artifact demonstrates otherwise.
- The ResQtech report is a separate ambulance traffic-preemption concept. Its hardware, AES/HMAC, LoRa, BLE, safety, and impact statements must not be attributed to VitaSync.
- Do not claim lives saved, patient benefit, reduced national shortages, actual waste reduction, real-world forecast accuracy, or deployed operational readiness based on these demos.
- No compatibility, crossmatch, patient-specific treatment, transfusion decision, or blood-release decision is performed. The application is not a clinical product.
- The application optimizer is a deterministic candidate-selection/scoring heuristic, not the full MILP model and not a proof of global optimality.
- Stock and routes may only be treated as confirmed within the fictional application state; field truth, custody, cold-chain integrity, and regulatory compliance are not established by a simulation.

## What would strengthen the evidence

1. Re-run tests from a clean install and publish logs/commit hashes.
2. Verify data provenance, usage rights, and schema; evaluate only on authorized de-identified representative data.
3. Add temporal/seasonal and site-level baselines, uncertainty/calibration, and leakage audits.
4. Implement and independently validate the MILP (or another exact optimizer), disclose coefficients/constraints, and compare against heuristic baselines on reproducible cases.
5. Run PPO training only if appropriate; retain seeds, environment definition, baseline results, and evaluation code.
6. Conduct security, privacy, human-factors, transport, product-eligibility, and regulatory review before any controlled pilot.
7. Keep clinical and release decisions with qualified professionals; begin any real evaluation in supervised shadow mode.
