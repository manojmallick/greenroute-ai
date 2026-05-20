'use strict';

const express = require('express');
const { optimizeRoute } = require('@greenroute/router-agent');

const router = express.Router();

/**
 * POST /api/route/optimize
 */
router.post('/route/optimize', async (req, res, next) => {
  try {
    const { originId, destinationId, vehicle, trace = false } = req.body;

    if (!originId || !destinationId || !vehicle?.type) {
      return res.status(400).json({
        error: 'Missing required fields: originId, destinationId, vehicle.type',
      });
    }

    const result = await optimizeRoute({ originId, destinationId, vehicle, trace });

    // Store trace so /api/algorithm/trace/:routeId can serve it
    const io = req.app.get('io');
    const redisPub = req.app.get('redisPub');

    if (redisPub) {
      // Publish route event — Router Agent co2Monitor picks this up
      await redisPub.publish('greenroute:route-updated', JSON.stringify({
        type: 'route:updated',
        vehicleId: vehicle.id,
        vehicleType: vehicle.type,
        co2SavedKg: result.co2Savings.savedCo2Kg,
        currentSpeedKmh: result.segments[0]?.currentSpeedKmh ?? 30,
        currentSegDistKm: result.segments[0]?.distanceKm ?? 1,
        savedCo2Kg: result.co2Savings.savedCo2Kg,
        savedUsd: result.co2Savings.savedUsd,
      }));
    } else if (io) {
      // Fallback: emit directly if no Redis
      io.emit('route:updated', {
        vehicleId: vehicle.id,
        newRoute: result.stops,
        co2SavedKg: result.co2Savings.savedCo2Kg,
      });
    }

    // Cache trace in memory (keyed by route hash) for the trace endpoint
    const routeId = `${originId}-${destinationId}-${Date.now()}`;
    const traceCache = req.app.get('traceCache') ?? {};
    if (trace && result.trace) {
      traceCache[routeId] = { trace: result.trace, result, cachedAt: Date.now() };
      req.app.set('traceCache', traceCache);
    }

    return res.json({ ...result, routeId });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/algorithm/trace/:routeId
 * Returns A* search trace for AlgoTrace UI visualization.
 */
router.get('/algorithm/trace/:routeId', (req, res) => {
  const traceCache = req.app.get('traceCache') ?? {};
  const cached = traceCache[req.params.routeId];

  if (!cached) {
    return res.status(404).json({
      error: `No trace found for routeId: ${req.params.routeId}`,
      hint: 'Request a route with ?trace=true or send trace:true in POST /api/route/optimize',
    });
  }

  return res.json({
    routeId: req.params.routeId,
    algorithm: cached.result.algorithm,
    stepsExpanded: cached.trace.length,
    trace: cached.trace,
    route: cached.result.stops,
    cachedAt: cached.cachedAt,
  });
});

/**
 * GET /api/co2/savings
 */
router.get('/co2/savings', (req, res) => {
  const fleetPath = require('path').join(process.cwd(), 'data', 'seed', 'demo-fleet.json');
  const fs = require('fs');
  res.json({
    cumulativeCo2Kg: 0,
    cumulativeSavedKg: 0,
    cumulativeSavedUsd: 0,
    routesOptimized: 0,
    fleet: fs.existsSync(fleetPath) ? JSON.parse(fs.readFileSync(fleetPath)).length : 0,
    message: 'Live totals available when Co2Monitor is running in monitor-agent',
  });
});

/**
 * GET /api/fleet
 */
router.get('/fleet', (req, res) => {
  const fleetPath = require('path').join(process.cwd(), 'data', 'seed', 'demo-fleet.json');
  const fs = require('fs');
  if (fs.existsSync(fleetPath)) {
    const fleet = JSON.parse(fs.readFileSync(fleetPath, 'utf8'));
    return res.json({ vehicles: fleet, count: fleet.length });
  }
  return res.json({ vehicles: [], count: 0 });
});

/**
 * POST /api/fleet/replan
 * Manually trigger a full fleet replan (for demo / judging)
 */
router.post('/fleet/replan', async (req, res, next) => {
  try {
    const redisPub = req.app.get('redisPub');
    if (!redisPub) {
      console.warn('[api-gateway] Redis not available for replan');
      return res.status(503).json({
        error: 'Redis not connected',
        message: 'Running in demo mode without full agent coordination',
        status: 'ok_demo',
      });
    }

    const { reason = 'manual_trigger', segment, city = 'ams' } = req.body;

    // Map city to default segment if not provided
    const segmentByCity = {
      ams: 'AMS-CS→AMS-DAM',
      ber: 'BER-HBF→BER-ZOO',
      lon: 'LON-KX→LON-LHR',
    };

    // Use specific segment if provided, else use city-default segment
    const targetSegment = segment || segmentByCity[city] || 'AMS-CS→AMS-DAM';

    // Publish a simulated anomaly to trigger the full chain
    const anomaly = {
      segmentKey: targetSegment,
      observedSpeedKmh: 3,
      expectedSpeedKmh: 28,
      freeFlowSpeedKmh: 30,
      zScore: -4.5,
      speedDropPct: 90,
      severity: 'critical',
      detectedAt: new Date().toISOString(),
    };

    await redisPub.publish('greenroute:replan-needed', JSON.stringify({
      type: 'REPLAN_NEEDED',
      reason,
      anomaly,
      timestamp: anomaly.detectedAt,
    }));

    const proto = req.headers['x-forwarded-proto'] ?? req.protocol;
    const wsProto = proto === 'https' ? 'wss' : 'ws';
    const host = req.headers['x-forwarded-host'] ?? req.headers.host;

    res.json({
      message: 'Replan triggered — watch Socket.IO for replan:started and route:updated events',
      anomaly,
      hint: `Connect to ${wsProto}://${host} and listen for replan:started, route:updated, replan:complete`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/metrics
 */
router.get('/metrics', (req, res) => {
  const uptime = process.uptime();
  const memMb = process.memoryUsage().heapUsed / 1024 / 1024;
  res.type('text/plain').send(
    `# HELP greenroute_uptime_seconds API uptime\n` +
    `# TYPE greenroute_uptime_seconds gauge\n` +
    `greenroute_uptime_seconds ${uptime.toFixed(2)}\n\n` +
    `# HELP greenroute_heap_mb Heap memory in MB\n` +
    `# TYPE greenroute_heap_mb gauge\n` +
    `greenroute_heap_mb ${memMb.toFixed(2)}\n`
  );
});

module.exports = router;
