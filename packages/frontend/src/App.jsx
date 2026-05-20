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
        vehicles={vehicles}
        routes={routes}
        selectedVehicleId={selectedVehicleId}
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

        {/* City Selector & Multi-City Comparison */}
        <CitySelector selectedCity={selectedCity} onCityChange={setSelectedCity} />
        <MultiCityComparison />

        {/* Fleet Dashboard */}
        <FleetDashboard
          vehicles={vehicles}
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
