# Proof of Working: VitaSync Corrected Notebook

**Scope of this proof.** Sections 1-6 of `VitaSync_Emergency_Inventory_Demo_Corrected.ipynb` were executed top to bottom in a clean Python process (sandbox). **The data was the notebook's FAKE surrogate dataset** (`data_mode = SURROGATE`), because the sandbox had no internet and could not reach Kaggle. Section 7 (PPO) was **not** executed here because `gymnasium`, `stable-baselines3` and `torch` could not be installed. It must be run in Colab.

## Environment
Python 3.12.3, numpy 2.4.4, pandas 3.0.2, scikit-learn 1.8.0, networkx 3.6.1, matplotlib 3.10.8, joblib 1.5.3.

## What ran and passed (35 / 35 checks)
| Area | Checks that passed |
|---|---|
| Data | rows and dates valid, no duplicate dates, all 8 features present |
| Split and leakage | chronological split, covers all rows, no identifier-like features |
| Forecast | metrics finite, Random Forest beats both naive baselines on test RMSE, chart saved |
| Graph | connected, Depot-A to Site-C is 28 min via Site-B, NetworkX matches an independent Dijkstra for all pairs |
| Queue | heap order equals an independent sort, bad urgency rejected, score rises with urgency, scores in [0, 1], tie-break is earlier creation then id |
| Recommender | statuses valid, no site oversubscribed, ledger never negative, inputs not mutated |
| Late route | `SIM-101` = `LATE_ROUTE_REVIEW`, not feasible, slack -16, no stock reserved |
| Local fulfillment | `SIM-102` and `SIM-103` = local, 0 min, source = destination |
| Stock edge cases | on-time transfer has positive slack, 11 units gives manual review, two 6-unit requests do not double-reserve (Depot-A left = 4) |
| Artifacts | model reloads with identical predictions, schema matches, proof JSON + model + chart exist |

Extra runs: the full notebook was also run twice in the same process (46 / 46 checks with test stand-ins for the RL libraries), confirming it is safe to rerun.

## Key results (SURROGATE data, not meaningful for real demand)
- Rows 1,827 (train 1,278 / validation 274 / test 275). Chosen settings: `min_samples_leaf=5`, `max_features=0.6`.
- Test RMSE: Random Forest 12.98, historical-usage baseline 27.73, train-mean 18.96.
- Queue order: `SIM-101`, `SIM-103`, `SIM-102`.
- Routes: `SIM-101` LATE_ROUTE_REVIEW (28 min vs 12 min deadline); `SIM-103` and `SIM-102` LOCAL_FULFILLMENT_REVIEW_REQUIRED.

## Artifacts in this folder
- `training_proof.json`: machine-readable run record (includes `data_mode` and all 35 checks).
- `demand_forecast_test.png`: held-out forecast chart (surrogate data).
- Model file SHA-256: `e35ee9947bd5698afcb67ef3658651c42ebc7a214767ef93185d088792bde33c`

## Still to prove (run in Colab with internet)
1. Confirm the data mode prints `real`.
2. Run section 7 so PPO trains (3 seeds) and the final table shows all checks PASS.
3. Then the real-data metrics, PPO totals and `ppo_toy_inventory_policy.zip` become valid evidence.

Not clinical software. All sites, stock, urgency and routes are fictional.
