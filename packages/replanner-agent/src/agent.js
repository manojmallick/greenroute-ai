/**
 * Replanner Agent — full implementation.
 *
 * Subscribes to Redis greenroute:replan-needed events from Monitor Agent.
 * Calls Gemini 1.5 Pro to decide whether and how to trigger the Router Agent.
 * Publishes greenroute:replan-instruction to wake up the Router Agent.
 *
 * Runs independently as its own process / Cloud Run service.
 */

'use strict';

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const Redis = require('ioredis');
const { ReplanDecider } = require('./decision/replanDecider');
const { GraphStore } = require('../../router-agent/src/graph/GraphStore');

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const GRAPH_CACHE = path.join(process.cwd(), 'data', 'graph-cache', 'graph.json');

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  GreenRoute AI — Replanner Agent       ║');
  console.log('╚════════════════════════════════════════╝');

  // ── Redis connections (two: one pub, one sub) ─────────────────────────────
  let redis, subscriber;
  try {
    redis = new Redis(REDIS_URL, { lazyConnect: true });
    subscriber = new Redis(REDIS_URL, { lazyConnect: true });
    await Promise.all([redis.connect(), subscriber.connect()]);
    console.log(`[replanner-agent] ✅ Redis connected: ${REDIS_URL}`);
  } catch (err) {
    console.warn(`[replanner-agent] ⚠️  Redis unavailable: ${err.message}`);
    redis = null;
    subscriber = null;
  }

  // ── Load graph ────────────────────────────────────────────────────────────
  let graph;
  if (fs.existsSync(GRAPH_CACHE)) {
    const data = JSON.parse(fs.readFileSync(GRAPH_CACHE, 'utf8'));
    graph = GraphStore.fromJSON(data);
    console.log(`[replanner-agent] Graph loaded: ${graph.nodeCount} nodes`);
  } else {
    // Minimal demo graph
    graph = new GraphStore();
    graph.addNode({ id: 'AMS-CS', lat: 52.3791, lon: 4.9003, name: 'Amsterdam Centraal' });
    graph.addNode({ id: 'AMS-DAM', lat: 52.3731, lon: 4.8945, name: 'Dam Square' });
    graph.addUndirectedEdge('AMS-CS', 'AMS-DAM', { distanceKm: 1.2, freeFlowSpeedKmh: 30, currentSpeedKmh: 30 });
    console.log('[replanner-agent] Using minimal demo graph');
  }

  // ── Load demo fleet ───────────────────────────────────────────────────────
  const fleetPath = path.join(process.cwd(), 'data', 'seed', 'demo-fleet.json');
  const fleet = fs.existsSync(fleetPath)
    ? JSON.parse(fs.readFileSync(fleetPath, 'utf8'))
    : [];
  console.log(`[replanner-agent] Fleet: ${fleet.length} vehicles`);

  // ── Start ReplanDecider ───────────────────────────────────────────────────
  if (redis && subscriber) {
    const decider = new ReplanDecider({ redis, subscriber, graph, fleet });
    await decider.start();
    console.log('[replanner-agent] ✅ Listening for REPLAN_NEEDED events...');
  } else {
    console.log('[replanner-agent] ⚠️  No Redis — running in offline mode');
    console.log('[replanner-agent] Use scripts/simulate-traffic-spike.js to test manually');
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[replanner-agent] Shutting down...');
    if (redis) await redis.quit();
    if (subscriber) await subscriber.quit();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[replanner-agent] Fatal:', err);
  process.exit(1);
});
