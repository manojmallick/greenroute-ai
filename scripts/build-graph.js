#!/usr/bin/env node
/**
 * scripts/build-graph.js
 *
 * Parse Amsterdam GTFS data → build adjacency-list GraphStore → write to cache.
 *
 * Usage:
 *   node scripts/build-graph.js
 *   node scripts/build-graph.js --gtfs-dir ./data/gtfs --output ./data/graph-cache/graph.json
 *   node scripts/build-graph.js --max-stops 500   # fast test run with 500 stops
 *
 * GTFS download:
 *   mkdir -p data/gtfs
 *   curl -L https://gtfs.ovapi.nl/nl/gtfs-nl.zip -o data/gtfs/gtfs-nl.zip
 *   cd data/gtfs && unzip gtfs-nl.zip && cd ../..
 */

'use strict';

const path = require('path');
const { buildGraph } = require('../packages/router-agent/src/graph/builder');

// ─── Parse CLI args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const gtfsDir = getArg('--gtfs-dir') ?? path.join(process.cwd(), 'data', 'gtfs');
const outputPath = getArg('--output') ?? path.join(process.cwd(), 'data', 'graph-cache', 'graph.json');
const maxStops = getArg('--max-stops') ? parseInt(getArg('--max-stops'), 10) : undefined;

// ─── Run ──────────────────────────────────────────────────────────────────────
console.log('╔═══════════════════════════════════════╗');
console.log('║  GreenRoute AI — Graph Builder        ║');
console.log('╚═══════════════════════════════════════╝');
console.log(`GTFS dir:    ${gtfsDir}`);
console.log(`Output:      ${outputPath}`);
if (maxStops) console.log(`Max stops:   ${maxStops}`);
console.log('');

const startMs = Date.now();

buildGraph({ gtfsDir, outputPath, maxStops })
  .then((graph) => {
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(2);
    console.log('');
    console.log('✅ Graph built successfully!');
    console.log(`   Nodes:    ${graph.nodeCount.toLocaleString()}`);
    console.log(`   Edges:    ${graph.edgeCount.toLocaleString()}`);
    console.log(`   Time:     ${elapsed}s`);
    console.log(`   Cache:    ${outputPath}`);
    console.log('');
    console.log('Next: node scripts/test-route.js');
  })
  .catch((err) => {
    console.error('');
    console.error('❌ Graph build failed:', err.message);
    if (err.message.includes('stops.txt not found')) {
      console.error('');
      console.error('Download Amsterdam GTFS data:');
      console.error('  mkdir -p data/gtfs');
      console.error('  curl -L https://gtfs.ovapi.nl/nl/gtfs-nl.zip -o data/gtfs/gtfs-nl.zip');
      console.error('  cd data/gtfs && unzip gtfs-nl.zip && cd ../..');
    }
    process.exit(1);
  });
