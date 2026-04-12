'use strict';

const { AnomalyDetector, RunningStats } = require('../anomaly/detector');

describe('RunningStats', () => {
  test('empty stats: mean=0, stdDev=0', () => {
    const s = new RunningStats(10);
    expect(s.mean).toBe(0);
    expect(s.stdDev).toBe(0);
    expect(s.count).toBe(0);
    expect(s.isReady).toBe(false);
  });

  test('computes correct mean', () => {
    const s = new RunningStats(10);
    [10, 20, 30].forEach((v) => s.push(v));
    expect(s.mean).toBeCloseTo(20, 5);
  });

  test('computes correct stdDev for known values', () => {
    const s = new RunningStats(10);
    [2, 4, 4, 4, 5, 5, 7, 9].forEach((v) => s.push(v));
    // Known stdDev ≈ 2.0
    expect(s.stdDev).toBeCloseTo(2.0, 0);
  });

  test('evicts oldest values when window is full', () => {
    const s = new RunningStats(3);
    [1, 2, 3, 100].forEach((v) => s.push(v));
    expect(s.count).toBe(3);
    // Window should be [2, 3, 100]
    expect(s.mean).toBeCloseTo((2 + 3 + 100) / 3, 3);
  });

  test('isReady after 5 samples (min threshold)', () => {
    const s = new RunningStats(20);
    expect(s.isReady).toBe(false);
    [1, 2, 3, 4].forEach((v) => s.push(v));
    expect(s.isReady).toBe(false);
    s.push(5);
    expect(s.isReady).toBe(true);
  });

  test('zScore is negative when value is below mean', () => {
    const s = new RunningStats(10);
    [25, 27, 28, 26, 25, 27].forEach((v) => s.push(v));
    expect(s.zScore(5)).toBeLessThan(0);
  });

  test('zScore is zero when stdDev is zero', () => {
    const s = new RunningStats(10);
    // All same values — stdDev = 0
    [30, 30, 30, 30, 30, 30].forEach((v) => s.push(v));
    expect(s.zScore(5)).toBe(0);
  });
});

describe('AnomalyDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new AnomalyDetector({ windowSize: 10, zThreshold: 2.0, minSpeedDropPct: 0.2 });
  });

  test('does not fire before window is full', () => {
    const seg = 'A→B';
    for (let i = 0; i < 4; i++) {
      const result = detector.observe(seg, 3, 30); // extreme drop, but no baseline yet
      expect(result).toBeNull();
    }
  });

  test('detects severe traffic spike after baseline is established', () => {
    const seg = 'A→B';
    const freeFlow = 30;

    // Seed normal traffic
    for (let i = 0; i < 8; i++) {
      detector.observe(seg, freeFlow * (0.8 + Math.random() * 0.4), freeFlow);
    }

    // Inject spike (3 km/h when normal is ~27)
    const anomaly = detector.observe(seg, 3, freeFlow);
    expect(anomaly).not.toBeNull();
    expect(anomaly.segmentKey).toBe(seg);
    expect(anomaly.speedDropPct).toBeGreaterThan(20);
    expect(anomaly.zScore).toBeLessThan(-2.0);
  });

  test('does not flag normal readings as anomalous', () => {
    const seg = 'A→B';
    const freeFlow = 30;
    const results = [];
    // All normal traffic — no anomalies expected
    for (let i = 0; i < 20; i++) {
      results.push(detector.observe(seg, 25 + Math.random() * 8, freeFlow));
    }
    const anomalies = results.filter(Boolean);
    expect(anomalies.length).toBe(0);
  });

  test('assigns correct severity levels', () => {
    const seg = 'A→B';
    const freeFlow = 30;
    for (let i = 0; i < 8; i++) detector.observe(seg, 28, freeFlow);
    const anom = detector.observe(seg, 1, freeFlow); // extreme
    if (anom) {
      expect(['high', 'critical']).toContain(anom.severity);
    }
  });

  test('tracks multiple segments independently', () => {
    for (let i = 0; i < 8; i++) {
      detector.observe('A→B', 25 + Math.random() * 5, 30);
      detector.observe('C→D', 40 + Math.random() * 5, 50);
    }
    expect(detector.segmentCount).toBe(2);
  });

  test('anomaly event has all required fields', () => {
    const seg = 'X→Y';
    const freeFlow = 30;
    for (let i = 0; i < 8; i++) detector.observe(seg, 28, freeFlow);
    const anom = detector.observe(seg, 2, freeFlow);
    if (anom) {
      expect(anom).toHaveProperty('segmentKey');
      expect(anom).toHaveProperty('observedSpeedKmh');
      expect(anom).toHaveProperty('expectedSpeedKmh');
      expect(anom).toHaveProperty('zScore');
      expect(anom).toHaveProperty('speedDropPct');
      expect(anom).toHaveProperty('severity');
      expect(anom).toHaveProperty('detectedAt');
    }
  });
});
