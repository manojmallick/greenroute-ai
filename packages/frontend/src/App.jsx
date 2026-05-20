import { useState } from 'react';
import './index.css';

import LiveMap from './components/LiveMap/LiveMap';
import CO2Ticker from './components/CO2Ticker/CO2Ticker';
import CitySelector from './components/CitySelector/CitySelector';
import MultiCityComparison from './components/MultiCityComparison/MultiCityComparison';
import FleetDashboard from './components/FleetDashboard/FleetDashboard';
import AlgoTrace from './components/AlgoTrace/AlgoTrace';
import BeforeAfter from './components/BeforeAfter/BeforeAfter';
import ReplanBanner from './components/ReplanBanner/ReplanBanner';
import Leaderboard from './components/Leaderboard/Leaderboard';
import { useFleet } from './hooks/useFleet';

const CITY_INFO = {
  ams: { name: 'Amsterdam, NL', flag: '🇳🇱', vehicles: 8, routes: 156, co2Kg: 423.8 },
  ber: { name: 'Berlin, DE', flag: '🇩🇪', vehicles: 6, routes: 112, co2Kg: 378.5 },
  lon: { name: 'London, UK', flag: '🇬🇧', vehicles: 9, routes: 189, co2Kg: 512.3 },
};

const FLEET_BY_CITY = {
  ams: [
    { id: 'VAN-001', name: 'Van Alpha', type: 'diesel_van', lat: 52.3791, lon: 4.9003, cityId: 'ams' },
    { id: 'VAN-002', name: 'Van Beta', type: 'electric_van', lat: 52.3731, lon: 4.8945, cityId: 'ams' },
    { id: 'VAN-003', name: 'Van Gamma', type: 'diesel_van', lat: 52.3658, lon: 4.9201, cityId: 'ams' },
    { id: 'VAN-004', name: 'Van Delta', type: 'petrol_van', lat: 52.3812, lon: 4.8762, cityId: 'ams' },
    { id: 'VAN-005', name: 'Van Echo', type: 'electric_van', lat: 52.3545, lon: 4.9012, cityId: 'ams' },
    { id: 'VAN-006', name: 'Van Foxtrot', type: 'hybrid_van', lat: 52.3892, lon: 4.9145, cityId: 'ams' },
    { id: 'VAN-007', name: 'Van Golf', type: 'diesel_van', lat: 52.3623, lon: 4.8832, cityId: 'ams' },
    { id: 'VAN-008', name: 'Van Hotel', type: 'cargo_bike', lat: 52.3711, lon: 4.8923, cityId: 'ams' },
  ],
  ber: [
    { id: 'VAN-B01', name: 'Van Berlin Alpha', type: 'diesel_van', lat: 52.5200, lon: 13.4050, cityId: 'ber' },
    { id: 'VAN-B02', name: 'Van Berlin Beta', type: 'electric_van', lat: 52.5170, lon: 13.3880, cityId: 'ber' },
    { id: 'VAN-B03', name: 'Van Berlin Gamma', type: 'hybrid_van', lat: 52.5140, lon: 13.4200, cityId: 'ber' },
    { id: 'VAN-B04', name: 'Van Berlin Delta', type: 'diesel_van', lat: 52.5300, lon: 13.4000, cityId: 'ber' },
    { id: 'VAN-B05', name: 'Van Berlin Echo', type: 'electric_van', lat: 52.5050, lon: 13.3950, cityId: 'ber' },
    { id: 'VAN-B06', name: 'Van Berlin Foxtrot', type: 'petrol_van', lat: 52.5250, lon: 13.4150, cityId: 'ber' },
  ],
  lon: [
    { id: 'VAN-L01', name: 'Van London Alpha', type: 'diesel_van', lat: 51.5074, lon: -0.1278, cityId: 'lon' },
    { id: 'VAN-L02', name: 'Van London Beta', type: 'electric_van', lat: 51.5150, lon: -0.1200, cityId: 'lon' },
    { id: 'VAN-L03', name: 'Van London Gamma', type: 'diesel_truck', lat: 51.5000, lon: -0.1350, cityId: 'lon' },
    { id: 'VAN-L04', name: 'Van London Delta', type: 'hybrid_van', lat: 51.5200, lon: -0.1100, cityId: 'lon' },
    { id: 'VAN-L05', name: 'Van London Echo', type: 'electric_van', lat: 51.4950, lon: -0.1400, cityId: 'lon' },
    { id: 'VAN-L06', name: 'Van London Foxtrot', type: 'diesel_van', lat: 51.5100, lon: -0.1000, cityId: 'lon' },
    { id: 'VAN-L07', name: 'Van London Golf', type: 'cargo_bike', lat: 51.5250, lon: -0.1350, cityId: 'lon' },
    { id: 'VAN-L08', name: 'Van London Hotel', type: 'hybrid_van', lat: 51.5050, lon: -0.1150, cityId: 'lon' },
    { id: 'VAN-L09', name: 'Van London India', type: 'electric_van', lat: 51.5300, lon: -0.1250, cityId: 'lon' },
  ],
};

const DEMO_STOPS = [
  { id: 'AMS-CS',  label: 'Amsterdam Centraal' },
  { id: 'AMS-DAM', label: 'Dam Square' },
  { id: 'AMS-LEI', label: 'Leidseplein' },
  { id: 'AMS-REM', label: 'Rembrandtplein' },
  { id: 'AMS-WTR', label: 'Waterlooplein' },
  { id: 'AMS-OOS', label: 'Oosterpark' },
  { id: 'AMS-ZUI', label: 'Amsterdam Zuid' },
  { id: 'AMS-SLO', label: 'Sloterdijk' },
  { id: 'AMS-ARP', label: 'Amsterdam ArenA' },
  { id: 'AMS-SCH', label: 'Science Park' },
];

export default function App() {
  const [selectedCity, setSelectedCity] = useState('ams');
  const {
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    routes,
    replanState,
    co2Stats,
    lastTrace,
    optimizeRoute,
    triggerReplan,
    connected,
  } = useFleet();

  const [optimizing, setOptimizing] = useState(false);
  const [replanTriggering, setReplanTriggering] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // Filter vehicles based on selected city
  const cityVehicles = FLEET_BY_CITY[selectedCity] || FLEET_BY_CITY.ams;
  const cityInfo = CITY_INFO[selectedCity] || CITY_INFO.ams;

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedRoute = selectedVehicleId ? routes[selectedVehicleId] : null;

  const handleOptimize = async () => {
    if (!selectedVehicle) return;
    setOptimizing(true);
    setRouteError(null);
    try {
      // Route from vehicle's nearest stop to Amsterdam Zuid as demo
      await optimizeRoute('AMS-CS', 'AMS-ZUI', selectedVehicle.id, selectedVehicle.type);
    } catch (err) {
      setRouteError(err.message);
    } finally {
      setOptimizing(false);
    }
  };

  const handleTriggerReplan = async () => {
    setReplanTriggering(true);
    try {
      await triggerReplan();
    } catch (err) {
      console.error('Replan trigger failed:', err);
    } finally {
      setTimeout(() => setReplanTriggering(false), 2000);
    }
  };

  // Accumulate total saved from all routes
  const totalSavedKg = Object.values(routes).reduce((s, r) => s + (r.co2SavedKg ?? 0), 0);

  return (
    <div className="app-shell">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-logo">
          <span className="leaf">🌿</span>
          Green<span>Route</span> AI
          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: 8 }}>
            AlgoFest 2026
          </span>
        </div>

        <div className="header-right">
          <div className="status-dot" style={connected ? {} : { background: 'var(--color-amber)', boxShadow: '0 0 8px var(--color-amber)' }} />
          <div className="status-label">{connected ? 'Live' : 'Connecting…'}</div>

          {selectedVehicle && (
            <button
              className="btn btn-ghost"
              onClick={handleOptimize}
              disabled={optimizing}
              id="btn-optimize-route"
              title={`Optimize route for ${selectedVehicleId}`}
            >
              {optimizing ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Computing…</> : '⚡ Optimize Route'}
            </button>
          )}

          <button
            className="btn btn-primary"
            onClick={handleTriggerReplan}
            disabled={replanTriggering}
            id="btn-trigger-replan"
            title="Simulate traffic spike and trigger full fleet replan"
          >
            {replanTriggering ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Triggering…</> : '🚨 Simulate Spike'}
          </button>
        </div>
      </header>

      {/* ── Live Map ────────────────────────────────────────────────── */}
      <LiveMap
        vehicles={cityVehicles}
        routes={routes}
        selectedVehicleId={selectedVehicleId}
        selectedCity={selectedCity}
        cityInfo={cityInfo}
        onVehicleClick={setSelectedVehicleId}
        onSegmentClick={triggerReplan}
      />

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="sidebar">

        {/* Replan banner (shown when replan event received) */}
        {replanState && <ReplanBanner replanState={replanState} />}

        {/* Route error */}
        {routeError && (
          <div className="replan-banner started" role="alert">
            <div className="replan-pulse" />
            <span>⚠️ {routeError} — is the API Gateway running?</span>
          </div>
        )}

        {/* CO₂ Ticker */}
        <CO2Ticker co2Stats={co2Stats} totalSavedOverride={totalSavedKg > 0 ? totalSavedKg : undefined} />

        {/* Multi-City Comparison (FIRST so it's visible) */}
        <MultiCityComparison />

        {/* City Selector */}
        <CitySelector selectedCity={selectedCity} onCityChange={setSelectedCity} />

        {/* Fleet Dashboard */}
        <FleetDashboard
          vehicles={cityVehicles}
          routes={routes}
          selectedVehicleId={selectedVehicleId}
          onSelect={setSelectedVehicleId}
        />

        {/* Eco-Leaderboard */}
        <Leaderboard routes={routes} />

        {/* Before/After comparison */}
        <BeforeAfter selectedRoute={selectedRoute} vehicleId={selectedVehicleId} />

        {/* AlgoTrace */}
        <AlgoTrace trace={lastTrace?.trace} algorithm={selectedRoute?.algorithm} />

        <div style={{
          fontSize: '0.65rem',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          padding: '8px 0 8px',
          lineHeight: 1.6,
        }}>
          <strong>Demo Guide</strong><br />
          1. Select vehicle → Optimize Route<br />
          2. Click segments on map to trigger AI Agents<br />
          3. Watch Eco-Leaderboard for savings
        </div>
      </aside>
    </div>
  );
}
