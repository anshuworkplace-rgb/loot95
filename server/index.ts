// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Server Entry Point
// Express API + SSE real-time + deal intelligence engine
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config';
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

// Email Alert Settings
app.post('/api/settings/email', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    res.status(400).json({ success: false, error: 'Invalid email address' });
    return;
  }
  const { setRecipientEmail } = require('./notifications/email.js');
  setRecipientEmail(email);
  res.json({ success: true, message: `Alert email set to ${email}`, email });
});

// Test Email Alert Trigger
app.post('/api/test/email', async (req, res) => {
  try {
    const { sendLoot95EmailAlert, ALERT_EMAIL_RECIPIENT } = await import('./notifications/email.js');
    const { deals } = store.getDealEvents({ limit: 1 });
    const sampleDeal = deals[0] || {
      id: 'test_deal',
      product: {
        title: 'Sony WH-1000XM5 Wireless Headphones (Black)',
        brand: 'Sony',
        category: 'Electronics',
        subcategory: 'Headphones',
        mrp: 34990,
        url: 'https://www.amazon.in/s?k=Sony+WH-1000XM5',
      },
      currentPrice: 1999,
      normalPrice: 28000,
      realDiscountPct: 93,
      displayedDiscountPct: 94,
      lootScore: 94.5,
      classification: 'LOOT_95',
      aiVerdict: 'VERIFIED_LOOT',
      aiReasoning: 'Verified genuine 93% price drop below 30-day historical median.',
    };

    const targetEmail = req.body.email || ALERT_EMAIL_RECIPIENT;
    const sent = await sendLoot95EmailAlert(sampleDeal as any, targetEmail);
    res.json({
      success: true,
      message: sent ? `Test email alert sent to ${targetEmail}` : 'Email alert logged to console.',
      targetEmail,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── Serve Built Static Frontend (Production SPA Fallback) ──────
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

// Catch-all handler for single page app (SPA) routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  if (req.accepts('html')) {
    res.sendFile(indexPath);
  } else {
    next();
  }
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

  const hasRealKeys = !!process.env.RAPIDAPI_KEY;

  if (hasRealKeys) {
    console.log('[Server] REAL DATA MODE ACTIVE — Disabling dummy simulator, polling real Amazon India deals.');
    // Poll real Amazon India deals immediately & every 60 seconds
    startRealAmazonPolling(60000);
  } else {
    console.log('[Server] SIMULATION MODE ACTIVE — Set RAPIDAPI_KEY in .env for live Amazon India deals.');
    initializeSimulator();
    startSimulation(3000);
  }

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
