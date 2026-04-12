/**
 * CO₂ Monitor — tracks real-time fleet carbon emissions.
 *
 * Polls active routes and computes rolling CO₂ consumption using:
 *   - Current vehicle speed (from graph, updated by TrafficMonitor)
 *   - DEFRA 2024 emission factors per vehicle type
 *   - Actual segment distances
 *
 * Publishes co2:tick events via Socket.IO (via the shared Redis channel)
 * that drive the live CO₂ savings counter on the frontend.
 */

'use strict';

const { EventEmitter } = require('events');
const { EMISSION_FACTORS } = require('../../../router-agent/src/algorithms/carbonPricing');

const TICK_INTERVAL_MS = parseInt(process.env.CO2_TICK_INTERVAL_MS ?? '5000', 10); // every 5s

class Co2Monitor extends EventEmitter {
  /**
   * @param {object} options
   * @param {import('ioredis').Redis} options.redis
   */
  constructor({ redis } = {}) {
    super();
    this._redis = redis;
    this._timer = null;

    // Cumulative totals for the session
    this._totalEmittedKg = 0;
    this._totalSavedKg = 0;
    this._totalSavedUsd = 0;
    this._activeVehicles = new Map(); // vehicleId → { type, speedKmh, segDistKm }
  }

  /**
   * Register or update a vehicle's current segment for CO₂ tracking.
   * Called by the Router Agent when a new route is computed.
   *
   * @param {string} vehicleId
   * @param {string} vehicleType — DEFRA emission factor key
   * @param {number} segmentDistKm — distance of current leg
   * @param {number} currentSpeedKmh
   */
  updateVehicle(vehicleId, vehicleType, segmentDistKm, currentSpeedKmh) {
    this._activeVehicles.set(vehicleId, { vehicleType, segmentDistKm, currentSpeedKmh });
  }

  /**
   * Record CO₂ savings from a completed replan.
   * @param {number} savedKg
   * @param {number} savedUsd
   */
  recordSavings(savedKg, savedUsd) {
    this._totalSavedKg += savedKg;
    this._totalSavedUsd += savedUsd;
  }

  start() {
    console.log(`[co2-monitor] Starting CO₂ tick every ${TICK_INTERVAL_MS / 1000}s`);
    this._timer = setInterval(() => this._tick(), TICK_INTERVAL_MS);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async _tick() {
    // Compute CO₂ emitted since last tick for all active vehicles
    const deltaSeconds = TICK_INTERVAL_MS / 1000;
    let tickEmittedKg = 0;

    for (const [, { vehicleType, currentSpeedKmh }] of this._activeVehicles) {
      const factor = EMISSION_FACTORS[vehicleType] ?? 0;
      // distance in km = speed * time / 3600
      const distKm = (currentSpeedKmh * deltaSeconds) / 3600;
      tickEmittedKg += distKm * factor;
    }

    this._totalEmittedKg += tickEmittedKg;

    const payload = {
      cumulativeCo2Kg: Math.round(this._totalEmittedKg * 1000) / 1000,
      cumulativeSavedKg: Math.round(this._totalSavedKg * 1000) / 1000,
      cumulativeSavedUsd: Math.round(this._totalSavedUsd * 100) / 100,
      activeVehicles: this._activeVehicles.size,
      tickAt: new Date().toISOString(),
    };

    // Publish to Redis so API Gateway can emit via Socket.IO
    if (this._redis) {
      await this._redis.publish('greenroute:co2:tick', JSON.stringify(payload));
    }

    this.emit('tick', payload);
  }
}

module.exports = { Co2Monitor };
