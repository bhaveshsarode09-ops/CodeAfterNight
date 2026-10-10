# VitaSync Local Prototype

This prototype runs the React frontend, Express API, and SQLite database together on one local Node process.

## Requirements

- Node.js 22 or newer
- npm

## Start the local application

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The server uses the checked-in synthetic SQLite database at:

```text
data/vitasync.db
```

The frontend calls the same-origin API under `/api`, so no `VITE_API_BASE_URL` is needed. Keep `VITE_DEMO_MODE=false` or leave it unset. This uses the real local SQLite-backed prototype flow rather than browser-only simulation.

## Verify the connection

In another terminal:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/state/full
```

The first command should return a healthy JSON response. The second should return the synthetic centres, inventory, demands, plans, and audit state.

## Test a request

1. Open **Requester Mode**.
2. Select **Metro Trauma Center (Level 1)**.
3. Apply **Trauma Shock STAT**.
4. Submit the emergency request.
5. Open **Live Tracking**.
6. Switch to **Provider Mode** to inspect the incoming request.
7. Run the joint optimizer.

The request is persisted in the local SQLite database and remains available to the local server process.

## Reset the synthetic database

Use the application’s **Reset Demo** action, or run:

```bash
curl -X POST http://localhost:3000/api/demo/reset
```

This is synthetic prototype data only. It is not connected to real hospitals, patients, blood products, dispatch systems, or traffic-control hardware.
