#!/usr/bin/env node
/**
 * scripts/seed-db.js
 *
 * Populate PostgreSQL with demo fleet data (20 vehicles).
 * Requires DATABASE_URL to be set in .env.
 *
 * Usage:
 *   node scripts/seed-db.js
 *
 * Requires: docker-compose up postgres (or a live PostgreSQL instance)
 */

'use strict';

require('dotenv').config();

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('❌ DATABASE_URL not set. Copy .env.example to .env and configure it.');
  process.exit(1);
}

const fleet = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'seed', 'demo-fleet.json'), 'utf8')
);

async function seed() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('[seed-db] Connected to PostgreSQL');

  // Apply schema
  const schema = fs.readFileSync(path.join(process.cwd(), 'data', 'seed', 'schema.sql'), 'utf8');
  await client.query(schema);
  console.log('[seed-db] Schema applied');

  // Insert vehicles (upsert)
  let inserted = 0;
  for (const v of fleet) {
    await client.query(
      `INSERT INTO vehicles (id, name, type, capacity_kg, current_lat, current_lon, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE
         SET name=EXCLUDED.name, type=EXCLUDED.type,
             capacity_kg=EXCLUDED.capacity_kg,
             current_lat=EXCLUDED.current_lat,
             current_lon=EXCLUDED.current_lon,
             status=EXCLUDED.status,
             updated_at=NOW()`,
      [v.id, v.name, v.type, v.capacity_kg, v.current_lat, v.current_lon, v.status]
    );
    inserted++;
  }

  await client.end();
  console.log(`[seed-db] ✅ Seeded ${inserted} vehicles`);
}

seed().catch((err) => {
  console.error('[seed-db] ❌ Seed failed:', err.message);
  process.exit(1);
});
