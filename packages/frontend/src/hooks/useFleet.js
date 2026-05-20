import { useState, useCallback, useRef, useEffect } from 'react';
import { useSocket } from './useSocket';

const API_URL = import.meta.env.VITE_API_URL;

// Demo fleet from seed data — positions around Amsterdam
const DEMO_FLEET = [
  { id: 'VAN-001', name: 'Van Alpha',   type: 'diesel_van',   lat: 52.3791, lon: 4.9003 },
  { id: 'VAN-002', name: 'Van Beta',    type: 'electric_van', lat: 52.3731, lon: 4.8945 },
  { id: 'VAN-003', name: 'Van Gamma',   type: 'diesel_van',   lat: 52.3658, lon: 4.9201 },
  { id: 'VAN-004', name: 'Van Delta',   type: 'petrol_van',   lat: 52.3812, lon: 4.8762 },
  { id: 'VAN-005', name: 'Van Echo',    type: 'electric_van', lat: 52.3545, lon: 4.9012 },
  { id: 'VAN-006', name: 'Van Foxtrot', type: 'hybrid_van',   lat: 52.3892, lon: 4.9145 },
  { id: 'VAN-007', name: 'Van Golf',    type: 'diesel_van',   lat: 52.3623, lon: 4.8832 },
  { id: 'VAN-008', name: 'Van Hotel',   type: 'cargo_bike',   lat: 52.3711, lon: 4.8923 },
];

/**
 * useFleet — manages fleet state, route updates, and CO₂ tracking.
 * @param {string} selectedCity - Current selected city (ams, ber, lon)
 */
export function useFleet(selectedCity = 'ams') {
  const [vehicles, setVehicles] = useState(DEMO_FLEET);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [routes, setRoutes] = useState({});      // vehicleId → { stops, segments, co2, ... }
  const [replanState, setReplanState] = useState(null);  // null | { type, ... }
  const [co2Stats, setCo2Stats] = useState({
    cumulativeCo2Kg: 0,
    cumulativeSavedKg: 0,
    cumulativeSavedUsd: 0,
    activeVehicles: 0,
  });
  const [lastTrace, setLastTrace] = useState(null);

  // Track cumulative CO₂ saved across replans
  const totalSavedRef = useRef(0);

  const handleRouteUpdated = useCallback((data) => {
    setRoutes((prev) => ({
      ...prev,
      [data.vehicleId]: {
        stops: data.newRoute ?? [],
        co2SavedKg: data.co2SavedKg ?? 0,
        totalCo2Kg: data.totalCo2Kg ?? 0,
        reductionPercent: data.reductionPercent ?? 0,
        algorithm: data.algorithm ?? 'astar',
        vehicleType: data.vehicleType ?? 'diesel_van',
        segments: data.segments ?? [],
        updatedAt: Date.now(),
      },
    }));

    // Update vehicle position to first stop
    if (data.newRoute?.[0]) {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === data.vehicleId
            ? { ...v, lat: data.newRoute[0].lat, lon: data.newRoute[0].lon }
            : v
        )
      );
    }

    totalSavedRef.current += data.co2SavedKg ?? 0;
  }, []);

  const handleReplanStarted = useCallback((data) => {
    setReplanState({ type: 'started', ...data, startedAt: Date.now() });
  }, []);

  const handleReplanComplete = useCallback((data) => {
    setReplanState({ type: 'complete', ...data });
    setTimeout(() => setReplanState(null), 5000);
  }, []);

  const handleCo2Tick = useCallback((data) => {
    setCo2Stats({
      cumulativeCo2Kg: data.cumulativeCo2Kg ?? 0,
      cumulativeSavedKg: (data.cumulativeSavedKg ?? 0) + totalSavedRef.current,
      cumulativeSavedUsd: data.cumulativeSavedUsd ?? 0,
      activeVehicles: data.activeVehicles ?? 0,
    });
  }, []);

  /**
   * Trigger a route optimization via REST API and update trace.
   */
  const optimizeRoute = useCallback(async (originId, destinationId, vehicleId, vehicleType) => {
    const res = await fetch(`${API_URL}/api/route/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originId,
        destinationId,
        vehicle: { id: vehicleId, type: vehicleType },
        trace: true,
      }),
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    setRoutes((prev) => ({
      ...prev,
      [vehicleId]: {
        stops: data.stops ?? [],
        co2SavedKg: data.co2Savings?.savedCo2Kg ?? 0,
        totalCo2Kg: data.totalCo2Kg ?? 0,
        reductionPercent: data.co2Savings?.reductionPercent ?? 0,
        algorithm: data.algorithm ?? 'astar',
        segments: data.segments ?? [],
        vehicleType,
        updatedAt: Date.now(),
      },
    }));

    if (data.trace) setLastTrace({ routeId: data.routeId, trace: data.trace });
    return data;
  }, []);

  /**
   * Trigger a full fleet replan via the API.
   */
  const triggerReplan = useCallback(async (cityId = 'ams') => {
    // Map city IDs to default segments
    const segmentByCity = {
      ams: 'AMS-CS→AMS-DAM',
      ber: 'BER-HBF→BER-ZOO',
      lon: 'LON-KX→LON-LHR',
    };

    try {
      const res = await fetch(`${API_URL}/api/fleet/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'manual_demo',
          city: cityId,
          segment: segmentByCity[cityId] || segmentByCity.ams
        }),
      });

      if (!res.ok) {
        console.warn(`[useFleet] Replan API returned ${res.status}`);
      }

      const data = await res.json();
      return data;
    } catch (err) {
      console.error('[useFleet] Replan trigger error:', err);
      return { error: err.message, status: 'error' };
    }
  }, []);

  const { connected } = useSocket({
    'route:updated':   handleRouteUpdated,
    'replan:started':  handleReplanStarted,
    'replan:complete': handleReplanComplete,
    'co2:tick':        handleCo2Tick,
  });
  
  // Auto-optimize first 3 vehicles when city changes or on initial load
  useEffect(() => {
    if (!connected) return;

    // City-specific auto-optimization data
    // Note: Backend only has Amsterdam stops defined, so all cities use AMS routes for now
    // Future: Backend will support BER-*, LON-* stops
    const cityAutoOptimize = {
      ams: {
        vehicles: DEMO_FLEET.slice(0, 3),
        origins: ['AMS-CS', 'AMS-CS', 'AMS-CS'],
        destinations: ['AMS-ZUI', 'AMS-DAM', 'AMS-LEI'],
      },
      ber: {
        vehicles: [
          { id: 'VAN-B01', name: 'Van Berlin Alpha', type: 'diesel_van' },
          { id: 'VAN-B02', name: 'Van Berlin Beta', type: 'electric_van' },
          { id: 'VAN-B03', name: 'Van Berlin Gamma', type: 'hybrid_van' },
        ],
        // Using Amsterdam stops as backend placeholder
        origins: ['AMS-CS', 'AMS-CS', 'AMS-CS'],
        destinations: ['AMS-ZUI', 'AMS-DAM', 'AMS-LEI'],
      },
      lon: {
        vehicles: [
          { id: 'VAN-L01', name: 'Van London Alpha', type: 'diesel_van' },
          { id: 'VAN-L02', name: 'Van London Beta', type: 'electric_van' },
          { id: 'VAN-L03', name: 'Van London Gamma', type: 'diesel_truck' },
        ],
        // Using Amsterdam stops as backend placeholder
        origins: ['AMS-CS', 'AMS-CS', 'AMS-CS'],
        destinations: ['AMS-ZUI', 'AMS-DAM', 'AMS-LEI'],
      },
    };

    const config = cityAutoOptimize[selectedCity] || cityAutoOptimize.ams;
    const targets = config.vehicles;

    const runAutoSweep = async () => {
      // Staggered delay for visual map effect
      const wait = (ms) => new Promise(r => setTimeout(r, ms));

      for (let i = 0; i < targets.length; i++) {
        const v = targets[i];
        const origin = config.origins[i];
        const dest = config.destinations[i];

        try {
          console.log(`[useFleet] Optimizing ${v.id}: ${origin} → ${dest}`);
          const result = await optimizeRoute(origin, dest, v.id, v.type);
          console.log(`[useFleet] Success: ${v.id} has ${result.stops?.length ?? 0} stops`);
          await wait(1200);
        } catch (err) {
          console.error(`[useFleet] Auto-optimization failed for ${v.id}:`, err.message || err);
        }
      }
    };

    runAutoSweep();
  }, [connected, selectedCity, optimizeRoute]);


  return {
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    routes,
    replanState,
    co2Stats,
    lastTrace,
    optimizeRoute,
    triggerReplan,
    totalSavedKg: totalSavedRef.current,
    connected,
  };
}
