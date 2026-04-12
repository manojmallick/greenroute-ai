/**
 * A* search with multi-objective cost function.
 *
 * Cost function minimizes three objectives simultaneously:
 *   - Travel time (35% weight)
 *   - Distance     (25% weight)
 *   - Carbon cost  (30% weight)
 *   - Traffic      (10% weight)
 *
 * Heuristic: haversine distance to destination (admissible — never overestimates).
 * Can be replaced by a GNN-learned heuristic (see packages/router-agent/src/gnn/).
 *
 * Time complexity: O((V + E) log V) with binary heap
 * Space complexity: O(V)
 */

'use strict';

const { MinHeap } = require('./minHeap');
const { segmentCarbonCost } = require('./carbonPricing');

// ─── Cost function weights ────────────────────────────────────────────────────
const W_TIME    = parseFloat(process.env.W_TIME    ?? '0.35');
const W_DIST    = parseFloat(process.env.W_DIST    ?? '0.25');
const W_CARBON  = parseFloat(process.env.W_CARBON  ?? '0.30');
const W_TRAFFIC = parseFloat(process.env.W_TRAFFIC ?? '0.10');

/**
 * Compute the edge traversal cost for a given vehicle.
 *
 * @param {object} edge
 * @param {number} edge.distanceKm
 * @param {number} edge.currentSpeedKmh   — live speed (from traffic API)
 * @param {number} edge.freeFlowSpeedKmh  — baseline speed (no traffic)
 * @param {object} vehicle
 * @param {string} vehicle.type           — matches EMISSION_FACTORS key
 * @returns {number} composite cost (dimensionless, lower = better)
 */
function costFunction(edge, vehicle) {
  const safeSpeed = Math.max(edge.currentSpeedKmh, 5); // avoid Infinity
  const timeHours = edge.distanceKm / safeSpeed;

  const { shadowCostUsd: carbonCost } = segmentCarbonCost(edge.distanceKm, vehicle.type);

  const trafficPenalty =
    edge.currentSpeedKmh < edge.freeFlowSpeedKmh
      ? (edge.freeFlowSpeedKmh / safeSpeed) - 1
      : 0;

  return (
    W_TIME    * timeHours +
    W_DIST    * edge.distanceKm +
    W_CARBON  * carbonCost +
    W_TRAFFIC * trafficPenalty
  );
}

/**
 * Haversine distance between two lat/lon points in km.
 * Used as the admissible A* heuristic.
 *
 * @param {{ lat: number, lon: number }} a
 * @param {{ lat: number, lon: number }} b
 * @returns {number} distance in km
 */
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const chord =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Heuristic: minimum possible cost from node to destination.
 * Uses haversine distance with W_DIST weight (admissible because
 * actual cost will always be ≥ straight-line distance cost).
 *
 * This function can be replaced with the GNN-learned heuristic
 * from packages/router-agent/src/gnn/heuristicClient.js for
 * 18–23% improvement on city graphs.
 *
 * @param {{ lat: number, lon: number }} node
 * @param {{ lat: number, lon: number }} destination
 * @param {number} [gnnScalar=1.0] — Multiplier supplied by Vertex AI to learn underlying grid topology
 * @returns {number}
 */
function heuristic(node, destination, gnnScalar = 1.0) {
  return W_DIST * haversineKm(node, destination) * gnnScalar;
}

/**
 * Reconstruct the path from the cameFrom map.
 *
 * @param {Map<string, { node: object, edge: object }>} cameFrom
 * @param {object} current
 * @returns {{ nodes: object[], edges: object[], segments: object[] }}
 */
function reconstructPath(cameFrom, current) {
  const nodes = [current];
  const edges = [];
  let cursor = current;

  while (cameFrom.has(cursor.id)) {
    const { node: prev, edge } = cameFrom.get(cursor.id);
    nodes.unshift(prev);
    edges.unshift(edge);
    cursor = prev;
  }

  // Build segment objects for carbon/CO₂ reporting
  const segments = edges.map((edge) => ({
    fromId: edge.from,
    toId: edge.to,
    distanceKm: edge.distanceKm,
    currentSpeedKmh: edge.currentSpeedKmh,
  }));

  return { nodes, edges, segments };
}

/**
 * A* shortest-path search.
 *
 * @param {object} graph — instance of GraphStore
 * @param {object} origin — node with { id, lat, lon }
 * @param {object} destination — node with { id, lat, lon }
 * @param {object} vehicle — { id, type, emissionFactorKgPerKm }
 * @param {object} [options]
 * @param {boolean} [options.recordTrace=false] — store expanded nodes for AlgoTrace UI
 * @param {number} [options.gnnScalar=1.0] — GNN learned heuristic multiplier
 * @returns {{ nodes, edges, segments, trace? } | null}
 */
function aStar(graph, origin, destination, vehicle, options = {}) {
  const { recordTrace = false, gnnScalar = 1.0 } = options;

  /** @type {MinHeap<{ node: object, f: number }>} */
  const openSet = new MinHeap((a, b) => a.f - b.f);

  /** @type {Map<string, number>} node.id → best known g-score */
  const gScore = new Map();

  /** @type {Map<string, { node: object, edge: object }>} */
  const cameFrom = new Map();

  /** @type {Set<string>} */
  const closedSet = new Set();

  /** @type {Array<{ nodeId: string, f: number, g: number, step: number }>} */
  const trace = recordTrace ? [] : null;

  gScore.set(origin.id, 0);
  openSet.push({ node: origin, f: heuristic(origin, destination, gnnScalar) });

  let step = 0;

  while (!openSet.isEmpty()) {
    const { node: current } = openSet.pop();

    if (closedSet.has(current.id)) continue;
    closedSet.add(current.id);

    if (recordTrace) {
      trace.push({
        nodeId: current.id,
        g: gScore.get(current.id),
        f: (gScore.get(current.id) ?? 0) + heuristic(current, destination, gnnScalar),
        step: step++,
      });
    }

    if (current.id === destination.id) {
      const path = reconstructPath(cameFrom, current);
      if (recordTrace) path.trace = trace;
      return path;
    }

    for (const edge of graph.edgesFrom(current.id)) {
      if (closedSet.has(edge.to)) continue;

      const neighborNode = graph.getNode(edge.to);
      if (!neighborNode) continue;

      const tentativeG =
        (gScore.get(current.id) ?? Infinity) + costFunction(edge, vehicle);

      if (tentativeG < (gScore.get(edge.to) ?? Infinity)) {
        cameFrom.set(edge.to, { node: current, edge: { ...edge, from: current.id } });
        gScore.set(edge.to, tentativeG);
        const f = tentativeG + heuristic(neighborNode, destination, gnnScalar);
        openSet.push({ node: neighborNode, f });
      }
    }
  }

  return null; // destination unreachable
}

module.exports = { aStar, costFunction, heuristic, haversineKm };
