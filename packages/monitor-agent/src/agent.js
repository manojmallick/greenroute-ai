/**
 * Monitor Agent — full implementation.
 *
 * Responsibilities:
 *   1. Start TrafficMonitor to poll speeds on the city graph
 *   2. Connect AnomalyDetector via TrafficMonitor events
 *   3. Publish REPLAN_NEEDED events to Redis pub/sub when anomalies detected
 *   4. Run Co2Monitor for real-time fleet CO₂ ticks
 *
 * Redis channels:
 *   PUBLISH  greenroute:replan-needed   — triggers Replanner Agent
 *   PUBLISH  greenroute:co2:tick        — drives CO₂ frontend ticker
 */

'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const Redis = require('ioredis');
const { GraphStore } = require('../../router-agent/src/graph/GraphStore');
const { loadGraph, buildGraph } = require('../../router-agent/src/graph/builder');
const { TrafficMonitor } = require('./monitors/trafficMonitor');
const { Co2Monitor } = require('./monitors/co2Monitor');

const GRAPH_CACHE = path.join(process.cwd(), 'data', 'graph-cache', 'graph.json');
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const REPLAN_THRESHOLD_PCT = parseFloat(process.env.REPLAN_THRESHOLD_PERCENT ?? '15');

// ─── Load graph ───────────────────────────────────────────────────────────────
async function loadOrBuildGraph() {
  if (fs.existsSync(GRAPH_CACHE)) {
    return loadGraph(GRAPH_CACHE);
  }
  console.log('[monitor-agent] Graph cache not found — building from demo data');
  const g = new GraphStore();

  // Built-in Amsterdam demo nodes (same as test-route.js)
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
  return g;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  GreenRoute AI — Monitor Agent         ║');
  console.log('╚════════════════════════════════════════╝');

  let redis;
  try {
    redis = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
    await redis.connect();
    console.log(`[monitor-agent] ✅ Redis connected: ${REDIS_URL}`);
  } catch (err) {
    console.warn(`[monitor-agent] ⚠️  Redis unavailable (${err.message}) — running without pub/sub`);
    redis = null;
  }

  const graph = await loadOrBuildGraph();
  console.log(`[monitor-agent] Graph loaded: ${graph.nodeCount} nodes, ${graph.edgeCount} edges`);

  // ── Traffic Monitor ──────────────────────────────────────────────────────
  const trafficMonitor = new TrafficMonitor(graph);

  trafficMonitor.on('anomaly', async (anomaly) => {
    const severity = anomaly.severity;
    console.log(
      `[monitor-agent] 🚨 Anomaly [${severity.toUpperCase()}] ${anomaly.segmentKey}: ` +
      `${anomaly.observedSpeedKmh}km/h (expected ${anomaly.expectedSpeedKmh}km/h, ` +
      `z=${anomaly.zScore}, drop=${anomaly.speedDropPct}%)`
    );

    // Publish REPLAN_NEEDED to Redis
    if (redis) {
      const payload = JSON.stringify({
        type: 'REPLAN_NEEDED',
        reason: 'traffic_spike',
        anomaly,
        timestamp: anomaly.detectedAt,
      });
      await redis.publish('greenroute:replan-needed', payload);
      console.log(`[monitor-agent] 📤 Published REPLAN_NEEDED to Redis`);
    }
  });

  trafficMonitor.on('speeds-updated', ({ count, pollCount }) => {
    if (pollCount % 5 === 0) { // log every 5th poll to reduce noise
      console.log(`[monitor-agent] 📊 Poll #${pollCount}: updated ${count} segments`);
    }
  });

  // ── CO₂ Monitor ──────────────────────────────────────────────────────────
  const co2Monitor = new Co2Monitor({ redis });

  co2Monitor.on('tick', (payload) => {
    console.log(
      `[co2-monitor] 🌍 CO₂: ${payload.cumulativeCo2Kg}kg emitted, ` +
      `${payload.cumulativeSavedKg}kg saved ($${payload.cumulativeSavedUsd})`
    );
  });

  // Subscribe to route updates from Router Agent to feed co2Monitor
  if (redis) {
    const subscriber = redis.duplicate();
    await subscriber.subscribe('greenroute:route-updated');
    subscriber.on('message', (channel, message) => {
      if (channel === 'greenroute:route-updated') {
        const data = JSON.parse(message);
        if (data.vehicleId && data.vehicleType) {
          co2Monitor.updateVehicle(
            data.vehicleId,
            data.vehicleType,
            data.currentSegDistKm ?? 1,
            data.currentSpeedKmh ?? 30
          );
        }
        if (data.savedCo2Kg > 0) {
          co2Monitor.recordSavings(data.savedCo2Kg, data.savedUsd ?? 0);
        }
      }
    });
  }

  trafficMonitor.start();
  co2Monitor.start();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[monitor-agent] Shutting down...');
    trafficMonitor.stop();
    co2Monitor.stop();
    if (redis) await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[monitor-agent] Fatal error:', err);
  process.exit(1);
});
