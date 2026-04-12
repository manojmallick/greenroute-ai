/**
 * DEFRA 2024 emission factors and carbon shadow pricing.
 *
 * Reference: UK Department for Environment, Food & Rural Affairs —
 * "Greenhouse gas reporting: conversion factors 2024"
 *
 * Carbon shadow pricing makes CO₂ a first-class optimization target
 * by converting kg of emissions into a monetary cost using the
 * DEFRA-recommended shadow price for carbon.
 */

/**
 * Emission factors in kg CO₂e per km by vehicle type.
 * Source: DEFRA 2024, Table 5 (Road transport, freight).
 *
 * @type {Record<string, number>}
 */
const EMISSION_FACTORS = {
  diesel_van:   0.2153,  // 3.5t diesel van
  petrol_van:   0.1973,  // 3.5t petrol van
  electric_van: 0.0537,  // UK grid average 2024
  cargo_bike:   0.0,     // Zero direct emissions
  diesel_truck: 0.3625,  // 7.5t rigid truck
  hybrid_van:   0.1102,  // Plug-in hybrid van
};

/**
 * Central estimate for carbon shadow price (USD per tonne CO₂e).
 * Based on DEFRA 2024 recommended value, converted from GBP at 1.27 rate.
 * Configurable via CARBON_PRICE_PER_TONNE env var.
 */
const DEFAULT_CARBON_PRICE_PER_TONNE = parseFloat(process.env.CARBON_PRICE_PER_TONNE ?? '85');

/**
 * Compute the CO₂ shadow cost (in USD) for a single route segment.
 *
 * @param {number} distanceKm
 * @param {string} vehicleType — key into EMISSION_FACTORS
 * @param {number} [carbonPricePerTonne] — USD/tonne CO₂e (defaults to env var)
 * @returns {{ co2Kg: number, shadowCostUsd: number }}
 */
function segmentCarbonCost(distanceKm, vehicleType, carbonPricePerTonne = DEFAULT_CARBON_PRICE_PER_TONNE) {
  const factor = EMISSION_FACTORS[vehicleType];
  if (factor === undefined) {
    throw new Error(`Unknown vehicle type: "${vehicleType}". Valid types: ${Object.keys(EMISSION_FACTORS).join(', ')}`);
  }
  const co2Kg = distanceKm * factor;
  const co2Tonnes = co2Kg / 1000;
  const shadowCostUsd = co2Tonnes * carbonPricePerTonne;
  return { co2Kg, shadowCostUsd };
}

/**
 * Compute aggregate CO₂ shadow cost for an array of route segments.
 *
 * @param {Array<{ distanceKm: number }>} segments
 * @param {string} vehicleType
 * @param {number} [carbonPricePerTonne]
 * @returns {{ totalCo2Kg: number, totalShadowCostUsd: number }}
 */
function routeCarbonCost(segments, vehicleType, carbonPricePerTonne = DEFAULT_CARBON_PRICE_PER_TONNE) {
  let totalCo2Kg = 0;
  let totalShadowCostUsd = 0;
  for (const seg of segments) {
    const { co2Kg, shadowCostUsd } = segmentCarbonCost(seg.distanceKm, vehicleType, carbonPricePerTonne);
    totalCo2Kg += co2Kg;
    totalShadowCostUsd += shadowCostUsd;
  }
  return { totalCo2Kg, totalShadowCostUsd };
}

/**
 * Compare two routes and compute the CO₂ savings from choosing the optimized one.
 *
 * @param {{ distanceKm: number }[]} baselineSegments
 * @param {{ distanceKm: number }[]} optimizedSegments
 * @param {string} vehicleType
 * @returns {{ savedCo2Kg: number, savedUsd: number, reductionPercent: number }}
 */
function computeCo2Savings(baselineSegments, optimizedSegments, vehicleType) {
  const baseline = routeCarbonCost(baselineSegments, vehicleType);
  const optimized = routeCarbonCost(optimizedSegments, vehicleType);
  const savedCo2Kg = Math.max(0, baseline.totalCo2Kg - optimized.totalCo2Kg);
  const savedUsd = Math.max(0, baseline.totalShadowCostUsd - optimized.totalShadowCostUsd);
  const reductionPercent = baseline.totalCo2Kg > 0
    ? (savedCo2Kg / baseline.totalCo2Kg) * 100
    : 0;
  return { savedCo2Kg, savedUsd, reductionPercent };
}

module.exports = {
  EMISSION_FACTORS,
  DEFAULT_CARBON_PRICE_PER_TONNE,
  segmentCarbonCost,
  routeCarbonCost,
  computeCo2Savings,
};
