#!/usr/bin/env node
/**
 * scripts/test-route.js
 *
 * CLI demonstration: run A* on two stops and print the optimized route with CO₂ cost.
 * This is the Week 1 deliverable — proves the algorithm works end-to-end.
 *
 * Usage:
 *   node scripts/test-route.js
 *   node scripts/test-route.js --from 9400390 --to 9400391 --vehicle electric_van
 *   node scripts/test-route.js --graph ./data/graph-cache/graph.json --trace
 *
 * If no graph cache exists, runs with a built-in demo graph (Amsterdam city center).
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { aStar } = require('../packages/router-agent/src/algorithms/astar');
const { dijkstra } = require('../packages/router-agent/src/algorithms/dijkstra');
const { routeCarbonCost, computeCo2Savings, EMISSION_FACTORS } = require('../packages/router-agent/src/algorithms/carbonPricing');
const { GraphStore } = require('../packages/router-agent/src/graph/GraphStore');
const { loadGraph } = require('../packages/router-agent/src/graph/builder');

// ─── Parse args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : def;
};
const hasFlag = (f) => args.includes(f);

const graphPath = getArg('--graph', path.join(process.cwd(), 'data', 'graph-cache', 'graph.json'));
const fromArg   = getArg('--from', null);
const toArg     = getArg('--to', null);
const vType     = getArg('--vehicle', 'diesel_van');
const withTrace = hasFlag('--trace');

// ─── Load (or build demo) graph ────────────────────────────────────────────────
function buildDemoGraph() {
  console.log('ℹ️  No graph cache found — using built-in Amsterdam demo graph');
  console.log('   Run: node scripts/build-graph.js  (after downloading GTFS data)\n');

  const g = new GraphStore();

  // A realistic Amsterdam city-center mini-graph (10 stops)
  const stops = [
    { id: 'AMS-CS',   name: 'Amsterdam Centraal',       lat: 52.3791, lon: 4.9003 },
    { id: 'AMS-DAM',  name: 'Dam Square',               lat: 52.3731, lon: 4.8945 },
    { id: 'AMS-LEI',  name: 'Leidseplein',              lat: 52.3638, lon: 4.8836 },
    { id: 'AMS-REM',  name: 'Rembrandtplein',           lat: 52.3662, lon: 4.8963 },
    { id: 'AMS-WTR',  name: 'Waterlooplein',            lat: 52.3668, lon: 4.9002 },
    { id: 'AMS-OOS',  name: 'Oosterpark',               lat: 52.3611, lon: 4.9212 },
    { id: 'AMS-ZUI',  name: 'Amsterdam Zuid',           lat: 52.3389, lon: 4.8727 },
    { id: 'AMS-SLO',  name: 'Sloterdijk',              lat: 52.3884, lon: 4.8378 },
    { id: 'AMS-ARP',  name: 'Amsterdam Arena (ArenA)',  lat: 52.3138, lon: 4.9413 },
    { id: 'AMS-SCH',  name: 'Science Park',             lat: 52.3536, lon: 4.9488 },
  ];

  stops.forEach((s) => g.addNode(s));

  // Road connections (undirected)
  const roads = [
    ['AMS-CS',  'AMS-DAM',  1.2],
    ['AMS-DAM', 'AMS-LEI',  1.8],
    ['AMS-DAM', 'AMS-REM',  1.1],
    ['AMS-REM', 'AMS-WTR',  0.7],
    ['AMS-WTR', 'AMS-OOS',  1.9],
    ['AMS-LEI', 'AMS-ZUI',  3.2],
    ['AMS-CS',  'AMS-SLO',  5.1],
    ['AMS-ZUI', 'AMS-ARP',  8.4],
    ['AMS-OOS', 'AMS-SCH',  2.3],
    ['AMS-CS',  'AMS-WTR',  1.6],
    ['AMS-REM', 'AMS-OOS',  2.5],
    ['AMS-DAM', 'AMS-WTR',  0.9],
  ];

  roads.forEach(([from, to, dist]) => {
    g.addUndirectedEdge(from, to, {
      distanceKm: dist,
      freeFlowSpeedKmh: 30,
      currentSpeedKmh: 20 + Math.random() * 20, // Simulate some traffic variation
    });
  });

  return g;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  GreenRoute AI — Route Optimizer Test                     ║');
  console.log('║  Algorithm: A* with multi-objective cost function         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Load graph
  let graph;
  if (fs.existsSync(graphPath)) {
    graph = loadGraph(graphPath);
  } else {
    graph = buildDemoGraph();
  }

  // Pick stops
  const allNodes = graph.allNodes();
  if (allNodes.length < 2) {
    console.error('❌ Graph has fewer than 2 nodes. Build the graph first.');
    process.exit(1);
  }

  let origin, destination;
  if (fromArg && toArg) {
    origin = graph.getNode(fromArg);
    destination = graph.getNode(toArg);
    if (!origin) { console.error(`❌ Stop not found: ${fromArg}`); process.exit(1); }
    if (!destination) { console.error(`❌ Stop not found: ${toArg}`); process.exit(1); }
  } else {
    // Random pair — ensure they're different
    const shuffled = allNodes.sort(() => Math.random() - 0.5);
    origin = shuffled[0];
    destination = shuffled[1];
  }

  const vehicle = { id: 'TEST-VAN', type: vType };

  if (!EMISSION_FACTORS[vType]) {
    console.error(`❌ Unknown vehicle type: ${vType}`);
    console.error(`   Valid types: ${Object.keys(EMISSION_FACTORS).join(', ')}`);
    process.exit(1);
  }

  console.log(`🚐 Vehicle:      ${vehicle.id} (${vType})`);
  console.log(`📍 From:         ${origin.name ?? origin.id} (${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)})`);
  console.log(`🏁 To:           ${destination.name ?? destination.id} (${destination.lat.toFixed(4)}, ${destination.lon.toFixed(4)})`);
  console.log('');
  console.log('Running A* search...');

  const startMs = Date.now();
  const result = aStar(graph, origin, destination, vehicle, { recordTrace: withTrace });
  const elapsed = Date.now() - startMs;

  if (!result) {
    console.log('⚠️  A* found no direct path. Falling back to Dijkstra...');
    const fallback = dijkstra(graph, origin, destination, vehicle);
    if (!fallback) {
      console.error(`❌ No route found between ${origin.id} and ${destination.id}`);
      process.exit(1);
    }
    Object.assign(result ?? {}, fallback);
  }

  // Compute carbon stats
  const { totalCo2Kg, totalShadowCostUsd } = routeCarbonCost(result.segments, vType);
  const totalDistKm = result.segments.reduce((s, seg) => s + seg.distanceKm, 0);

  // Baseline: Dijkstra without optimization focus (for comparison)
  const baselineResult = dijkstra(graph, origin, destination, { id: 'baseline', type: vType });
  const savings = baselineResult
    ? computeCo2Savings(baselineResult.segments, result.segments, vType)
    : { savedCo2Kg: 0, savedUsd: 0, reductionPercent: 0 };

  // ─── Output ───────────────────────────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  OPTIMIZED ROUTE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  console.log('📍 Stops:');
  result.nodes.forEach((node, i) => {
    const marker = i === 0 ? '🟢' : i === result.nodes.length - 1 ? '🏁' : '·';
    console.log(`   ${marker} ${(node.name ?? node.id).padEnd(35)} lat:${node.lat.toFixed(4)} lon:${node.lon.toFixed(4)}`);
  });

  console.log('');
  console.log('📊 Route Stats:');
  console.log(`   Total distance:    ${totalDistKm.toFixed(2)} km`);
  console.log(`   Stops visited:     ${result.nodes.length}`);
  console.log(`   Compute time:      ${elapsed}ms`);
  console.log('');
  console.log('🌍 Carbon Report (DEFRA 2024):');
  console.log(`   CO₂ emitted:       ${totalCo2Kg.toFixed(3)} kg CO₂e`);
  console.log(`   Carbon cost:       $${totalShadowCostUsd.toFixed(4)} USD (@ $85/tonne)`);
  console.log(`   Equivalent to:     ${(totalCo2Kg / 0.12).toFixed(1)} km by car`);

  if (savings.savedCo2Kg > 0) {
    console.log('');
    console.log('💚 Savings vs baseline route:');
    console.log(`   CO₂ saved:         ${savings.savedCo2Kg.toFixed(3)} kg (${savings.reductionPercent.toFixed(1)}% reduction)`);
    console.log(`   Cost saved:        $${savings.savedUsd.toFixed(4)} USD`);
  }

  if (withTrace && result.trace) {
    console.log('');
    console.log('🔍 A* Trace (first 10 expanded nodes):');
    result.trace.slice(0, 10).forEach((t) => {
      console.log(`   step ${String(t.step).padStart(3)}: node=${t.nodeId.padEnd(20)} g=${t.g?.toFixed(4)} f=${t.f?.toFixed(4)}`);
    });
    if (result.trace.length > 10) {
      console.log(`   ... and ${result.trace.length - 10} more nodes (full trace available via /api/algorithm/trace)`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Route optimization complete!');
  console.log('');
  console.log('Next steps:');
  console.log('  npm start              # Start API Gateway on :3000');
  console.log('  docker-compose up      # Start full stack');
  console.log('');
}

main();
