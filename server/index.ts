// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Server Entry Point
// Express API + SSE real-time + deal intelligence engine
// ═══════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import path from 'path';
import { store } from './store.js';
import { sseClients, broadcastStatus } from './engine/pipeline.js';
import { startSimulation, stopSimulation, initializeSimulator } from './connectors/simulator.js';
import { startRealAmazonPolling, stopRealAmazonPolling } from './connectors/rapidapi.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// ─── Middleware ───────────────────────────────────────────────

app.use(cors({ origin: true }));
app.use(express.json());

// ─── SSE Endpoint ─────────────────────────────────────────────

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial status
  const metrics = store.getMetrics();
  const connectors = store.getConnectorStatuses();
  res.write(`data: ${JSON.stringify({
    type: 'status',
    data: { isOnline: true, uptime: metrics.uptimeHours, connectors, metrics, lastUpdated: new Date().toISOString() }
  })}\n\n`);

  // Send recent deals
  const { deals } = store.getDealEvents({ limit: 20 });
  for (const deal of deals.reverse()) {
    res.write(`data: ${JSON.stringify({ type: 'deal', data: deal })}\n\n`);
  }

  sseClients.add(res);
  console.log(`[SSE] Client connected (total: ${sseClients.size})`);

  // Heartbeat every 15s
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', data: { ts: new Date().toISOString() } })}\n\n`);
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    console.log(`[SSE] Client disconnected (total: ${sseClients.size})`);
  });
});

// ─── API Routes ───────────────────────────────────────────────

// System status
app.get('/api/status', (_req, res) => {
  const metrics = store.getMetrics();
  const connectors = store.getConnectorStatuses();
  res.json({
    success: true,
    data: {
      isOnline: true,
      uptime: metrics.uptimeHours,
      connectors,
      metrics,
      lastUpdated: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
});

// All deals feed
app.get('/api/deals', (req, res) => {
  const classification = req.query.classification as string | undefined;
  const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

  const { deals, total } = store.getDealEvents({ classification, minScore, limit, offset });

  res.json({
    success: true,
    data: { deals, total, hasMore: offset + limit < total },
    timestamp: new Date().toISOString(),
  });
});

// LOOT 95 deals only
app.get('/api/deals/loot95', (_req, res) => {
  const deals = store.getLoot95Deals();
  res.json({
    success: true,
    data: { deals, total: deals.length, hasMore: false },
    timestamp: new Date().toISOString(),
  });
});

// Rare events
app.get('/api/deals/rare', (_req, res) => {
  const deals = store.getRareEvents();
  res.json({
    success: true,
    data: { deals, total: deals.length, hasMore: false },
    timestamp: new Date().toISOString(),
  });
});

// Single deal detail
app.get('/api/deals/:id', (req, res) => {
  const deal = store.getDealEvent(req.params.id);
  if (!deal) {
    res.status(404).json({ success: false, error: 'Deal not found', timestamp: new Date().toISOString() });
    return;
  }

  // Get full price history for chart
  const history = store.getPriceHistory(deal.productId);
  const stats = store.getStats(deal.productId);

  res.json({
    success: true,
    data: { ...deal, priceHistory: history, allStatistics: stats },
    timestamp: new Date().toISOString(),
  });
});

// Product list
app.get('/api/products', (_req, res) => {
  const products = store.getAllProducts();
  res.json({
    success: true,
    data: { products, total: products.length },
    timestamp: new Date().toISOString(),
  });
});

// Product price history
app.get('/api/products/:id/history', (req, res) => {
  const days = req.query.days ? parseInt(req.query.days as string) : undefined;
  const history = store.getPriceHistory(req.params.id, days);
  const stats = store.getStats(req.params.id);
  res.json({
    success: true,
    data: { history, statistics: stats },
    timestamp: new Date().toISOString(),
  });
});

// Alerts
app.get('/api/alerts', (_req, res) => {
  const alerts = store.getAlerts();
  res.json({
    success: true,
    data: { alerts, total: alerts.length },
    timestamp: new Date().toISOString(),
  });
});

// Submit manual deal
app.post('/api/deals/submit', async (req, res) => {
  try {
    const { submitManualDeal } = await import('./connectors/manual.js');
    const deal = await submitManualDeal(req.body);
    res.json({
      success: true,
      data: deal,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(400).json({
      success: false,
      error: e.message || 'Failed to submit deal',
      timestamp: new Date().toISOString(),
    });
  }
});

// Metrics
app.get('/api/metrics', (_req, res) => {
  const metrics = store.getMetrics();
  res.json({
    success: true,
    data: metrics,
    timestamp: new Date().toISOString(),
  });
});

// ─── Start Server ─────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🎯 LOOT 95 — Deal Intelligence Engine');
  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  API Server:    http://localhost:${PORT}`);
  console.log(`  SSE Endpoint:  http://localhost:${PORT}/api/events`);
  console.log('  Status:        ONLINE');
  console.log('  Mode:          SIMULATION (realistic electronics data)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Initialize and start simulation
  initializeSimulator();

  // Start generating events every 3 seconds
  startSimulation(3000);

  // Start Real Amazon India API Polling (if RAPIDAPI_KEY is present)
  startRealAmazonPolling(600000);

  // Broadcast status updates every 10 seconds
  setInterval(() => broadcastStatus(), 10000);
});

// ─── Graceful Shutdown ────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  stopSimulation();
  stopRealAmazonPolling();
  store.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopSimulation();
  stopRealAmazonPolling();
  store.shutdown();
  process.exit(0);
});
