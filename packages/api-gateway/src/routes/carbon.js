/**
 * Carbon Impact API endpoints
 *
 * GET /api/carbon/summary — Fleet-wide CO₂ summary
 * GET /api/carbon/cities — Multi-city comparison
 * POST /api/carbon/certificate — Generate impact certificate
 * GET /api/carbon/report/:cityId — City-specific impact report
 */

'use strict';

const express = require('express');
const {
  quantifyCarbonSavings,
  generateEquivalencies,
  projectAnnualImpact,
  calculateFleetImpact,
} = require('@greenroute/router-agent/src/algorithms/carbonQuantification');
const {
  generateCertificate,
  generateTextReport,
  generateFleetReport,
  certificateCSVHeader,
  certificateToCSVRow,
} = require('../services/carbonCertificate');

const router = express.Router();

/**
 * GET /api/carbon/summary
 * Returns current fleet-wide CO₂ savings summary
 */
router.get('/carbon/summary', async (req, res) => {
  try {
    // In production, fetch from database/cache
    // For now, return example data
    const mockRoutes = [
      {
        id: 'route-1',
        cityId: 'ams',
        co2Saved: 4.2,
        distance: 15.3,
        duration: 42,
        vehicle: 'electric_van',
      },
      {
        id: 'route-2',
        cityId: 'ber',
        co2Saved: 6.8,
        distance: 22.1,
        duration: 58,
        vehicle: 'diesel_van',
      },
      {
        id: 'route-3',
        cityId: 'lon',
        co2Saved: 3.5,
        distance: 12.4,
        duration: 51,
        vehicle: 'petrol_van',
      },
    ];

    const impact = calculateFleetImpact(mockRoutes);
    const annualProjection = projectAnnualImpact(impact.totalCO2Kg / mockRoutes.length);

    return res.json({
      currentSummary: {
        totalRoutesOptimized: mockRoutes.length,
        ...impact,
      },
      annualProjection,
    });
  } catch (err) {
    console.error('[carbon-api]', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/carbon/cities
 * Multi-city carbon impact comparison
 */
router.get('/carbon/cities', async (req, res) => {
  try {
    // Mock data showing relative impact by city
    const citiesData = {
      amsterdam: {
        cityId: 'ams',
        cityName: 'Amsterdam',
        vehiclesOptimized: 8,
        routesOptimized: 156,
        totalCO2SavedKg: 423.8,
        avgCO2PerRoute: 2.72,
        estimatedAnnualTonnes: 154.6,
        trafficPattern: 'moderate (rush hours 07-09h, 17-19h)',
      },
      berlin: {
        cityId: 'ber',
        cityName: 'Berlin',
        vehiclesOptimized: 6,
        routesOptimized: 112,
        totalCO2SavedKg: 378.5,
        avgCO2PerRoute: 3.38,
        estimatedAnnualTonnes: 138.1,
        trafficPattern: 'heavy (rush hours 06-10h, 16-20h)',
      },
      london: {
        cityId: 'lon',
        cityName: 'London',
        vehiclesOptimized: 9,
        routesOptimized: 189,
        totalCO2SavedKg: 512.3,
        avgCO2PerRoute: 2.71,
        estimatedAnnualTonnes: 187.0,
        trafficPattern: 'very heavy (peak 07-10h, 16-20h)',
      },
    };

    // Calculate totals
    const allCities = Object.values(citiesData);
    const totalCO2Kg = allCities.reduce((sum, c) => sum + c.totalCO2SavedKg, 0);
    const totalAnnualTonnes = allCities.reduce((sum, c) => sum + c.estimatedAnnualTonnes, 0);

    return res.json({
      cities: citiesData,
      aggregate: {
        totalCities: 3,
        totalVehiclesOptimized: allCities.reduce((sum, c) => sum + c.vehiclesOptimized, 0),
        totalRoutesOptimized: allCities.reduce((sum, c) => sum + c.routesOptimized, 0),
        totalCO2SavedKg,
        estimatedAnnualTonnes: totalAnnualTonnes,
        carbonCreditsValueUSD: (totalCO2Kg / 1000) * 85,
        topCity: 'london',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[carbon-api]', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/carbon/certificate
 * Generate a carbon impact certificate for a specific route
 */
router.post('/carbon/certificate', async (req, res) => {
  try {
    const {
      routeId, cityId, distance, duration, vehicle, co2Saved, format = 'json',
    } = req.body;

    if (!routeId || !cityId || co2Saved === undefined) {
      return res.status(400).json({
        error: 'Missing fields: routeId, cityId, co2Saved',
      });
    }

    const mockRoute = {
      id: routeId,
      cityId,
      distanceKm: distance || 15.3,
      durationMinutes: duration || 42,
      vehicleType: vehicle || 'electric_van',
      co2Saved,
      baselineEmission: co2Saved * 1.42, // Approx 42% savings
      startPoint: 'Distribution Center',
      endPoint: 'Customer Address',
    };

    const certificate = generateCertificate(mockRoute, cityId);

    if (format === 'text') {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(generateTextReport(certificate));
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=certificate-${routeId}.csv`);
      return res.send(`${certificateCSVHeader()}\n${certificateToCSVRow(certificate)}`);
    }

    return res.json(certificate);
  } catch (err) {
    console.error('[carbon-api]', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/carbon/report/:cityId
 * Generate a fleet report for a specific city
 */
router.get('/carbon/report/:cityId', async (req, res) => {
  try {
    const { cityId } = req.params;

    // Mock certificate data
    const mockCertificates = [
      {
        certificateId: 'CERT-AMS-001',
        carbonImpact: { co2SavedKg: 4.2 },
      },
      {
        certificateId: 'CERT-AMS-002',
        carbonImpact: { co2SavedKg: 5.1 },
      },
      {
        certificateId: 'CERT-AMS-003',
        carbonImpact: { co2SavedKg: 3.8 },
      },
    ];

    const { format = 'json' } = req.query;

    if (format === 'text') {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(generateFleetReport(mockCertificates, cityId));
    }

    return res.json({
      cityId,
      reportGenerated: new Date().toISOString(),
      totalCertificates: mockCertificates.length,
      certificates: mockCertificates,
    });
  } catch (err) {
    console.error('[carbon-api]', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
