/**
 * City Configuration — defines geography, key landmarks, and traffic patterns
 * for supported cities (Amsterdam, Berlin, London).
 *
 * Used by: traffic simulator, fleet generator, carbon reporting
 */

'use strict';

const CITIES = {
  amsterdam: {
    id: 'ams',
    name: 'Amsterdam',
    country: 'NL',
    timezone: 'Europe/Amsterdam',
    center: { lat: 52.3676, lon: 4.9041 },
    bounds: {
      north: 52.4262, south: 52.2645, east: 5.0913, west: 4.7319,
    },
    landmarks: [
      { id: 'AMS-CS', name: 'Centraal Station', lat: 52.37899, lon: 4.90015 },
      { id: 'AMS-DAM', name: 'Dam Square', lat: 52.37399, lon: 4.89144 },
      { id: 'AMS-LEI', name: 'Leidseplein', lat: 52.35968, lon: 4.88038 },
      { id: 'AMS-REM', name: 'Rembrandt Square', lat: 52.36248, lon: 4.89749 },
      { id: 'AMS-WTR', name: 'Waterlooplein', lat: 52.36548, lon: 4.90254 },
      { id: 'AMS-OOS', name: 'Oost District', lat: 52.34821, lon: 4.91234 },
      { id: 'AMS-ZUI', name: 'Zuid District', lat: 52.34124, lon: 4.87654 },
      { id: 'AMS-SLO', name: 'Sloterdijk', lat: 52.38876, lon: 4.84321 },
      { id: 'AMS-ARP', name: 'Amsterdam Airport', lat: 52.30906, lon: 4.76368 },
      { id: 'AMS-SCH', name: 'Schiphol', lat: 52.30906, lon: 4.76368 },
    ],
    rushhours: [
      { start: 7, end: 9, speedFactor: 0.75 },   // Morning commute
      { start: 17, end: 19, speedFactor: 0.72 },  // Evening commute
    ],
    eventualTrafficSpikeProbability: 0.15, // 15% chance per poll
  },

  berlin: {
    id: 'ber',
    name: 'Berlin',
    country: 'DE',
    timezone: 'Europe/Berlin',
    center: { lat: 52.5200, lon: 13.4050 },
    bounds: {
      north: 52.6755, south: 52.3384, east: 13.7661, west: 13.0885,
    },
    landmarks: [
      { id: 'BER-CS', name: 'Berlin Central', lat: 52.52493, lon: 13.36853 },
      { id: 'BER-BRN', name: 'Brandenburg Gate', lat: 52.51628, lon: 13.37771 },
      { id: 'BER-POT', name: 'Potsdamer Platz', lat: 52.50548, lon: 13.37569 },
      { id: 'BER-MUS', name: 'Museum Island', lat: 52.51980, lon: 13.39799 },
      { id: 'BER-ALE', name: 'Alexanderplatz', lat: 52.52199, lon: 13.41387 },
      { id: 'BER-WES', name: 'West District', lat: 52.48421, lon: 13.32154 },
      { id: 'BER-OON', name: 'Oost District', lat: 52.48124, lon: 13.48654 },
      { id: 'BER-SUD', name: 'Südkreuz', lat: 52.47549, lon: 13.36581 },
      { id: 'BER-TXL', name: 'Tempelhof', lat: 52.47291, lon: 13.40244 },
      { id: 'BER-BER', name: 'Berlin Airport', lat: 52.36667, lon: 13.5 },
    ],
    rushhours: [
      { start: 6, end: 10, speedFactor: 0.70 },   // Longer morning commute
      { start: 16, end: 20, speedFactor: 0.68 },  // Extended evening commute
    ],
    eventualTrafficSpikeProbability: 0.18, // Slightly higher congestion
  },

  london: {
    id: 'lon',
    name: 'London',
    country: 'GB',
    timezone: 'Europe/London',
    center: { lat: 51.5074, lon: -0.1278 },
    bounds: {
      north: 51.7321, south: 51.2671, east: 0.3524, west: -0.4897,
    },
    landmarks: [
      { id: 'LON-CCH', name: 'Charing Cross', lat: 51.50800, lon: -0.12380 },
      { id: 'LON-BIG', name: 'Big Ben', lat: 51.49694, lon: -0.12475 },
      { id: 'LON-TWT', name: 'Tower of London', lat: 51.50828, lon: -0.07586 },
      { id: 'LON-STK', name: 'St. Pancras', lat: 51.53161, lon: -0.12344 },
      { id: 'LON-LVP', name: 'Liverpool Street', lat: 51.51743, lon: -0.08251 },
      { id: 'LON-WES', name: 'West End', lat: 51.50991, lon: -0.12925 },
      { id: 'LON-SOU', name: 'South London', lat: 51.43947, lon: -0.10928 },
      { id: 'LON-EAS', name: 'East London', lat: 51.49000, lon: 0.01234 },
      { id: 'LON-GAT', name: 'Gatwick', lat: 51.14053, lon: -0.19502 },
      { id: 'LON-LHR', name: 'Heathrow', lat: 51.47007, lon: -0.45953 },
    ],
    rushhours: [
      { start: 7, end: 10, speedFactor: 0.65 },   // Heavy morning peak
      { start: 16, end: 20, speedFactor: 0.62 },  // Heavy evening peak
    ],
    eventualTrafficSpikeProbability: 0.22, // Highest congestion (London traffic)
  },
};

/**
 * Get city config by ID or name
 * @param {string} cityKey - 'ams', 'ber', 'lon' or full name
 * @returns {object|null}
 */
function getCity(cityKey) {
  if (!cityKey) return null;
  const lower = cityKey.toLowerCase();
  return (
    CITIES[lower]
    || Object.values(CITIES).find((c) => c.id === lower || c.name.toLowerCase() === lower)
    || null
  );
}

/**
 * Get all supported cities
 * @returns {object[]}
 */
function listCities() {
  return Object.values(CITIES);
}

module.exports = {
  CITIES,
  getCity,
  listCities,
};
