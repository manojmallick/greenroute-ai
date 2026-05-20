'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');

const routeRouter = require('./routes/route');
const carbonRouter = require('./routes/carbon');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL ?? '*', methods: ['GET', 'POST'] },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);
  socket.on('fleet:subscribe', ({ cityId }) => {
    socket.join(`city:${cityId ?? 'amsterdam'}`);
    console.log(`[socket] ${socket.id} subscribed to city: ${cityId ?? 'amsterdam'}`);
  });
  socket.on('disconnect', () => console.log(`[socket] Disconnected: ${socket.id}`));
});

// ─── Redis relay: bridge agent events → Socket.IO ─────────────────────────────
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function startRedisRelay() {
  let sub;
  try {
    sub = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
    await sub.connect();
    console.log('[api-gateway] ✅ Redis relay connected');
  } catch (err) {
    console.warn(`[api-gateway] ⚠️  Redis unavailable — Socket.IO relay disabled (${err.message})`);
    return;
  }

  // Subscribe to all channels published by the agents
  const channels = [
    'greenroute:route-updated',
    'greenroute:replan-started',
    'greenroute:replan-complete',
    'greenroute:co2:tick',
  ];
  await sub.subscribe(...channels);
  console.log(`[api-gateway] Subscribed to channels: ${channels.join(', ')}`);

  sub.on('message', (channel, message) => {
    let data;
    try { data = JSON.parse(message); } catch { return; }

    // Map Redis channel → Socket.IO event name
    const eventMap = {
      'greenroute:route-updated':    'route:updated',
      'greenroute:replan-started':   'replan:started',
      'greenroute:replan-complete':  'replan:complete',
      'greenroute:co2:tick':         'co2:tick',
    };

    const event = eventMap[channel];
    if (event) {
      // Broadcast to all connected clients (or target city room in production)
      io.emit(event, data);
      if (event !== 'co2:tick') { // don't log every tick
        console.log(`[socket] Emitted ${event} to all clients`);
      }
    }
  });

  // Keep a publisher for any gateway-initiated events
  const pub = new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
  try { await pub.connect(); app.set('redisPub', pub); } catch (_) {}
}

// Start Redis relay (non-blocking — gateway works without it)
startRedisRelay().catch((err) => console.error('[redis-relay]', err.message));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL ?? '*' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'greenroute-api-gateway',
    version: '2.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    redis: !!app.get('redisPub'),
  });
});

app.use('/api', routeRouter);
app.use('/api', carbonRouter);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3000', 10);
server.listen(PORT, () => {
  console.log(`[api-gateway] Listening on http://localhost:${PORT}`);
  console.log(`[api-gateway] Health: http://localhost:${PORT}/api/health`);
});
