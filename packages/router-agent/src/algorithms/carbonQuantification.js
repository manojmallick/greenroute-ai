/**
 * Carbon Quantification & Impact Calculation
 *
 * Converts carbon savings into real-world impact metrics:
 * - Absolute CO₂ saved (kg, tonnes)
 * - Monetary value (EU ETS $85/tonne)
 * - Real-world equivalencies (cars off road, trees, etc.)
 * - Community impact projections
 */

'use strict';

// EU ETS carbon credit value (EUR/tonne) — can be updated dynamically
const CARBON_PRICE_EU_ETS_PER_TONNE = 85; // USD per tonne CO₂e

// Real-world equivalencies
const EQUIVALENCIES = {
  // CO2 per 1000 km driven
  carAverageCO2PerKm: 0.192, // kg CO2/km (typical passenger car)
  carAverageMilesPerYear: 12000, // miles

  // Tree absorption
  treeAbsorptionKgPerYear: 22, // kg CO2/year (mature tree)

  // Electricity grid
  kwhCO2Factor: 0.233, // kg CO2/kWh (EU average 2024)

  // Household equivalents
  householdCO2PerYear: 6700, // kg CO2 per household per year (EU avg)
};

/**
 * Calculate carbon savings in absolute terms
 * @param {number} co2SavedKg - kilograms of CO₂
 * @returns {object} { kg, tonnes, carbonCreditsUSD }
 */
function quantifyCarbonSavings(co2SavedKg) {
  const tonnes = co2SavedKg / 1000;
  const carbonCreditsUSD = (tonnes * CARBON_PRICE_EU_ETS_PER_TONNE);

  return {
    kg: Math.round(co2SavedKg * 100) / 100,
    tonnes: Math.round(tonnes * 10000) / 10000,
    carbonCreditsUSD: Math.round(carbonCreditsUSD * 100) / 100,
  };
}

/**
 * Generate real-world impact equivalencies
 * @param {number} co2SavedKg
 * @returns {object}
 */
function generateEquivalencies(co2SavedKg) {
  const e = EQUIVALENCIES;

  // Cars taken off road (for a day or a typical trip)
  const carDayDrive = 50; // km typical daily commute
  const carsOffRoadForDay = Math.round((co2SavedKg / (e.carAverageCO2PerKm * carDayDrive)) * 100) / 100;

  // Trees needed to absorb
  const treesNeeded = Math.ceil(co2SavedKg / e.treeAbsorptionKgPerYear);

  // Household days
  const householdDaysOffset = Math.round((co2SavedKg / (e.householdCO2PerYear / 365)) * 100) / 100;

  // Electricity grid equivalent
  const kwhEquivalent = Math.round((co2SavedKg / e.kwhCO2Factor) * 100) / 100;

  return {
    carsOffRoadForDay,
    treesPlanted: treesNeeded,
    householdDaysOffset,
    kwhEquivalent,
  };
}

/**
 * Generate a human-readable impact statement
 * @param {number} co2SavedKg
 * @returns {string}
 */
function generateImpactStatement(co2SavedKg) {
  if (co2SavedKg < 0.1) return 'Minimal carbon footprint reduction';

  const savings = quantifyCarbonSavings(co2SavedKg);
  const equiv = generateEquivalencies(co2SavedKg);

  // Format based on magnitude
  if (co2SavedKg < 1) {
    return `${savings.kg}g CO₂ saved — equivalent to ${equiv.householdDaysOffset} household days`;
  }

  if (co2SavedKg < 100) {
    return `${savings.kg}kg CO₂ saved — worth $${savings.carbonCreditsUSD} in carbon credits`;
  }

  if (co2SavedKg < 1000) {
    return `${savings.kg}kg CO₂ saved (${savings.tonnes}T) — equivalent to ${equiv.carsOffRoadForDay} cars off the road`;
  }

  // Tonnes scale
  return (
    `${savings.tonnes}T CO₂ saved ($${savings.carbonCreditsUSD}) — `
    + `equivalent to removing ${equiv.carsOffRoadForDay} cars from roads for a day`
  );
}

/**
 * Project annual impact at scale
 * @param {number} dailyCO2SavedKg - typical daily savings
 * @param {number} [daysPerYear=365]
 * @returns {object}
 */
function projectAnnualImpact(dailyCO2SavedKg, daysPerYear = 365) {
  const annualKg = dailyCO2SavedKg * daysPerYear;
  const savings = quantifyCarbonSavings(annualKg);
  const equiv = generateEquivalencies(annualKg);

  return {
    annualKg,
    ...savings,
    ...equiv,
    statement: (
      `At current deployment, GreenRoute AI saves approximately ${savings.tonnes}T CO₂ annually, `
      + `equivalent to removing ${equiv.carsOffRoadForDay} cars from the road for an entire year.`
    ),
  };
}

/**
 * Calculate fleet-wide impact metrics
 * @param {object[]} routesList - Array of routes with co2Saved property
 * @returns {object}
 */
function calculateFleetImpact(routesList) {
  const totalCO2Kg = (routesList || []).reduce((sum, r) => sum + (r.co2Saved || 0), 0);
  const avgCO2PerRoute = routesList.length > 0 ? totalCO2Kg / routesList.length : 0;

  const savings = quantifyCarbonSavings(totalCO2Kg);

  return {
    totalCO2Kg,
    avgCO2PerRoute: Math.round(avgCO2PerRoute * 100) / 100,
    totalRoutes: routesList.length,
    ...savings,
  };
}

module.exports = {
  quantifyCarbonSavings,
  generateEquivalencies,
  generateImpactStatement,
  projectAnnualImpact,
  calculateFleetImpact,
  EQUIVALENCIES,
  CARBON_PRICE_EU_ETS_PER_TONNE,
};
