/**
 * Anomaly Detector — Z-score with sliding window.
 *
 * Detects traffic anomalies by comparing observed speed against
 * a baseline computed from a rolling window of recent measurements.
 *
 * A segment is flagged as anomalous when:
 *   z-score = (observed - mean) / stdDev > THRESHOLD
 *
 * This is the standard approach used in real-time traffic monitoring
 * systems (similar to Google Maps incident detection).
 *
 * Time complexity: O(1) per update (running stats with Welford's algorithm)
 */

'use strict';

const DEFAULT_WINDOW_SIZE = 20;          // number of samples per segment
const DEFAULT_Z_THRESHOLD = 2.0;        // standard deviations to flag
const DEFAULT_MIN_SPEED_DROP_PCT = 0.30; // must also be ≥30% speed drop

/**
 * Running statistics using Welford's online algorithm.
 * Maintains mean and variance in O(1) per update.
 */
class RunningStats {
  constructor(windowSize = DEFAULT_WINDOW_SIZE) {
    this._window = [];
    this._windowSize = windowSize;
    this._sum = 0;
    this._sumSq = 0;
  }

  /**
   * Add a new observation.
   * @param {number} value
   */
  push(value) {
    if (this._window.length >= this._windowSize) {
      const evicted = this._window.shift();
      this._sum -= evicted;
      this._sumSq -= evicted * evicted;
    }
    this._window.push(value);
    this._sum += value;
    this._sumSq += value * value;
  }

  /** @returns {number} */
  get count() {
    return this._window.length;
  }

  /** @returns {number} */
  get mean() {
    return this.count === 0 ? 0 : this._sum / this.count;
  }

  /** @returns {number} sample standard deviation */
  get stdDev() {
    if (this.count < 2) return 0;
    const variance = (this._sumSq - (this._sum * this._sum) / this.count) / (this.count - 1);
    return Math.sqrt(Math.max(0, variance));
  }

  /**
   * Compute the z-score for a new value (without adding it to the window).
   * @param {number} value
   * @returns {number}
   */
  zScore(value) {
    const sd = this.stdDev;
    if (sd === 0) return 0;
    return (value - this.mean) / sd;
  }

  /** @returns {boolean} window has enough data to detect anomalies */
  get isReady() {
    return this.count >= Math.min(5, this._windowSize);
  }
}

/**
 * AnomalyDetector — tracks per-segment speed history.
 * Flags segments where speed drops significantly below recent baseline.
 */
class AnomalyDetector {
  /**
   * @param {object} [options]
   * @param {number} [options.windowSize=20]
   * @param {number} [options.zThreshold=2.0]
   * @param {number} [options.minSpeedDropPct=0.30]
   */
  constructor({ windowSize = DEFAULT_WINDOW_SIZE, zThreshold = DEFAULT_Z_THRESHOLD, minSpeedDropPct = DEFAULT_MIN_SPEED_DROP_PCT } = {}) {
    this._zThreshold = zThreshold;
    this._minSpeedDropPct = minSpeedDropPct;

    /** @type {Map<string, RunningStats>} segmentKey → rolling stats */
    this._stats = new Map();

    this._windowSize = windowSize;
  }

  /**
   * Record a new speed observation for a road segment.
   * Returns an anomaly event if the reading is anomalous.
   *
   * @param {string} segmentKey — e.g. "AMS-CS→AMS-DAM"
   * @param {number} observedSpeedKmh
   * @param {number} freeFlowSpeedKmh
   * @returns {AnomalyEvent | null}
   */
  observe(segmentKey, observedSpeedKmh, freeFlowSpeedKmh) {
    if (!this._stats.has(segmentKey)) {
      this._stats.set(segmentKey, new RunningStats(this._windowSize));
    }

    const stats = this._stats.get(segmentKey);

    let anomaly = null;

    if (stats.isReady) {
      const z = stats.zScore(observedSpeedKmh);
      const speedDrop = (freeFlowSpeedKmh - observedSpeedKmh) / freeFlowSpeedKmh;

      // Anomaly: z-score below threshold (unusually slow) AND minimum drop
      if (z < -this._zThreshold && speedDrop >= this._minSpeedDropPct) {
        anomaly = {
          segmentKey,
          observedSpeedKmh,
          expectedSpeedKmh: Math.round(stats.mean * 10) / 10,
          freeFlowSpeedKmh,
          zScore: Math.round(z * 100) / 100,
          speedDropPct: Math.round(speedDrop * 1000) / 10,
          severity: this._severity(z),
          detectedAt: new Date().toISOString(),
        };
      }
    }

    // Always record the observation AFTER checking (don't contaminate baseline)
    stats.push(observedSpeedKmh);

    return anomaly;
  }

  /**
   * @param {number} z — z-score (negative = slower than expected)
   * @returns {'low' | 'medium' | 'high' | 'critical'}
   */
  _severity(z) {
    const abs = Math.abs(z);
    if (abs >= 4.0) return 'critical';
    if (abs >= 3.0) return 'high';
    if (abs >= 2.5) return 'medium';
    return 'low';
  }

  /** @returns {number} number of segments being tracked */
  get segmentCount() {
    return this._stats.size;
  }
}

/**
 * @typedef {object} AnomalyEvent
 * @property {string} segmentKey
 * @property {number} observedSpeedKmh
 * @property {number} expectedSpeedKmh
 * @property {number} freeFlowSpeedKmh
 * @property {number} zScore
 * @property {number} speedDropPct
 * @property {'low'|'medium'|'high'|'critical'} severity
 * @property {string} detectedAt
 */

module.exports = { AnomalyDetector, RunningStats };
