// ═══════════════════════════════════════════════════════════════
// LOOT 95 — In-Memory Data Store
// Persistent via JSON file backup, upgradeable to Supabase
// ═══════════════════════════════════════════════════════════════

import { v4 as uuid } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  Product, PriceEvent, PriceHistoryPoint, PriceStatistics,
  DealEvent, Alert, SystemMetrics, ConnectorInfo, Platform
} from '../shared/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

interface StoreData {
  products: Map<string, Product>;
  priceHistory: Map<string, PriceHistoryPoint[]>; // productId -> history
  priceStats: Map<string, PriceStatistics[]>;     // productId -> stats per period
  dealEvents: DealEvent[];
  alerts: Alert[];
  connectors: Map<string, ConnectorInfo>;
  metrics: SystemMetrics;
  startedAt: string;
}

class Store {
  private products = new Map<string, Product>();
  private priceHistory = new Map<string, PriceHistoryPoint[]>();
  private priceStats = new Map<string, PriceStatistics[]>();
  private dealEvents: DealEvent[] = [];
  private alerts: Alert[] = [];
  private recentErrors: Array<{ timestamp: string; source: string; message: string }> = [];
  private connectors = new Map<string, ConnectorInfo>();
  private metrics: SystemMetrics = {
    productsMonitored: 0,
    priceEventsProcessed: 0,
    anomaliesDetected: 0,
    extremeDeals: 0,
    loot95Events: 0,
    avgProcessingLatencyMs: 0,
    avgDetectionLatencyMs: 0,
    falsePositiveRate: 0,
    trueLootRate: 0,
    uptimeHours: 0,
  };
  private startedAt = new Date().toISOString();
  private saveTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.load();
    // Auto-save every 30 seconds
    this.saveTimer = setInterval(() => this.save(), 30000);
  }

  // ─── Purge Simulated Data ──────────────────────────────────────
  purgeSimulatedData(): void {
    this.connectors.delete('simulator');
    const junkKeywords = ['garbage bag', 'trash bag', 'skate scooter', 'floor mat', 'bath mat', 'doormat'];

    for (const [id, p] of this.products.entries()) {
      if (id.startsWith('sim_') || id.startsWith('amz_in_sim_')) {
        this.products.delete(id);
        this.priceHistory.delete(id);
        this.priceStats.delete(id);
      } else if (p) {
        p.title = p.title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        const lower = p.title.toLowerCase();
        if (junkKeywords.some(kw => lower.includes(kw))) {
          this.products.delete(id);
          this.priceHistory.delete(id);
          this.priceStats.delete(id);
          continue;
        }
        if (!p.url || !p.url.startsWith('http') || p.url.includes('B09R673DBP')) {
          p.url = `https://www.amazon.in/s?k=${encodeURIComponent(p.title)}`;
        }
      }
    }

    this.dealEvents = this.dealEvents.filter(d => {
      if (!d.product || d.productId.startsWith('sim_') || d.productId.startsWith('amz_in_sim_')) return false;
      d.product.title = d.product.title.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      const lower = d.product.title.toLowerCase();
      if (junkKeywords.some(kw => lower.includes(kw))) return false;
      if (!d.product.url || !d.product.url.startsWith('http') || d.product.url.includes('B09R673DBP')) {
        d.product.url = `https://www.amazon.in/s?k=${encodeURIComponent(d.product.title)}`;
      }
      return true;
    });

    this.metrics.productsMonitored = this.products.size;
  }

  // ─── Products ───────────────────────────────────────────────

  addProduct(product: Product): void {
    this.products.set(product.id, product);
    this.metrics.productsMonitored = this.products.size;
  }

  getProduct(id: string): Product | undefined {
    return this.products.get(id);
  }

  getAllProducts(): Product[] {
    return Array.from(this.products.values());
  }

  updateProductPrice(productId: string, price: number, effectivePrice: number): void {
    const product = this.products.get(productId);
    if (product) {
      product.currentPrice = price;
      product.effectivePrice = effectivePrice;
      product.updatedAt = new Date().toISOString();
    }
  }

  // ─── Price History ──────────────────────────────────────────

  addPricePoint(productId: string, point: PriceHistoryPoint): void {
    const history = this.priceHistory.get(productId) || [];
    history.push(point);
    // Keep last 2000 points per product
    if (history.length > 2000) history.splice(0, history.length - 2000);
    this.priceHistory.set(productId, history);
  }

  getPriceHistory(productId: string, days?: number): PriceHistoryPoint[] {
    const history = this.priceHistory.get(productId) || [];
    if (!days) return history;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return history.filter(p => new Date(p.timestamp).getTime() >= cutoff);
  }

  // ─── Price Statistics ───────────────────────────────────────

  setStats(productId: string, stats: PriceStatistics[]): void {
    this.priceStats.set(productId, stats);
  }

  getStats(productId: string): PriceStatistics[] {
    return this.priceStats.get(productId) || [];
  }

  getStatsByPeriod(productId: string, period: string): PriceStatistics | undefined {
    return this.getStats(productId).find(s => s.period === period);
  }

  // ─── Deal Events ───────────────────────────────────────────

  addDealEvent(deal: DealEvent): void {
    this.dealEvents.unshift(deal); // newest first
    // Keep last 500 deals
    if (this.dealEvents.length > 500) this.dealEvents.length = 500;

    // Update metrics
    this.metrics.priceEventsProcessed++;
    if (deal.classification === 'EXTREME' || deal.classification === 'LOOT_95') {
      this.metrics.extremeDeals++;
    }
    if (deal.classification === 'LOOT_95') {
      this.metrics.loot95Events++;
    }
    if (deal.lootScore >= 50) {
      this.metrics.anomaliesDetected++;
    }
  }

  getDealEvents(options?: {
    classification?: string;
    minScore?: number;
    limit?: number;
    offset?: number;
  }): { deals: DealEvent[]; total: number } {
    let filtered = this.dealEvents.filter(d => d.isActive);

    if (options?.classification) {
      filtered = filtered.filter(d => d.classification === options.classification);
    }
    if (options?.minScore !== undefined) {
      filtered = filtered.filter(d => d.lootScore >= options.minScore!);
    }

    const total = filtered.length;
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    return {
      deals: filtered.slice(offset, offset + limit),
      total,
    };
  }

  getDealEvent(id: string): DealEvent | undefined {
    return this.dealEvents.find(d => d.id === id);
  }

  getLoot95Deals(): DealEvent[] {
    return this.dealEvents.filter(d => 
      d.isActive && (d.classification === 'LOOT_95' || d.classification === 'EXTREME')
    );
  }

  getRareEvents(): DealEvent[] {
    return this.dealEvents.filter(d => d.isActive && d.isNeverSeenBefore);
  }

  // ─── Alerts ─────────────────────────────────────────────────

  addAlert(alert: Alert): void {
    this.alerts.unshift(alert);
    if (this.alerts.length > 200) this.alerts.length = 200;
  }

  getAlerts(): Alert[] {
    return this.alerts;
  }

  // ─── Connectors ─────────────────────────────────────────────

  setConnectorStatus(info: ConnectorInfo): void {
    this.connectors.set(info.platform, info);
  }

  getConnectorStatuses(): ConnectorInfo[] {
    return Array.from(this.connectors.values());
  }

  // ─── Metrics ────────────────────────────────────────────────

  getMetrics(): SystemMetrics {
    const uptimeMs = Date.now() - new Date(this.startedAt).getTime();
    this.metrics.uptimeHours = Math.round(uptimeMs / 3600000 * 10) / 10;
    this.metrics.productsMonitored = this.products.size;
    return { ...this.metrics };
  }

  incrementProcessedEvents(): void {
    this.metrics.priceEventsProcessed++;
  }

  updateLatency(processingMs: number, detectionMs: number): void {
    // Running average
    const n = this.metrics.priceEventsProcessed || 1;
    this.metrics.avgProcessingLatencyMs = Math.round(
      (this.metrics.avgProcessingLatencyMs * (n - 1) + processingMs) / n
    );
    this.metrics.avgDetectionLatencyMs = Math.round(
      (this.metrics.avgDetectionLatencyMs * (n - 1) + detectionMs) / n
    );
  }

  // ─── Persistence ────────────────────────────────────────────

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

      const data = {
        products: Object.fromEntries(this.products),
        priceHistory: Object.fromEntries(this.priceHistory),
        priceStats: Object.fromEntries(this.priceStats),
        dealEvents: this.dealEvents.slice(0, 200), // Save last 200
        metrics: this.metrics,
        startedAt: this.startedAt,
      };

      fs.writeFileSync(STORE_FILE, JSON.stringify(data), 'utf-8');
    } catch (e) {
      console.error('[Store] Save failed:', e);
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(STORE_FILE)) return;
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const data = JSON.parse(raw);

      if (data.products) {
        this.products = new Map(Object.entries(data.products));
      }
      if (data.priceHistory) {
        this.priceHistory = new Map(Object.entries(data.priceHistory));
      }
      if (data.priceStats) {
        this.priceStats = new Map(Object.entries(data.priceStats));
      }
      if (data.dealEvents) {
        this.dealEvents = data.dealEvents;
      }
      if (data.metrics) {
        this.metrics = { ...this.metrics, ...data.metrics };
      }
      if (data.startedAt) {
        this.startedAt = data.startedAt;
      }

      console.log(`[Store] Loaded ${this.products.size} products, ${this.dealEvents.length} deals`);
    } catch (e) {
      console.error('[Store] Load failed, starting fresh:', e);
    }
  }

  shutdown(): void {
    if (this.saveTimer) clearInterval(this.saveTimer);
    this.save();
  }

  // ─── Error Tracking ───────────────────────────────────────

  addError(source: string, message: string): void {
    this.recentErrors.unshift({
      timestamp: new Date().toISOString(),
      source,
      message,
    });
    if (this.recentErrors.length > 50) this.recentErrors.length = 50;
  }

  getRecentErrors(): Array<{ timestamp: string; source: string; message: string }> {
    return this.recentErrors.slice(0, 20);
  }

  // ─── Store Diagnostics ────────────────────────────────────

  getStoreDiagnostics() {
    let priceHistoryEntries = 0;
    for (const [, history] of this.priceHistory) {
      priceHistoryEntries += history.length;
    }

    return {
      productCount: this.products.size,
      dealEventCount: this.dealEvents.length,
      activeDealCount: this.dealEvents.filter(d => d.isActive).length,
      priceHistoryEntries,
      alertCount: this.alerts.length,
      connectorCount: this.connectors.size,
    };
  }
}

export const store = new Store();
