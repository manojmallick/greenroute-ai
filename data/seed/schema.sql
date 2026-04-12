-- GreenRoute AI — PostgreSQL Schema
-- Version: 1.0.0
-- Run: psql -U greenroute -d greenroute -f data/seed/schema.sql

-- ─── Vehicles ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicles (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('diesel_van', 'petrol_van', 'electric_van', 'cargo_bike', 'diesel_truck', 'hybrid_van')),
  capacity_kg     NUMERIC(8,2),
  current_lat     NUMERIC(9,6),
  current_lon     NUMERIC(9,6),
  status          TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'en_route', 'stopped', 'maintenance')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Routes ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS routes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      TEXT NOT NULL REFERENCES vehicles(id),
  origin_id       TEXT NOT NULL,
  destination_id  TEXT NOT NULL,
  algorithm       TEXT NOT NULL DEFAULT 'astar',  -- 'astar' | 'dijkstra'
  status          TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  total_distance_km   NUMERIC(10,3),
  total_duration_min  NUMERIC(8,2),
  total_co2_kg        NUMERIC(10,4),
  total_shadow_cost_usd NUMERIC(10,4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ─── Route Segments ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS route_segments (
  id              BIGSERIAL PRIMARY KEY,
  route_id        UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  sequence        INTEGER NOT NULL,
  from_stop_id    TEXT NOT NULL,
  to_stop_id      TEXT NOT NULL,
  distance_km     NUMERIC(8,3),
  speed_kmh       NUMERIC(6,2),
  co2_kg          NUMERIC(8,4),
  UNIQUE(route_id, sequence)
);

-- ─── CO₂ Logs ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS co2_logs (
  id              BIGSERIAL PRIMARY KEY,
  vehicle_id      TEXT REFERENCES vehicles(id),
  route_id        UUID REFERENCES routes(id),
  co2_kg          NUMERIC(10,4) NOT NULL,
  saved_co2_kg    NUMERIC(10,4) DEFAULT 0,
  saved_usd       NUMERIC(10,4) DEFAULT 0,
  reduction_pct   NUMERIC(5,2) DEFAULT 0,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Replan Events ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS replan_events (
  id              BIGSERIAL PRIMARY KEY,
  trigger_reason  TEXT NOT NULL,  -- 'traffic_spike' | 'weather' | 'manual'
  vehicles_affected INTEGER,
  total_co2_saved_kg NUMERIC(10,4),
  time_saved_min     NUMERIC(8,2),
  gemini_reasoning   TEXT,         -- full Gemini response (Week 2)
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_routes_vehicle_id ON routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_co2_logs_recorded_at ON co2_logs(recorded_at);
CREATE INDEX IF NOT EXISTS idx_route_segments_route_id ON route_segments(route_id);
