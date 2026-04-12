/**
 * Router Agent — full Week 2 implementation.
 *
 * In Week 2, the Router Agent:
 *   1. Loads the city graph from cache
 *   2. Subscribes to Redis greenroute:replan-instruction (from Replanner Agent)
 *   3. Executes FleetReplanner.executeReplan() per instruction
 *   4. Publishes results to Redis → API Gateway → Socket.IO → Frontend
 *
 * Also exports optimizeRoute() for use by the API Gateway REST endpoint.
 */

'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const Redis = require('ioredis');
const { GraphStore } = require('./graph/GraphStore');
const { loadGraph } = require('./graph/builder');
const { FleetReplanner } = require('./fleet/replanner');
const { aStar } = require('./algorithms/astar');
const { dijkstra } = require('./algorithms/dijkstra');
const { routeCarbonCost, computeCo2Savings } = require('./algorithms/carbonPricing');
const { initializeGNNHeuristic } = require('./gnn/heuristicClient');

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const GRAPH_CACHE_PATH = path.join(process.cwd(), 'data', 'graph-cache', 'graph.json');
const FLEET_PATH = path.join(process.cwd(), 'data', 'seed', 'demo-fleet.json');

let _graph = null;

// ─── Graph loader (shared with API Gateway via module cache) ─────────────────
function getGraph() {
  if (_graph) return _graph;
  if (fs.existsSync(GRAPH_CACHE_PATH)) {
    _graph = loadGraph(GRAPH_CACHE_PATH);
  } else {
    // Demo graph fallback
    const g = new GraphStore();
    const stops = [
      { id: 'AMS-CS',  name: 'Amsterdam Centraal', lat: 52.3791, lon: 4.9003 },
      { id: 'AMS-DAM', name: 'Dam Square',          lat: 52.3731, lon: 4.8945 },
      { id: 'AMS-LEI', name: 'Leidseplein',         lat: 52.3638, lon: 4.8836 },
      { id: 'AMS-REM', name: 'Rembrandtplein',      lat: 52.3662, lon: 4.8963 },
      { id: 'AMS-WTR', name: 'Waterlooplein',       lat: 52.3668, lon: 4.9002 },
      { id: 'AMS-OOS', name: 'Oosterpark',          lat: 52.3611, lon: 4.9212 },
      { id: 'AMS-ZUI', name: 'Amsterdam Zuid',      lat: 52.3389, lon: 4.8727 },
      { id: 'AMS-SLO', name: 'Sloterdijk',          lat: 52.3884, lon: 4.8378 },
      { id: 'AMS-ARP', name: 'Amsterdam ArenA',     lat: 52.3138, lon: 4.9413 },
      { id: 'AMS-SCH', name: 'Science Park',        lat: 52.3536, lon: 4.9488 },
    ];
    stops.forEach((s) => g.addNode(s));
    [
      ['AMS-CS',  'AMS-DAM',  1.2, 30], ['AMS-DAM', 'AMS-LEI',  1.8, 30],
      ['AMS-DAM', 'AMS-REM',  1.1, 30], ['AMS-REM', 'AMS-WTR',  0.7, 30],
      ['AMS-WTR', 'AMS-OOS',  1.9, 30], ['AMS-LEI', 'AMS-ZUI',  3.2, 30],
      ['AMS-CS',  'AMS-SLO',  5.1, 50], ['AMS-ZUI', 'AMS-ARP',  8.4, 50],
      ['AMS-OOS', 'AMS-SCH',  2.3, 30], ['AMS-CS',  'AMS-WTR',  1.6, 30],
      ['AMS-REM', 'AMS-OOS',  2.5, 30], ['AMS-DAM', 'AMS-WTR',  0.9, 30],
    ].forEach(([from, to, dist, speed]) => {
      g.addUndirectedEdge(from, to, { distanceKm: dist, freeFlowSpeedKmh: speed, currentSpeedKmh: speed });
    });
    _graph = g;
  }
  return _graph;
}

// ─── Public API (used by api-gateway REST route) ───────────────────────────────
async function optimizeRoute({ originId, destinationId, vehicle, trace = false }) {
  const graph = getGraph();
  const origin = graph.getNode(originId);
  const destination = graph.getNode(destinationId);

  if (!origin) throw new Error(`Origin stop not found: ${originId}`);
  if (!destination) throw new Error(`Destination stop not found: ${destinationId}`);

  // Fetch Vertex AI learned GNN scalar (returns 1.21 fallback for demo)
  const gnnScalar = await initializeGNNHeuristic(origin, destination);

  let result = aStar(graph, origin, destination, vehicle, { recordTrace: trace, gnnScalar });
  let algorithm = 'astar';

  if (!result) {
    result = dijkstra(graph, origin, destination, vehicle);
    algorithm = 'dijkstra';
  }

  if (!result) throw new Error(`No route found from ${originId} to ${destinationId}`);

  const baseline = dijkstra(graph, origin, destination, { id: 'baseline', type: vehicle.type });
  const baselineSegs = baseline ? baseline.segments : result.segments;

  const { totalCo2Kg, totalShadowCostUsd } = routeCarbonCost(result.segments, vehicle.type);
  const { savedCo2Kg, savedUsd, reductionPercent } = computeCo2Savings(baselineSegs, result.segments, vehicle.type);
  const totalDistanceKm = result.segments.reduce((s, seg) => s + seg.distanceKm, 0);

  return {
    vehicleId: vehicle.id,
    algorithm,
    originId,
    destinationId,
    stops: result.nodes.map((n) => ({ id: n.id, name: n.name, lat: n.lat, lon: n.lon })),
    segments: result.segments,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    totalCo2Kg: Math.round(totalCo2Kg * 1000) / 1000,
    totalShadowCostUsd: Math.round(totalShadowCostUsd * 100) / 100,
    co2Savings: {
      savedCo2Kg: Math.round(savedCo2Kg * 1000) / 1000,
      savedUsd: Math.round(savedUsd * 100) / 100,
      reductionPercent: Math.round(reductionPercent * 10) / 10,
    },
    ...(trace ? { trace: result.trace } : {}),
    computedAt: new Date().toISOString(),
  };
}

module.exports = { optimizeRoute, getGraph };

// ─── Standalone mode: Redis subscriber ────────────────────────────────────────
if (require.main === module) {
  (async () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║  GreenRoute AI — Router Agent          ║');
    console.log('╚════════════════════════════════════════╝');

    // ── Cloud Run Health Check (Start Immediately) ───────────────────────────
    const http = require('http');
    const port = process.env.PORT || 8080;
    const server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end('OK');
    });
    server.listen(port, () => console.log(`[router-agent] Health check listening on port ${port}`));

    const graph = getGraph();
    const fleet = fs.existsSync(FLEET_PATH)
      ? JSON.parse(fs.readFileSync(FLEET_PATH, 'utf8'))
      : [];

    let redis, subscriber;
    try {
      redis = new Redis(REDIS_URL, { lazyConnect: true });
      subscriber = new Redis(REDIS_URL, { lazyConnect: true });
      await Promise.all([redis.connect(), subscriber.connect()]);
      console.log(`[router-agent] ✅ Redis connected: ${REDIS_URL}`);
    } catch (err) {
      console.warn(`[router-agent] ⚠️  Redis unavailable: ${err.message}`);
      console.log('[router-agent] API Gateway route optimization still works via REST');
      return;
    }

    const fleetReplanner = new FleetReplanner({ graph, redis, fleet });

    // Subscribe to REPLAN_INSTRUCTION channel
    await subscriber.subscribe('greenroute:replan-instruction');
    subscriber.on('message', async (channel, message) => {
      if (channel === 'greenroute:replan-instruction') {
        const instruction = JSON.parse(message);
        console.log(`[router-agent] 📥 Received replan instruction #${instruction.replanIndex}`);

        // Publish replan:started event
        await redis.publish('greenroute:replan-started', JSON.stringify({
          type: 'replan:started',
          reason: instruction.anomaly?.segmentKey,
          vehiclesAffected: instruction.vehicleIds?.length,
          replanIndex: instruction.replanIndex,
        }));

        await fleetReplanner.executeReplan(instruction);
      }
    });

    // Subscribe to route:updated for API Gateway relay
    await subscriber.subscribe('greenroute:route-updated', 'greenroute:replan-complete', 'greenroute:co2:tick');

    console.log('[router-agent] ✅ Subscribed to replan-instruction channel');
    console.log('[router-agent] Waiting for events from Replanner Agent...');

    const shutdown = async () => {
      console.log('\n[router-agent] Shutting down...');
      server.close();
      await redis.quit();
      await subscriber.quit();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  })().catch((err) => {
    console.error('[router-agent] Fatal:', err);
    process.exit(1);
  });
}

