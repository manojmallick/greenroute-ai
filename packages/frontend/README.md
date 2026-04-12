# GreenRoute AI — Frontend

> React 19 + Vite dashboard for real-time fleet monitoring and carbon optimization

Part of the [GreenRoute AI](../../README.md) monorepo.

---

## Overview

The frontend is a real-time single-page application that visualizes the multi-agent logistics system. It connects to the API Gateway over **Socket.IO** and renders live vehicle positions, route replans, CO₂ savings, and algorithm traces as they happen.

**Live:** [https://greenroute-frontend-j6pe6wobrq-ez.a.run.app](https://greenroute-frontend-j6pe6wobrq-ez.a.run.app)

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Map | Leaflet.js + react-leaflet |
| Charts | Recharts |
| Real-time | Socket.IO client 4 |
| Serving | nginx (production Docker image) |

---

## Component Reference

### `LiveMap/`
Animated Leaflet map centered on Amsterdam. Renders each vehicle as a marker that moves along its current route. When a replan fires, old route polylines fade out and new ones animate in. Clicking a vehicle opens a popup with its current CO₂ tally and delivery status.

### `CO2Ticker/`
Real-time counter driven by the `co2:tick` Socket.IO event. Shows cumulative CO₂ saved by the fleet since the session started (kg), updated on every router publish.

### `FleetDashboard/`
Tabular view of all vehicles. Columns: ID, type, status (`idle / en_route / stopped`), current stop, CO₂ this session, last replan timestamp. Rows highlight in amber when a vehicle is being replanned.

### `AlgoTrace/`
Step-by-step visualization of the A\* node expansion for the most recent route computation. Each expanded node is plotted on the map in sequence, allowing viewers to see exactly how the algorithm navigated around congestion. Toggle with the "Show algo trace" button.

### `BeforeAfter/`
Side-by-side route comparison rendered when a replan completes. Shows the previous route (red) and new route (green) for each replanned vehicle, with CO₂ and time delta labels.

### `Leaderboard/`
Eco-leaderboard sorted by CO₂ saved per vehicle this session. Updates after every replan. Highlights the top performer with a trophy icon.

### `ReplanBanner/`
Full-screen overlay that appears when `replan:started` is received. Shows the triggering anomaly details (segment, speed drop, Z-score, severity). Dismissed automatically when `replan:complete` arrives.

---

## Hooks

### `useSocket.js`
Manages the Socket.IO connection lifecycle. Subscribes to `fleet:subscribe` on connect, and exposes event handlers for `route:updated`, `replan:started`, `replan:complete`, and `co2:tick`. Automatically reconnects with exponential back-off.

### `useFleet.js`
Maintains the full fleet state (vehicle positions, route geometries, CO₂ accumulators). Consumes events from `useSocket` and merges updates into React state. Exposes derived stats (total CO₂ saved, active vehicle count, last replan duration).

---

## Local Development

```bash
# From repo root
npm install

# Start the full stack (API gateway + agents + infra)
docker-compose up

# Start the frontend dev server (hot reload)
npm run dev --workspace=packages/frontend
# → http://localhost:5173
```

Set `VITE_API_URL` in `.env` if the API gateway is not on `localhost:3000`:

```bash
VITE_API_URL=https://greenroute-api-gateway-j6pe6wobrq-ez.a.run.app
```

---

## Production Build

```bash
npm run build --workspace=packages/frontend
# Output: packages/frontend/dist/
```

The Docker image uses a two-stage build: Node 20 builder → nginx:alpine. The `VITE_API_URL` build arg is injected at Docker build time by the CI/CD pipeline.

```bash
docker build \
  --build-arg VITE_API_URL=https://your-api-url \
  -f packages/frontend/Dockerfile \
  -t greenroute-frontend .
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | API Gateway base URL (injected at build time) |
