/**
 * Traffic Monitor — polls Google Maps Directions API for real-time speeds
 * and updates the shared graph.
 *
 * In development (no GOOGLE_MAPS_API_KEY), runs in simulation mode:
 *   - Simulates random traffic spikes on random segments
 *   - Makes the demo self-contained without requiring API keys
 *
 * In production, calls:
 *   GET https://maps.googleapis.com/maps/api/directions/json
 *     ?origin=lat,lon&destination=lat,lon&departure_time=now&key=...
 *
 * Emits 'anomaly' events when Z-score detector triggers.
 */

'use strict';

const { EventEmitter } = require('events');
const { AnomalyDetector } = require('../anomaly/detector');

const POLL_INTERVAL_MS = parseInt(process.env.MONITOR_POLL_INTERVAL_MS ?? '30000', 10);
const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SIM_MODE = !MAPS_API_KEY;

/**
 * TrafficMonitor polls speeds and fires 'anomaly' events when detected.
 *
 * @extends EventEmitter
 * @fires TrafficMonitor#anomaly
 * @fires TrafficMonitor#speeds-updated
 */
class TrafficMonitor extends EventEmitter {
  /**
   * @param {import('../../../router-agent/src/graph/GraphStore').GraphStore} graph
   * @param {object} [options]
   * @param {number} [options.pollIntervalMs]
   */
  constructor(graph, options = {}) {
    super();
    this._graph = graph;
    this._pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
    this._detector = new AnomalyDetector({ windowSize: 20, zThreshold: 2.0 });
    this._timer = null;
    this._pollCount = 0;

    if (SIM_MODE) {
      console.log('[traffic-monitor] 🔶 Simulation mode (set GOOGLE_MAPS_API_KEY for live data)');
    } else {
      console.log('[traffic-monitor] ✅ Live mode — using Google Maps API');
    }
  }

  /** Start the polling loop. */
  start() {
    console.log(`[traffic-monitor] Starting poll every ${this._pollIntervalMs / 1000}s`);
    this._poll(); // immediate first poll
    this._timer = setInterval(() => this._poll(), this._pollIntervalMs);
  }

  /** Stop polling. */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  async _poll() {
    this._pollCount++;
    const updates = SIM_MODE
      ? this._simulateTraffic()
      : await this._fetchLiveTraffic();

    for (const { fromId, toId, speedKmh, freeFlowSpeedKmh } of updates) {
      this._graph.updateEdgeSpeed(fromId, toId, speedKmh);

      const segKey = `${fromId}→${toId}`;
      const anomaly = this._detector.observe(segKey, speedKmh, freeFlowSpeedKmh);
      if (anomaly) {
        /**
         * @event TrafficMonitor#anomaly
         * @type {import('../anomaly/detector').AnomalyEvent & { fromId: string, toId: string }}
         */
        this.emit('anomaly', { ...anomaly, fromId, toId });
      }
    }

    this.emit('speeds-updated', { count: updates.length, pollCount: this._pollCount });
  }

  /**
   * Simulation mode: generate realistic traffic variation with occasional spikes.
   * Every ~10th poll, inject a severe traffic event on one segment.
   */
  _simulateTraffic() {
    const nodes = this._graph.allNodes();
    if (nodes.length < 2) return [];

    const updates = [];

    // Sample up to 15 random segments from the graph
    const sampleSize = Math.min(15, nodes.length);
    for (let i = 0; i < sampleSize; i++) {
      const fromNode = nodes[Math.floor(Math.random() * nodes.length)];
      const edges = this._graph.edgesFrom(fromNode.id);
      if (edges.length === 0) continue;

      const edge = edges[Math.floor(Math.random() * edges.length)];
      const freeFlow = edge.freeFlowSpeedKmh;

      // Normal variation: ±20% of free-flow speed
      let speedKmh = freeFlow * (0.8 + Math.random() * 0.4);

      // Every 8th poll: inject a spike on one random segment (simulates incident)
      if (this._pollCount % 8 === 0 && i === 0) {
        speedKmh = freeFlow * (0.1 + Math.random() * 0.2); // 10-30% of free-flow
        console.log(`[traffic-monitor] 🚨 Simulating traffic spike on ${fromNode.id}→${edge.to}`);
      }

      updates.push({
        fromId: fromNode.id,
        toId: edge.to,
        speedKmh: Math.max(1, Math.round(speedKmh)),
        freeFlowSpeedKmh: freeFlow,
      });
    }

    return updates;
  }

  /**
   * Live mode: fetch current travel times from Google Maps Directions API.
   * Samples key segments defined by the graph's high-degree nodes.
   */
  async _fetchLiveTraffic() {
    // Lazy-load axios to avoid requiring it in sim mode
    const axios = require('axios');
    const nodes = this._graph.allNodes().slice(0, 10); // top 10 nodes
    const updates = [];

    for (const fromNode of nodes) {
      const edges = this._graph.edgesFrom(fromNode.id).slice(0, 3);
      for (const edge of edges) {
        const toNode = this._graph.getNode(edge.to);
        if (!toNode) continue;

        try {
          const url = 'https://maps.googleapis.com/maps/api/directions/json';
          const resp = await axios.get(url, {
            params: {
              origin: `${fromNode.lat},${fromNode.lon}`,
              destination: `${toNode.lat},${toNode.lon}`,
              departure_time: 'now',
              key: MAPS_API_KEY,
            },
            timeout: 5000,
          });

          const route = resp.data?.routes?.[0]?.legs?.[0];
          if (!route) continue;

          // Convert duration_in_traffic to speed
          const durationSec = route.duration_in_traffic?.value ?? route.duration?.value;
          const distanceM = route.distance?.value ?? 0;
          if (!durationSec || !distanceM) continue;

          const speedKmh = (distanceM / 1000) / (durationSec / 3600);
          updates.push({
            fromId: fromNode.id,
            toId: edge.to,
            speedKmh: Math.max(1, speedKmh),
            freeFlowSpeedKmh: edge.freeFlowSpeedKmh,
          });
        } catch (err) {
          console.warn(`[traffic-monitor] Google Maps API error for ${fromNode.id}→${edge.to}: ${err.message}`);
        }
      }
    }

    return updates;
  }
}

module.exports = { TrafficMonitor };
