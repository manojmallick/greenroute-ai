'use strict';

const { segmentCarbonCost, routeCarbonCost, computeCo2Savings, EMISSION_FACTORS } = require('../carbonPricing');

describe('carbonPricing', () => {
  describe('segmentCarbonCost', () => {
    test('diesel van: 10km produces correct CO₂', () => {
      const { co2Kg, shadowCostUsd } = segmentCarbonCost(10, 'diesel_van');
      expect(co2Kg).toBeCloseTo(10 * 0.2153, 5);
      expect(shadowCostUsd).toBeCloseTo((10 * 0.2153 / 1000) * 85, 5);
    });

    test('electric van has lower emissions than diesel', () => {
      const diesel = segmentCarbonCost(10, 'diesel_van');
      const electric = segmentCarbonCost(10, 'electric_van');
      expect(electric.co2Kg).toBeLessThan(diesel.co2Kg);
    });

    test('cargo bike emits zero CO₂', () => {
      const { co2Kg, shadowCostUsd } = segmentCarbonCost(100, 'cargo_bike');
      expect(co2Kg).toBe(0);
      expect(shadowCostUsd).toBe(0);
    });

    test('zero distance returns zero cost', () => {
      const { co2Kg } = segmentCarbonCost(0, 'diesel_van');
      expect(co2Kg).toBe(0);
    });

    test('unknown vehicle type throws', () => {
      expect(() => segmentCarbonCost(10, 'horse_cart')).toThrow('Unknown vehicle type');
    });

    test('custom carbon price is applied', () => {
      const { shadowCostUsd } = segmentCarbonCost(10, 'diesel_van', 150);
      expect(shadowCostUsd).toBeCloseTo((10 * 0.2153 / 1000) * 150, 5);
    });
  });

  describe('routeCarbonCost', () => {
    const segments = [
      { distanceKm: 5 },
      { distanceKm: 3 },
      { distanceKm: 7 },
    ];

    test('sums correctly across multiple segments', () => {
      const { totalCo2Kg } = routeCarbonCost(segments, 'diesel_van');
      const expected = 15 * 0.2153;
      expect(totalCo2Kg).toBeCloseTo(expected, 5);
    });

    test('empty segments returns zero', () => {
      const { totalCo2Kg, totalShadowCostUsd } = routeCarbonCost([], 'diesel_van');
      expect(totalCo2Kg).toBe(0);
      expect(totalShadowCostUsd).toBe(0);
    });
  });

  describe('computeCo2Savings', () => {
    const baseline = [{ distanceKm: 20 }];
    const optimized = [{ distanceKm: 14 }];

    test('computes positive savings when optimized is shorter', () => {
      const { savedCo2Kg, reductionPercent } = computeCo2Savings(baseline, optimized, 'diesel_van');
      expect(savedCo2Kg).toBeGreaterThan(0);
      expect(reductionPercent).toBeCloseTo(30, 0); // 30% distance reduction → 30% CO₂ reduction
    });

    test('returns zero when optimized uses more distance (no negative savings)', () => {
      const { savedCo2Kg, savedUsd } = computeCo2Savings(optimized, baseline, 'diesel_van');
      expect(savedCo2Kg).toBe(0);
      expect(savedUsd).toBe(0);
    });

    test('zero baseline returns zero reduction percent', () => {
      const { reductionPercent } = computeCo2Savings([], optimized, 'diesel_van');
      expect(reductionPercent).toBe(0);
    });
  });

  describe('EMISSION_FACTORS integrity', () => {
    test('all factors are non-negative numbers', () => {
      for (const [type, factor] of Object.entries(EMISSION_FACTORS)) {
        expect(typeof factor).toBe('number');
        expect(factor).toBeGreaterThanOrEqual(0);
      }
    });

    test('cargo bike is zero', () => {
      expect(EMISSION_FACTORS['cargo_bike']).toBe(0);
    });

    test('electric van is less than diesel van', () => {
      expect(EMISSION_FACTORS['electric_van']).toBeLessThan(EMISSION_FACTORS['diesel_van']);
    });
  });
});
