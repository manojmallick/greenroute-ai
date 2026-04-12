/**
 * GraphStore — in-memory adjacency list graph with optional Redis caching.
 *
 * Nodes represent stops/waypoints: { id, lat, lon, name? }
 * Edges represent road segments: { to, distanceKm, freeFlowSpeedKmh, currentSpeedKmh }
 *
 * The graph is built once from GTFS data by scripts/build-graph.js,
 * then optionally cached in Redis. At runtime, the Monitor Agent
 * updates currentSpeedKmh values when traffic data changes.
 */

'use strict';

/**
 * @typedef {object} GraphNode
 * @property {string} id
 * @property {number} lat
 * @property {number} lon
 * @property {string} [name]
 */

/**
 * @typedef {object} GraphEdge
 * @property {string} to             — destination node id
 * @property {number} distanceKm
 * @property {number} freeFlowSpeedKmh
 * @property {number} currentSpeedKmh  — updated by Monitor Agent
 */

class GraphStore {
  constructor() {
    /** @type {Map<string, GraphNode>} */
    this._nodes = new Map();

    /** @type {Map<string, GraphEdge[]>} */
    this._edges = new Map();
  }

  // ─── Building ─────────────────────────────────────────────────────────────

  /**
   * Add a node. Idempotent — re-adding with same id updates the node.
   * @param {GraphNode} node
   */
  addNode(node) {
    this._nodes.set(node.id, node);
    if (!this._edges.has(node.id)) {
      this._edges.set(node.id, []);
    }
  }

  /**
   * Add a directed edge from → to.
   * @param {string} fromId
   * @param {GraphEdge} edge
   */
  addEdge(fromId, edge) {
    if (!this._nodes.has(fromId)) {
      throw new Error(`Source node "${fromId}" not found. Add the node before adding edges.`);
    }
    if (!this._nodes.has(edge.to)) {
      throw new Error(`Target node "${edge.to}" not found. Add the node before adding edges.`);
    }
    const list = this._edges.get(fromId) ?? [];
    list.push(edge);
    this._edges.set(fromId, list);
  }

  /**
   * Add an undirected edge (both directions).
   * @param {string} aId
   * @param {string} bId
   * @param {Omit<GraphEdge, 'to'>} edgeProps
   */
  addUndirectedEdge(aId, bId, edgeProps) {
    this.addEdge(aId, { ...edgeProps, to: bId });
    this.addEdge(bId, { ...edgeProps, to: aId });
  }

  // ─── Querying ─────────────────────────────────────────────────────────────

  /**
   * @param {string} id
   * @returns {GraphNode | undefined}
   */
  getNode(id) {
    return this._nodes.get(id);
  }

  /**
   * @param {string} fromId
   * @returns {GraphEdge[]}
   */
  edgesFrom(fromId) {
    return this._edges.get(fromId) ?? [];
  }

  /** @returns {number} */
  get nodeCount() {
    return this._nodes.size;
  }

  /** @returns {number} */
  get edgeCount() {
    let total = 0;
    for (const list of this._edges.values()) total += list.length;
    return total;
  }

  /** @returns {GraphNode[]} */
  allNodes() {
    return [...this._nodes.values()];
  }

  // ─── Traffic updates (Monitor Agent integration) ──────────────────────────

  /**
   * Update the live speed on a specific edge (called by Monitor Agent).
   * @param {string} fromId
   * @param {string} toId
   * @param {number} newSpeedKmh
   */
  updateEdgeSpeed(fromId, toId, newSpeedKmh) {
    const edges = this._edges.get(fromId);
    if (!edges) return;
    for (const edge of edges) {
      if (edge.to === toId) {
        edge.currentSpeedKmh = Math.max(newSpeedKmh, 1);
      }
    }
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  /**
   * Export graph to a plain JSON-serializable object.
   * Used by scripts/build-graph.js to write graph cache to disk.
   * @returns {{ nodes: GraphNode[], edges: Record<string, GraphEdge[]> }}
   */
  toJSON() {
    const nodes = [...this._nodes.values()];
    const edges = {};
    for (const [fromId, list] of this._edges.entries()) {
      edges[fromId] = list;
    }
    return { nodes, edges };
  }

  /**
   * Reconstruct a GraphStore from a toJSON() result.
   * @param {{ nodes: GraphNode[], edges: Record<string, GraphEdge[]> }} data
   * @returns {GraphStore}
   */
  static fromJSON(data) {
    const store = new GraphStore();
    for (const node of data.nodes) {
      store.addNode(node);
    }
    for (const [fromId, list] of Object.entries(data.edges)) {
      for (const edge of list) {
        // Direct push to avoid duplicate validation cost on load
        const dest = store._edges.get(fromId) ?? [];
        dest.push(edge);
        store._edges.set(fromId, dest);
      }
    }
    return store;
  }
}

module.exports = { GraphStore };
