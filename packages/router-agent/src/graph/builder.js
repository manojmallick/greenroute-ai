/**
 * GTFS → GraphStore builder.
 *
 * Parses Amsterdam GTFS stops.txt and stop_times.txt to build
 * an adjacency-list graph where:
 *   - Nodes = transit stops (with lat/lon)
 *   - Edges = sequential stop connections within a trip
 *
 * Edge weights are computed from:
 *   - distanceKm: haversine distance between stops
 *   - freeFlowSpeedKmh: estimated from trip type (bus=30, tram=20, metro=40)
 *   - currentSpeedKmh: initialized to freeFlowSpeedKmh (updated by Monitor Agent at runtime)
 *
 * Usage:
 *   const graph = await buildGraph({ gtfsDir: 'data/gtfs', outputPath: 'data/graph-cache/graph.json' });
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { GraphStore } = require('./GraphStore');
const { haversineKm } = require('../algorithms/astar');

// Default free-flow speeds by GTFS route_type
const ROUTE_TYPE_SPEEDS = {
  0: 20,  // tram
  1: 40,  // metro/subway
  2: 80,  // rail
  3: 30,  // bus
  4: 15,  // ferry
  5: 10,  // cable car
  6: 25,  // gondola
  7: 15,  // funicular
};
const DEFAULT_SPEED = 30;

/**
 * Parse a CSV line respecting quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Stream-parse a GTFS CSV file.
 * @param {string} filePath
 * @returns {Promise<{ headers: string[], rows: Record<string, string>[] }>}
 */
async function parseGtfsFile(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let headers = null;
  const rows = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    if (!headers) {
      headers = fields;
      continue;
    }
    const row = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = fields[i] ?? '';
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Build a GraphStore from GTFS data.
 *
 * @param {object} options
 * @param {string} options.gtfsDir — path to directory containing GTFS .txt files
 * @param {string} [options.outputPath] — if set, write graph JSON to this path
 * @param {number} [options.maxStops] — limit stops loaded (for testing)
 * @returns {Promise<GraphStore>}
 */
async function buildGraph({ gtfsDir, outputPath, maxStops } = {}) {
  const gtfs = gtfsDir ?? path.join(process.cwd(), 'data', 'gtfs');

  console.log(`[builder] Loading GTFS data from: ${gtfs}`);

  // ── 1. Load stops ──────────────────────────────────────────────────────────
  const stopsFile = path.join(gtfs, 'stops.txt');
  if (!fs.existsSync(stopsFile)) {
    throw new Error(`stops.txt not found at ${stopsFile}. Download GTFS data first.`);
  }

  const { rows: stopRows } = await parseGtfsFile(stopsFile);
  const graph = new GraphStore();

  let stopCount = 0;
  for (const row of stopRows) {
    if (maxStops && stopCount >= maxStops) break;
    const lat = parseFloat(row.stop_lat);
    const lon = parseFloat(row.stop_lon);
    if (isNaN(lat) || isNaN(lon)) continue;

    graph.addNode({
      id: row.stop_id,
      lat,
      lon,
      name: row.stop_name,
    });
    stopCount++;
  }

  console.log(`[builder] Loaded ${graph.nodeCount} stops`);

  // ── 2. Load trips ──────────────────────────────────────────────────────────
  let routeTypeMap = {}; // trip_id → route_type (for speed lookup)

  const routesFile = path.join(gtfs, 'routes.txt');
  const tripsFile = path.join(gtfs, 'trips.txt');

  if (fs.existsSync(routesFile) && fs.existsSync(tripsFile)) {
    const { rows: routeRows } = await parseGtfsFile(routesFile);
    const routeType = {};
    for (const r of routeRows) {
      routeType[r.route_id] = parseInt(r.route_type ?? '3', 10);
    }
    const { rows: tripRows } = await parseGtfsFile(tripsFile);
    for (const t of tripRows) {
      routeTypeMap[t.trip_id] = routeType[t.route_id] ?? 3;
    }
  }

  // ── 3. Load stop_times → build edges ──────────────────────────────────────
  const stopTimesFile = path.join(gtfs, 'stop_times.txt');
  if (!fs.existsSync(stopTimesFile)) {
    console.warn('[builder] stop_times.txt not found — graph will have no edges. Using proximity edges instead.');
    addProximityEdges(graph);
  } else {
    await addStopTimeEdges(graph, stopTimesFile, routeTypeMap);
  }

  console.log(`[builder] Graph built: ${graph.nodeCount} nodes, ${graph.edgeCount} edges`);

  // ── 4. Write cache ─────────────────────────────────────────────────────────
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(graph.toJSON(), null, 2));
    console.log(`[builder] Graph cache written to: ${outputPath}`);
  }

  return graph;
}

/**
 * Add edges from stop_times.txt (consecutive stops in each trip).
 * @param {GraphStore} graph
 * @param {string} stopTimesFile
 * @param {Record<string, number>} routeTypeMap
 */
async function addStopTimeEdges(graph, stopTimesFile, routeTypeMap) {
  const { rows } = await parseGtfsFile(stopTimesFile);

  // Group by trip_id, sorted by stop_sequence
  const trips = {};
  for (const row of rows) {
    const tid = row.trip_id;
    if (!trips[tid]) trips[tid] = [];
    trips[tid].push(row);
  }

  let edgeCount = 0;
  const added = new Set(); // avoid duplicate edges

  for (const [tripId, stops] of Object.entries(trips)) {
    stops.sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
    const speed = ROUTE_TYPE_SPEEDS[routeTypeMap[tripId]] ?? DEFAULT_SPEED;

    for (let i = 0; i < stops.length - 1; i++) {
      const fromId = stops[i].stop_id;
      const toId = stops[i + 1].stop_id;
      const key = `${fromId}→${toId}`;
      if (added.has(key)) continue;
      added.add(key);

      const fromNode = graph.getNode(fromId);
      const toNode = graph.getNode(toId);
      if (!fromNode || !toNode) continue;

      const distanceKm = haversineKm(fromNode, toNode);
      if (distanceKm < 0.01) continue; // skip duplicate stops

      try {
        graph.addEdge(fromId, {
          to: toId,
          distanceKm,
          freeFlowSpeedKmh: speed,
          currentSpeedKmh: speed,
        });
        edgeCount++;
      } catch (_) {
        // Node not found — skip
      }
    }
  }

  console.log(`[builder] Added ${edgeCount} edges from stop_times`);
}

/**
 * Fallback: add edges between stops within 1km of each other.
 * Used when stop_times.txt is unavailable.
 * @param {GraphStore} graph
 */
function addProximityEdges(graph) {
  const nodes = graph.allNodes();
  let edgeCount = 0;
  const MAX_KM = 1.0;
  const SPEED = 30;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = haversineKm(nodes[i], nodes[j]);
      if (dist <= MAX_KM) {
        graph.addUndirectedEdge(nodes[i].id, nodes[j].id, {
          distanceKm: dist,
          freeFlowSpeedKmh: SPEED,
          currentSpeedKmh: SPEED,
        });
        edgeCount += 2;
      }
    }
  }

  console.log(`[builder] Added ${edgeCount} proximity edges (fallback mode)`);
}

/**
 * Load a pre-built graph from a JSON cache file.
 * @param {string} cachePath
 * @returns {GraphStore}
 */
function loadGraph(cachePath) {
  const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  const graph = GraphStore.fromJSON(data);
  console.log(`[builder] Loaded graph from cache: ${graph.nodeCount} nodes, ${graph.edgeCount} edges`);
  return graph;
}

module.exports = { buildGraph, loadGraph, parseGtfsFile };
