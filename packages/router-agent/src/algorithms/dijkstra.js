/**
 * Dijkstra's algorithm — single-source shortest paths.
 *
 * Used as a fallback when A* heuristic is unavailable (e.g., no lat/lon data)
 * and for computing shortest-path baselines (before CO₂ optimization).
 *
 * Unlike A*, Dijkstra explores all reachable nodes in cost order.
 * It is guaranteed optimal when all edge costs are non-negative.
 *
 * Time complexity: O((V + E) log V) with binary heap
 * Space complexity: O(V)
 */

'use strict';

const { MinHeap } = require('./minHeap');
const { costFunction } = require('./astar');

/**
 * Dijkstra shortest-path from origin to destination (or all reachable nodes).
 *
 * @param {object} graph — GraphStore instance
 * @param {object} origin — { id, lat, lon }
 * @param {object} destination — { id } or null (to get full SSSP map)
 * @param {object} vehicle — { id, type }
 * @returns {{ nodes, edges, segments } | null}
 */
function dijkstra(graph, origin, destination, vehicle) {
  /** @type {MinHeap<{ id: string, cost: number }>} */
  const pq = new MinHeap((a, b) => a.cost - b.cost);

  /** @type {Map<string, number>} */
  const dist = new Map();

  /** @type {Map<string, { node: object, edge: object }>} */
  const prev = new Map();

  /** @type {Set<string>} */
  const visited = new Set();

  dist.set(origin.id, 0);
  pq.push({ id: origin.id, cost: 0 });

  while (!pq.isEmpty()) {
    const { id: currentId } = pq.pop();
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    if (destination && currentId === destination.id) break;

    for (const edge of graph.edgesFrom(currentId)) {
      if (visited.has(edge.to)) continue;

      const neighborNode = graph.getNode(edge.to);
      if (!neighborNode) continue;

      const newCost = (dist.get(currentId) ?? Infinity) + costFunction(edge, vehicle);
      if (newCost < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, newCost);
        prev.set(edge.to, {
          node: graph.getNode(currentId),
          edge: { ...edge, from: currentId },
        });
        pq.push({ id: edge.to, cost: newCost });
      }
    }
  }

  if (!destination) {
    // Return full SSSP distances map
    return { dist, prev };
  }

  if (!dist.has(destination.id)) return null; // unreachable

  // Reconstruct path
  const nodes = [];
  const edges = [];
  let cursor = destination.id;

  while (cursor !== origin.id) {
    const entry = prev.get(cursor);
    if (!entry) return null;
    nodes.unshift(entry.node);
    edges.unshift(entry.edge);
    cursor = entry.edge.from;
  }
  nodes.unshift(origin);

  const segments = edges.map((e) => ({
    fromId: e.from,
    toId: e.to,
    distanceKm: e.distanceKm,
    currentSpeedKmh: e.currentSpeedKmh,
  }));

  return { nodes, edges, segments };
}

module.exports = { dijkstra };
