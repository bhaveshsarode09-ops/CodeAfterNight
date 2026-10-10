# Submission and Demo Guide

## 60-second project pitch

VitaSync explores how a regional network could turn a time-stamped emergency request into a transparent logistics recommendation: screen fictional donor inventory, protect a simulated source reserve, estimate route feasibility, explain alternatives, and require human review. The submission pairs a full-stack interactive prototype with a separate reproducible notebook study. Its strongest evidence is deliberately scoped: 35 checks passed on synthetic notebook data; the full PPO experiment and real-world validation remain future work.

## Suggested live-demo sequence

Use only the already-deployed demo's synthetic environment. The browser deployment may differ from repository state; do not enter real information.

1. Open the live prototype link in the README and show its initial dashboard and fictional network.
2. Identify a request target, need and deadline using only fictional/demo inputs.
3. Show request creation and its review state.
4. Show the donor candidate explanations: which sources/units pass or fail, and why (availability, shelf life, reserve floor, route deadline).
5. Compare a route estimate with the requested time window; explain that it is a modeled ETA.
6. Show the approval/manifest/scan/audit workflow as an application simulation, not as an actual blood transfer.
7. Reset the demo if available, so the next evaluator sees a clean state.
8. Close with the notebook proof chart/results and say explicitly that they use synthetic surrogate data.

If the live site or an interaction is unavailable, switch to repository screenshots, test files, and the proof artifacts. Do not improvise unimplemented functionality.

## Suggested explanation to evaluators

> “The app is an operational logistics prototype with fictional data, not a clinical decision system. Our Random Forest result is a synthetic-data experiment, and the PPO and full MILP work remain unvalidated. The important contribution today is the transparent workflow and its testable safety constraints—not a claim of clinical outcomes.”

## Resource map

- `resources/original-submission/Research_paper.pdf`: VitaSync research proposal, experiment summary, limitations, and references.
- `resources/original-submission/VitaSync_Emergency_Inventory_Demo_Corrected.ipynb`: runnable notebook source.
- `resources/original-submission/training_proof.json`: machine-readable synthetic notebook checks/results.
- `resources/original-submission/PROOF_OF_WORKING.md`: environment and execution notes.
- `resources/original-submission/demand_forecast_test.png`: held-out synthetic forecast plot.
- `resources/original-submission/ResQtech_IEEE_Report-2.docx`: separate ResQtech smart-ambulance/traffic-preemption document. It is retained because it was supplied, but it is not part of VitaSync algorithm evidence and must not be presented as VitaSync implementation.

## Links received

- Application: https://vitasync-emergency-blood-redistribu-five.vercel.app/
- Imported source repository: https://github.com/bhaveshsarode09-ops/vitasync-emergency-blood-redistribution
- 3D scenario video: https://drive.google.com/file/d/1DKLGvxUZY_NdQLTfcQDsTFpkGQM9-rm0/view?usp=sharing
- Research/support folder: https://drive.google.com/drive/folders/1XtwMaGu3fFs3acIj6JYNqvLEWdMCQygo
- Additional proof folder: https://drive.google.com/drive/folders/1ZfqBFbUnjgFyOAQL2ZAqHSyfSjqI2Lwx

The supplied research paper mentions an application walkthrough link but the received copy does not expose a complete URL. Request the correct link from the team before final judging if that walkthrough exists.

## Submission checklist

- [ ] Verify the new repository is visible to judges (public, or private with evaluator access).
- [ ] Verify app/demo/video links open for the intended audience.
- [ ] Confirm team name, member names, event name, and project ID are correct; add missing official details.
- [ ] Re-run lint, tests, and production build; retain actual command output.
- [ ] Confirm all demo values are fictional and no secrets, `.env`, patient information, or private datasets were added.
- [ ] Check third-party code/data licenses and attribution obligations, especially the notebook's Kaggle/GPL note.
- [ ] Ensure no slide/report text presents proposal claims as tested VitaSync features.
