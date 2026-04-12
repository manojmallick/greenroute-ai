/**
 * Fleet Replanner — executes per-vehicle A* and emits results via Socket.IO.
 *
 * Receives a REPLAN_INSTRUCTION from the Replanner Agent and:
 *   1. Runs A* for each affected vehicle
 *   2. Applies constraints (avoidSegment → edge penalty, preferElectric)
 *   3. Publishes new routes via Redis → API Gateway → Socket.IO → Frontend map
 *   4. Writes CO₂ savings to Redis for the CO₂ ticker
 */

'use strict';

const { aStar } = require('../algorithms/astar');
const { dijkstra } = require('../algorithms/dijkstra');
const { routeCarbonCost, computeCo2Savings } = require('../algorithms/carbonPricing');

class FleetReplanner {
  /**
   * @param {object} options
   * @param {import('../graph/GraphStore').GraphStore} options.graph
   * @param {import('ioredis').Redis} options.redis
   * @param {object[]} options.fleet — demo fleet with stop positions
   */
  constructor({ graph, redis, fleet }) {
    this._graph = graph;
    this._redis = redis;
    this._fleet = fleet;
    this._replansCompleted = 0;
  }

  /**
   * Execute a replan for a set of vehicles according to the Replanner's decision.
   *
   * @param {object} instruction — from greenroute:replan-instruction
   * @returns {Promise<{ routesUpdated: number, totalCo2SavedKg: number, timeSavedMin: number }>}
   */
  async executeReplan(instruction) {
    const { vehicleIds, constraints, anomaly, replanIndex } = instruction;
    const startMs = Date.now();

    console.log(`[fleet-replanner] 🔄 Replan #${replanIndex}: ${vehicleIds.length} vehicles`);

    let totalCo2SavedKg = 0;
    let routesUpdated = 0;
    const results = [];

    for (const vehicleId of vehicleIds) {
      try {
        const result = await this._replanVehicle(vehicleId, constraints, anomaly);
        if (result) {
          results.push(result);
          totalCo2SavedKg += result.co2SavedKg;
          routesUpdated++;
        }
      } catch (err) {
        console.warn(`[fleet-replanner] Failed to replan ${vehicleId}: ${err.message}`);
      }
    }

    const elapsed = Date.now() - startMs;
    const timeSavedMin = Math.round((results.reduce((s, r) => s + (r.timeSavedMin ?? 0), 0)) * 10) / 10;

    // Publish replan:complete to Redis → API Gateway → Socket.IO
    if (this._redis && results.length > 0) {
      await this._redis.publish('greenroute:replan-complete', JSON.stringify({
        type: 'replan:complete',
        replanIndex,
        routesUpdated,
        totalCo2SavedKg: Math.round(totalCo2SavedKg * 1000) / 1000,
        timeSavedMin,
        computedInMs: elapsed,
        completedAt: new Date().toISOString(),
      }));
    }

    this._replansCompleted++;
    console.log(
      `[fleet-replanner] ✅ Replan #${replanIndex} done in ${elapsed}ms: ` +
      `${routesUpdated} routes updated, ${totalCo2SavedKg.toFixed(3)}kg CO₂ saved`
    );

    return { routesUpdated, totalCo2SavedKg, timeSavedMin };
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  async _replanVehicle(vehicleId, constraints, anomaly) {
    const vehicle = this._fleet.find((v) => v.id === vehicleId);
    if (!vehicle) {
      console.warn(`[fleet-replanner] Vehicle ${vehicleId} not found in fleet`);
      return null;
    }

    // Find origin (vehicle's current position → nearest graph node)
    const origin = this._nearestNode(vehicle.current_lat, vehicle.current_lon);
    if (!origin) return null;

    // Pick a demo destination (in production: from active route in DB)
    const destination = this._pickDestination(origin.id, constraints);
    if (!destination || destination.id === origin.id) return null;

    // Apply avoidSegment constraint: temporarily raise cost on anomalous edge
    const [fromId, toId] = anomaly.segmentKey.split('→');
    if (constraints.avoidSegment) {
      this._graph.updateEdgeSpeed(fromId, toId, 1); // near-zero speed = very high time cost
    }

    // Run A* for this vehicle
    const effectiveVehicle = {
      id: vehicleId,
      type: constraints.preferElectric && vehicle.type === 'diesel_van' ? 'electric_van' : vehicle.type,
    };

    let result = aStar(this._graph, origin, destination, effectiveVehicle, { recordTrace: true });
    let algorithm = 'astar';

    if (!result) {
      result = dijkstra(this._graph, origin, destination, effectiveVehicle);
      algorithm = 'dijkstra';
    }

    if (!result) return null;

    // Restore normal speed
    if (constraints.avoidSegment) {
      const edges = this._graph.edgesFrom(fromId);
      const edge = edges.find((e) => e.to === toId);
      if (edge) this._graph.updateEdgeSpeed(fromId, toId, edge.freeFlowSpeedKmh * 0.5);
    }

    // Compute CO₂ savings vs naive Dijkstra baseline
    const baseline = dijkstra(this._graph, origin, destination, { id: 'baseline', type: vehicle.type });
    const { savedCo2Kg, savedUsd, reductionPercent } = baseline
      ? computeCo2Savings(baseline.segments, result.segments, effectiveVehicle.type)
      : { savedCo2Kg: 0, savedUsd: 0, reductionPercent: 0 };

    const { totalCo2Kg } = routeCarbonCost(result.segments, effectiveVehicle.type);
    const totalDistKm = result.segments.reduce((s, seg) => s + seg.distanceKm, 0);

    // Publish route:updated event
    const routePayload = {
      type: 'route:updated',
      vehicleId,
      vehicleType: effectiveVehicle.type,
      algorithm,
      newRoute: result.nodes.map((n) => ({ id: n.id, name: n.name, lat: n.lat, lon: n.lon })),
      totalDistanceKm: Math.round(totalDistKm * 100) / 100,
      totalCo2Kg: Math.round(totalCo2Kg * 1000) / 1000,
      co2SavedKg: Math.round(savedCo2Kg * 1000) / 1000,
      savedUsd: Math.round(savedUsd * 100) / 100,
      reductionPercent: Math.round(reductionPercent * 10) / 10,
      currentSpeedKmh: result.segments[0]?.currentSpeedKmh ?? 30,
      currentSegDistKm: result.segments[0]?.distanceKm ?? 1,
      trace: result.trace,
      computedAt: new Date().toISOString(),
    };

    if (this._redis) {
      await this._redis.publish('greenroute:route-updated', JSON.stringify(routePayload));
    }

    console.log(
      `[fleet-replanner] 🚐 ${vehicleId} (${effectiveVehicle.type}): ` +
      `${totalDistKm.toFixed(1)}km, ${totalCo2Kg.toFixed(3)}kg CO₂, ` +
      `saved ${savedCo2Kg.toFixed(3)}kg (${reductionPercent.toFixed(1)}%)`
    );

    return {
      vehicleId,
      co2SavedKg: savedCo2Kg,
      timeSavedMin: 0, // computed from ETA diff — requires DB routes in production
    };
  }

  /**
   * Find the graph node nearest to a lat/lon position.
   * @param {number} lat
   * @param {number} lon
   * @returns {object | null}
   */
  _nearestNode(lat, lon) {
    let nearest = null;
    let minDist = Infinity;
    for (const node of this._graph.allNodes()) {
      const d = Math.hypot(node.lat - lat, node.lon - lon);
      if (d < minDist) { minDist = d; nearest = node; }
    }
    return nearest;
  }

  /**
   * Pick a destination node different from the origin.
   * In production: read from active route in DB.
   */
  _pickDestination(originId, constraints) {
    const nodes = this._graph.allNodes().filter((n) => n.id !== originId);
    if (nodes.length === 0) return null;
    // Pick the node farthest from origin for a meaningful route
    return nodes[Math.floor(Math.random() * Math.min(nodes.length, 5))];
  }
}

module.exports = { FleetReplanner };
