# Algorithms and Step-by-Step Execution

## Purpose and terminology

The project contains **separate algorithms**, not a single end-to-end learned AI model. The notebook experiments use synthetic tabular data and toy requests. The web application contains deterministic logistics workflow code using fictional seeded records. The following separates what is implemented from what is proposed.

## A. Demand forecasting — Random Forest regression (notebook)

### Problem
Given eight daily features (`DayOfWeek`, `Month`, `Population`, `Events`, `HistoricalBloodUsage`, `HospitalAdmissions`, `BloodDonorsAvailable`, `Temperature`), estimate the dataset's `PredictedBloodDemand` target. This is a prediction of a synthetic dataset target, not a clinical demand forecast.

### Procedure
1. Audit dates, columns, duplicates, missingness, and feature schema.
2. Sort chronologically and split 1,827 rows into 1,278 training, 274 validation, and 275 test examples.
3. Fit candidate random-forest regressors on training data. A forest averages tree predictions: `ŷ(x) = (1 / B) Σ[b=1..B] T_b(x)`, where `T_b` is a decision tree fitted with randomized sample/feature choices.
4. Select settings using training/validation only; recorded settings: `min_samples_leaf=5`, `max_features=0.6`.
5. Evaluate once on the held-out chronological test partition and compare to historical-usage and training-mean baselines.

### Results recorded in supplied proof

| Method | Test MAE | Test RMSE | Test R² |
|---|---:|---:|---:|
| Random Forest | 10.22 | 12.98 | 0.507 |
| Historical-usage baseline | 22.66 | 27.73 | -1.251 |
| Training-mean baseline | 14.12 | 18.96 | -0.052 |

Lower MAE/RMSE are better; R² compares against a mean reference. These are surrogate-data metrics only. They do not prove generalization to real hospital demand.

### Correctness/evidence statement
The notebook checks finite metrics, chronological coverage, and a reload round-trip with identical predictions. These establish code/data-pipeline invariants for the recorded run; they do not establish statistical validity, clinical usefulness, causal relationships, or performance on real data. The Kaggle dataset is itself described in the notebook as synthetic; verify source provenance and GPL-3.0 obligations before redistribution.

## B. Shortest paths — Dijkstra (notebook and application routing)

### Problem and algorithm
Represent facilities/road junctions as vertices `V` and route segments as edges `E` with nonnegative travel-time weights `w(u,v)`. Initialize `d(source)=0`, all other tentative distances to infinity. Repeatedly select the unsettled vertex with smallest tentative distance, settle it, and relax each outgoing edge:

`if d(u) + w(u,v) < d(v): d(v) ← d(u)+w(u,v); predecessor(v) ← u`.

Stop when the destination is settled (or all reachable vertices are settled), then follow predecessor pointers backward to recover the path. Closed or unavailable edges are omitted/disabled before running the route calculation.

### Worked example from notebook

- Direct Depot-A → Site-C: 31 minutes.
- Depot-A → Site-B: 18 minutes; Site-B → Site-C: 10 minutes.
- Via Site-B totals 28 minutes; because `28 < 31`, Dijkstra returns Depot-A → Site-B → Site-C.
- Against a fictional 12-minute deadline, slack is `12−28 = −16` minutes; it must be flagged for human review and not treated as feasible.

### Correctness argument
Dijkstra's greedy settlement is correct when edge weights are nonnegative. When a vertex `u` with the smallest unsettled tentative distance is selected, any alternative path to `u` through another unsettled vertex would have cost at least `d(u)` plus a nonnegative final segment, so it cannot be shorter. Thus settled distances are shortest-path distances. Complexity is `O((|V|+|E|) log |V|)` with an adjacency list and binary min-heap; a simple array implementation is `O(|V|²+|E|)`. This proof applies to the graph model and its supplied edge weights, not real traffic estimates.

## C. Request review queue — weighted score and stable ordering (notebook)

For toy request `r`, the supplied notebook score is:

`score(r) = 0.55·urgency(r) + 0.25·shortage(r) + 0.20·deadline(r)`

where `urgency = urgency_level/5`; `shortage` is the fraction of requested units not covered locally; `deadline = 30/(30 + deadline_minutes)`. Values are normalized to `[0,1]` for valid inputs. Higher scores are reviewed first. A heap key adds deterministic tie-break fields (earlier creation then request ID) so equal scores have repeatable order. The application also has a batch request ordering policy; its exact fields are documented in code/docs and should not be confused with clinical triage.

### Why the queue behaves as intended
The weighted sum is monotone in each input because all coefficients are nonnegative. Increasing declared urgency while other inputs remain fixed cannot lower the score. A binary heap returns the extremal key at each pop; identical input records and tie-break keys yield the same order. The notebook's independent-sort check verifies the demonstrated ordering. This does **not** prove that the chosen weights are clinically appropriate or that the first request has greater medical need.

Typical heap operations are `O(log n)` insert/pop and `O(n log n)` to drain `n` requests.

## D. Eligibility and inventory recommender

### Notebook toy recommender
It iterates requests in queue order, evaluates candidate sources, checks status/availability and requested quantity, checks the route/deadline, and reserves against a temporary in-memory ledger. The supplied policy chooses one nearest source capable of the **entire** request; it is greedy, does not split requests, and is not globally optimal. The ledger is updated only after an assignment passes all checks.

### Web application candidate optimizer
`server/optimizer.ts` performs these broad steps:
1. Load demand and target centre from the SQLite demo state.
2. For each other centre, estimate distance (Haversine great-circle distance multiplied by a fixed 1.35 urbanization factor) and standard/corridor ETA using configured speed assumptions.
3. Inspect component inventory; reject candidates for handling conditions, no available units, stale/expired stock, insufficient stock above the reserve floor, or ETA beyond the requested window.
4. Bound transferable integer units by eligible available stock less the reserve floor.
5. Score remaining candidates using normalized transit, FEFO/freshness, and reserve-margin metrics; build an auditable candidate report and allocation legs.

For centre `i`, a core bound is `maxTransfer_i = max(0, eligible_i − reserve_i)`. Therefore allocated units from that centre cannot exceed this bound **within the evaluated snapshot**. Deadline-infeasible and explicitly filtered stock do not enter feasible pools. Code inspection and tests are needed to verify each edge case; this does not establish global optimality.

The implementation calls itself a deterministic feasible-candidate **heuristic**. It is not a mixed-integer solver, despite the separate MILP formulation in the research paper. A locally higher score or greedy ordering need not minimize a network-wide objective; multiple requests and overlapping donor pools can create global trade-offs. Runtime is roughly linear in the candidate centres and inspected units, plus sorting of candidate pools/units (`O(C·U + C log C + U log U)` in a simplified upper-bound description; exact costs depend on database queries and sort sizes).

## E. Proposed MILP in the research paper (not implemented/validated as a solver)

Let integer `xᵢⱼcg ≥ 0` be units transferred from source `i` to destination `j` for component/category `(c,g)`, and `uⱼcg ≥ 0` unmet demand. One proposed objective is:

`min Z = Pᵤ Σⱼcg uⱼcg + Σᵢⱼcg (Cᵢⱼ + Lᵢⱼ + Eᵢcg) xᵢⱼcg`

where unmet demand has a penalty `Pᵤ`; the other coefficients represent transfer cost, delay/risk, and expiry exposure. Typical required constraints include demand balance (`Σᵢ xᵢⱼcg + uⱼcg = Dⱼcg`), source reserve (`Σⱼ xᵢⱼcg ≤ max(0,Sᵢcg−Rᵢcg)`), route/eligibility bounds (`xᵢⱼcg ≤ qᵢⱼ Fᵢⱼcg`), and integrality. This is a **model sketch**, not a validated model. Coefficients, constraints, data, solver implementation, and benchmark are future work. No optimality proof or MILP performance claim is made.

## F. Toy PPO replenishment section (not executed in supplied proof)

The notebook defines a Gymnasium stock simulator where an agent observes stock and a historical-usage hint, chooses among discrete order amounts, and receives reward from simulated unmet-demand, holding, and ordering costs. The paper/proof says PPO training did not run in the recorded environment because dependencies were unavailable. Therefore there is no trained policy result to report. The code's intended training recipe (multiple seeds and baseline comparison) is not evidence of execution or policy quality.

## Example execution walkthrough (fictional)

1. **Reset:** restore seeded facilities and fictional inventory.
2. **Submit:** a user enters target, component, quantity, urgency tier, and deadline.
3. **Screen:** evaluate each donor; discard unavailable/filtered stock and candidates violating the source reserve or ETA window.
4. **Rank:** compute auditable scores for feasible candidates and deterministic tie-breaks.
5. **Propose:** allocate no more than eligible transferable integer stock; show rejected alternatives and reasons.
6. **Review:** authorized demo roles record source and recipient approvals. This workflow is simulated; it is not actual legal/clinical authorization.
7. **Track:** simulate route progress and possible fallback, then scan/confirm and append demo audit events.
8. **Verify:** run the commands in README; inspect tests and proof resources. Do not interpret a green test suite as medical or field validation.

## Guarantees and non-guarantees

**Can be established for a given run/model:** deterministic outputs for fixed ordered inputs; Dijkstra shortest route in a nonnegative graph; a candidate is excluded by explicit coded filters; integer allocations stay within computed caps if code paths/tests confirm it; repeatable synthetic test checks.

**Not established:** globally optimal network allocation; real-time or real-world ETA accuracy; demand forecasting accuracy for hospitals; clinical product suitability; donor/recipient compatibility; legal release; sensor integrity; cybersecurity certification; reduced wastage, cost, morbidity, or mortality. Those require separate implementation, data, and qualified validation.
