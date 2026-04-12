import { useState, useCallback, useRef } from 'react';
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
 */
export function useFleet() {
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

  const { connected } = useSocket({
    'route:updated':   handleRouteUpdated,
    'replan:started':  handleReplanStarted,
    'replan:complete': handleReplanComplete,
    'co2:tick':        handleCo2Tick,
  });

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
  const triggerReplan = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/fleet/replan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'manual_demo' }),
    });
    return res.json();
  }, []);

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
