/**
 * Realistic Traffic Simulator — generates city-specific traffic patterns
 * based on time of day, day of week, and historical patterns.
 *
 * Features:
 * - Rush hour slowdowns by city (London > Berlin > Amsterdam)
 * - Probabilistic traffic spikes (congestion events)
 * - Day-of-week multipliers (weekends are lighter)
 * - Realistic speed distributions per road segment
 */

'use strict';

const { getCity } = require('./cityConfig');

const SPEED_VARIANCE = 0.08; // 8% standard deviation in speeds
const WEEKEND_MULTIPLIER = 0.92; // Weekends have 8% less congestion

/**
 * Simulate realistic traffic for a road segment
 * @param {string} cityId - 'ams', 'ber', or 'lon'
 * @param {number} freeFlowSpeedKmh - baseline speed
 * @param {number} [hour] - 0-23 (defaults to current hour)
 * @param {number} [dayOfWeek] - 0=Sun, 6=Sat (defaults to today)
 * @returns {number} simulated current speed (km/h)
 */
function simulateSpeed(cityId, freeFlowSpeedKmh, hour, dayOfWeek) {
  const city = getCity(cityId);
  if (!city) throw new Error(`Unknown city: ${cityId}`);

  const now = new Date();
  const h = hour ?? now.getHours();
  const dow = dayOfWeek ?? now.getDay();

  let speedMultiplier = 1.0;

  // Apply rush hour slowdown
  const rushHour = city.rushhours.find((rh) => h >= rh.start && h < rh.end);
  if (rushHour) {
    speedMultiplier *= rushHour.speedFactor;
  }

  // Apply weekend reduction (less congestion)
  if (dow === 0 || dow === 6) {
    speedMultiplier *= WEEKEND_MULTIPLIER;
  }

  // Add random variance (realistic traffic noise)
  const variance = 1 + (Math.random() - 0.5) * SPEED_VARIANCE;
  speedMultiplier *= variance;

  // Ensure speed is >= 5 km/h and <= free flow
  const currentSpeed = Math.max(5, Math.min(freeFlowSpeedKmh * speedMultiplier, freeFlowSpeedKmh));

  return Math.round(currentSpeed * 100) / 100; // Round to 2 decimals
}

/**
 * Check if a traffic spike should occur
 * @param {string} cityId
 * @returns {boolean}
 */
function shouldTriggerSpike(cityId) {
  const city = getCity(cityId);
  if (!city) return false;
  return Math.random() < city.eventualTrafficSpikeProbability;
}

/**
 * Simulate a traffic spike on a random segment
 * @param {string} cityId
 * @returns {object} { segmentId, severity: 'low'|'medium'|'high'|'critical' }
 */
function generateTrafficSpike(cityId) {
  const city = getCity(cityId);
  if (!city) throw new Error(`Unknown city: ${cityId}`);

  const rand = Math.random();
  let severity;
  let speedDropPercent;

  if (rand < 0.5) {
    severity = 'low';
    speedDropPercent = 30;
  } else if (rand < 0.8) {
    severity = 'medium';
    speedDropPercent = 50;
  } else if (rand < 0.95) {
    severity = 'high';
    speedDropPercent = 70;
  } else {
    severity = 'critical';
    speedDropPercent = 85;
  }

  const randomLandmark = city.landmarks[Math.floor(Math.random() * city.landmarks.length)];

  return {
    severity,
    speedDropPercent,
    locationName: randomLandmark.name,
    landmarkId: randomLandmark.id,
  };
}

/**
 * Get realistic arrival time estimate for a route
 * @param {number} distanceKm
 * @param {number} currentSpeedKmh
 * @returns {number} minutes
 */
function estimateArrivalTime(distanceKm, currentSpeedKmh) {
  if (currentSpeedKmh <= 0) return 999; // Invalid
  return Math.round((distanceKm / currentSpeedKmh) * 60);
}

module.exports = {
  simulateSpeed,
  shouldTriggerSpike,
  generateTrafficSpike,
  estimateArrivalTime,
  SPEED_VARIANCE,
  WEEKEND_MULTIPLIER,
};
