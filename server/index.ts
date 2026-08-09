// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Server Entry Point
// Express API + SSE real-time + deal intelligence engine
// 100% REAL DATA MODE — No simulation, no fake data
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { store } from './store.js';
import { sseClients, broadcastStatus } from './engine/pipeline.js';
import { startRealAmazonPolling, stopRealAmazonPolling, getRapidApiDiagnostics } from './connectors/rapidapi.js';
import type { DiagnosticsSubsystem } from '../shared/types.js';

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
    store.addError('ManualSubmit', e.message || 'Failed to submit deal');
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
app.post('/api/settings/email', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    res.status(400).json({ success: false, error: 'Invalid email address' });
    return;
  }
  const { setRecipientEmail } = await import('./notifications/email.js');
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

// ─── Diagnostics Endpoint ─────────────────────────────────────

app.get('/api/diagnostics', (_req, res) => {
  const now = new Date().toISOString();
  const metrics = store.getMetrics();
  const connectors = store.getConnectorStatuses();
  const storeDiag = store.getStoreDiagnostics();
  const rapidApiDiag = getRapidApiDiagnostics();
  const recentErrors = store.getRecentErrors();

  // ─── Subsystem Checks ────────────────────────────────────
  const subsystems: DiagnosticsSubsystem[] = [];

  // 1. RapidAPI Amazon Connector
  const amazonConnector = connectors.find(c => c.platform === 'amazon');
  subsystems.push({
    name: 'RapidAPI Amazon India Connector',
    status: !rapidApiDiag.apiKeyConfigured
      ? 'UNCONFIGURED'
      : amazonConnector?.status === 'ONLINE'
        ? 'OK'
        : amazonConnector?.status === 'ERROR'
          ? 'ERROR'
          : 'WARNING',
    message: !rapidApiDiag.apiKeyConfigured
      ? 'RAPIDAPI_KEY not set in environment variables'
      : amazonConnector?.status === 'ONLINE'
        ? `Connected. ${amazonConnector.eventsProcessed} events processed. Last success: ${amazonConnector.lastSuccessAt || 'N/A'}`
        : amazonConnector?.errorMessage || 'Status unknown',
    lastChecked: now,
    details: {
      ...rapidApiDiag,
      connectorStatus: amazonConnector?.status || 'NOT_INITIALIZED',
      lastSuccessAt: amazonConnector?.lastSuccessAt,
      lastErrorAt: amazonConnector?.lastErrorAt,
      eventsProcessed: amazonConnector?.eventsProcessed || 0,
      avgLatencyMs: amazonConnector?.avgLatencyMs || 0,
    },
  });

  // 2. Gemini AI Deal Judge
  const geminiKey = process.env.GEMINI_API_KEY;
  subsystems.push({
    name: 'Gemini AI Deal Judge',
    status: geminiKey ? 'OK' : 'UNCONFIGURED',
    message: geminiKey
      ? `API key configured (${geminiKey.substring(0, 8)}...). AI verdicts active.`
      : 'GEMINI_API_KEY not set. Using rule-based fallback judge.',
    lastChecked: now,
    details: {
      keyConfigured: !!geminiKey,
      model: 'gemini-2.0-flash',
      fallback: !geminiKey ? 'Rule-based judge active' : null,
    },
  });

  // 3. Email Alert Service
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  subsystems.push({
    name: 'Email Alert Service',
    status: (smtpUser && smtpPass) ? 'OK' : 'UNCONFIGURED',
    message: (smtpUser && smtpPass)
      ? `SMTP configured with ${smtpUser}. Email alerts active.`
      : 'SMTP_USER/SMTP_PASS not set. Alerts logged to console only.',
    lastChecked: now,
    details: {
      smtpConfigured: !!(smtpUser && smtpPass),
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    },
  });

  // 4. SSE Real-time Push
  subsystems.push({
    name: 'SSE Real-time Push',
    status: sseClients.size > 0 ? 'OK' : 'WARNING',
    message: sseClients.size > 0
      ? `${sseClients.size} active client(s) receiving real-time events.`
      : 'No SSE clients connected. UI may not be receiving live updates.',
    lastChecked: now,
    details: { clientCount: sseClients.size },
  });

  // 5. Data Store
  subsystems.push({
    name: 'In-Memory Data Store',
    status: storeDiag.productCount >= 0 ? 'OK' : 'ERROR',
    message: `${storeDiag.productCount} products, ${storeDiag.dealEventCount} deals (${storeDiag.activeDealCount} active), ${storeDiag.priceHistoryEntries} price points tracked.`,
    lastChecked: now,
    details: storeDiag,
  });

  // ─── Overall Status ──────────────────────────────────────
  const hasError = subsystems.some(s => s.status === 'ERROR');
  const hasWarning = subsystems.some(s => s.status === 'WARNING' || s.status === 'UNCONFIGURED');
  const overallStatus = hasError ? 'CRITICAL' : hasWarning ? 'DEGRADED' : 'HEALTHY';

  // ─── Performance ─────────────────────────────────────────
  const memUsage = process.memoryUsage();
  const uptimeMs = Date.now() - new Date(metrics.uptimeHours ? Date.now() - metrics.uptimeHours * 3600000 : Date.now()).getTime();
  const eventsPerMinute = metrics.uptimeHours > 0
    ? Math.round((metrics.priceEventsProcessed / (metrics.uptimeHours * 60)) * 10) / 10
    : 0;

  res.json({
    success: true,
    data: {
      timestamp: now,
      overallStatus,
      subsystems,
      recentErrors,
      storeHealth: {
        productCount: storeDiag.productCount,
        dealEventCount: storeDiag.dealEventCount,
        activeDealCount: storeDiag.activeDealCount,
        priceHistoryEntries: storeDiag.priceHistoryEntries,
        alertCount: storeDiag.alertCount,
      },
      performance: {
        uptimeHours: metrics.uptimeHours,
        avgProcessingLatencyMs: metrics.avgProcessingLatencyMs,
        eventsPerMinute,
        sseClientCount: sseClients.size,
        memoryUsageMB: Math.round(memUsage.heapUsed / 1024 / 1024 * 10) / 10,
      },
    },
    timestamp: now,
  });
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
  console.log(`  API Server:     http://localhost:${PORT}`);
  console.log(`  SSE Endpoint:   http://localhost:${PORT}/api/events`);
  console.log(`  Diagnostics:    http://localhost:${PORT}/api/diagnostics`);
  console.log('  Status:         ONLINE');
  console.log('  Mode:           100% REAL AMAZON INDIA DATA');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Always purge any leftover simulated data from old runs
  store.purgeSimulatedData();

  // Start real Amazon India deal polling
  console.log('[Server] Starting 100% REAL DATA MODE — Amazon India API connector.');
  startRealAmazonPolling(20000);

  // Broadcast status & heartbeat every 5 seconds to keep SSE clients alive
  setInterval(() => broadcastStatus(), 5000);
});

// ─── Graceful Shutdown ────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  stopRealAmazonPolling();
  store.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopRealAmazonPolling();
  store.shutdown();
  process.exit(0);
});
