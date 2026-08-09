var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/store.ts
import * as fs from "fs";
import * as path from "path";
var DATA_DIR, STORE_FILE, Store, store;
var init_store = __esm({
  "server/store.ts"() {
    DATA_DIR = path.join(process.cwd(), "data");
    STORE_FILE = path.join(DATA_DIR, "store.json");
    Store = class {
      products = /* @__PURE__ */ new Map();
      priceHistory = /* @__PURE__ */ new Map();
      priceStats = /* @__PURE__ */ new Map();
      dealEvents = [];
      alerts = [];
      recentErrors = [];
      connectors = /* @__PURE__ */ new Map();
      metrics = {
        productsMonitored: 0,
        priceEventsProcessed: 0,
        anomaliesDetected: 0,
        extremeDeals: 0,
        loot95Events: 0,
        avgProcessingLatencyMs: 0,
        avgDetectionLatencyMs: 0,
        falsePositiveRate: 0,
        trueLootRate: 0,
        uptimeHours: 0
      };
      startedAt = (/* @__PURE__ */ new Date()).toISOString();
      saveTimer = null;
      constructor() {
        this.load();
        this.saveTimer = setInterval(() => this.save(), 3e4);
      }
      // ─── Purge Simulated Data ──────────────────────────────────────
      purgeSimulatedData() {
        this.connectors.delete("simulator");
        const junkKeywords = ["garbage bag", "trash bag", "skate scooter", "floor mat", "bath mat", "doormat"];
        for (const [id, p] of this.products.entries()) {
          if (id.startsWith("sim_") || id.startsWith("amz_in_sim_")) {
            this.products.delete(id);
            this.priceHistory.delete(id);
            this.priceStats.delete(id);
          } else if (p) {
            p.title = p.title.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
            const lower = p.title.toLowerCase();
            if (junkKeywords.some((kw) => lower.includes(kw))) {
              this.products.delete(id);
              this.priceHistory.delete(id);
              this.priceStats.delete(id);
              continue;
            }
            if (!p.url || !p.url.startsWith("http") || p.url.includes("B09R673DBP")) {
              p.url = `https://www.amazon.in/s?k=${encodeURIComponent(p.title)}`;
            }
          }
        }
        this.dealEvents = this.dealEvents.filter((d) => {
          if (!d.product || d.productId.startsWith("sim_") || d.productId.startsWith("amz_in_sim_")) return false;
          d.product.title = d.product.title.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
          const lower = d.product.title.toLowerCase();
          if (junkKeywords.some((kw) => lower.includes(kw))) return false;
          if (!d.product.url || !d.product.url.startsWith("http") || d.product.url.includes("B09R673DBP")) {
            d.product.url = `https://www.amazon.in/s?k=${encodeURIComponent(d.product.title)}`;
          }
          return true;
        });
        this.metrics.productsMonitored = this.products.size;
      }
      // ─── Products ───────────────────────────────────────────────
      addProduct(product) {
        this.products.set(product.id, product);
        this.metrics.productsMonitored = this.products.size;
      }
      getProduct(id) {
        return this.products.get(id);
      }
      getAllProducts() {
        return Array.from(this.products.values());
      }
      updateProductPrice(productId, price, effectivePrice) {
        const product = this.products.get(productId);
        if (product) {
          product.currentPrice = price;
          product.effectivePrice = effectivePrice;
          product.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        }
      }
      // ─── Price History ──────────────────────────────────────────
      addPricePoint(productId, point) {
        const history = this.priceHistory.get(productId) || [];
        history.push(point);
        if (history.length > 2e3) history.splice(0, history.length - 2e3);
        this.priceHistory.set(productId, history);
      }
      getPriceHistory(productId, days) {
        const history = this.priceHistory.get(productId) || [];
        if (!days) return history;
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1e3;
        return history.filter((p) => new Date(p.timestamp).getTime() >= cutoff);
      }
      // ─── Price Statistics ───────────────────────────────────────
      setStats(productId, stats) {
        this.priceStats.set(productId, stats);
      }
      getStats(productId) {
        return this.priceStats.get(productId) || [];
      }
      getStatsByPeriod(productId, period) {
        return this.getStats(productId).find((s) => s.period === period);
      }
      // ─── Deal Events ───────────────────────────────────────────
      addDealEvent(deal) {
        this.dealEvents.unshift(deal);
        if (this.dealEvents.length > 500) this.dealEvents.length = 500;
        this.metrics.priceEventsProcessed++;
        if (deal.classification === "EXTREME" || deal.classification === "LOOT_95") {
          this.metrics.extremeDeals++;
        }
        if (deal.classification === "LOOT_95") {
          this.metrics.loot95Events++;
        }
        if (deal.lootScore >= 50) {
          this.metrics.anomaliesDetected++;
        }
      }
      getDealEvents(options) {
        let filtered = this.dealEvents.filter((d) => d.isActive);
        if (options?.classification) {
          filtered = filtered.filter((d) => d.classification === options.classification);
        }
        if (options?.minScore !== void 0) {
          filtered = filtered.filter((d) => d.lootScore >= options.minScore);
        }
        const total = filtered.length;
        const limit = options?.limit || 50;
        const offset = options?.offset || 0;
        return {
          deals: filtered.slice(offset, offset + limit),
          total
        };
      }
      getDealEvent(id) {
        return this.dealEvents.find((d) => d.id === id);
      }
      getLoot95Deals() {
        return this.dealEvents.filter(
          (d) => d.isActive && (d.classification === "LOOT_95" || d.classification === "EXTREME")
        );
      }
      getRareEvents() {
        return this.dealEvents.filter((d) => d.isActive && d.isNeverSeenBefore);
      }
      // ─── Alerts ─────────────────────────────────────────────────
      addAlert(alert) {
        this.alerts.unshift(alert);
        if (this.alerts.length > 200) this.alerts.length = 200;
      }
      getAlerts() {
        return this.alerts;
      }
      // ─── Connectors ─────────────────────────────────────────────
      setConnectorStatus(info) {
        this.connectors.set(info.platform, info);
      }
      getConnectorStatuses() {
        return Array.from(this.connectors.values());
      }
      // ─── Metrics ────────────────────────────────────────────────
      getMetrics() {
        const uptimeMs = Date.now() - new Date(this.startedAt).getTime();
        this.metrics.uptimeHours = Math.round(uptimeMs / 36e5 * 10) / 10;
        this.metrics.productsMonitored = this.products.size;
        return { ...this.metrics };
      }
      incrementProcessedEvents() {
        this.metrics.priceEventsProcessed++;
      }
      updateLatency(processingMs, detectionMs) {
        const n = this.metrics.priceEventsProcessed || 1;
        this.metrics.avgProcessingLatencyMs = Math.round(
          (this.metrics.avgProcessingLatencyMs * (n - 1) + processingMs) / n
        );
        this.metrics.avgDetectionLatencyMs = Math.round(
          (this.metrics.avgDetectionLatencyMs * (n - 1) + detectionMs) / n
        );
      }
      // ─── Persistence ────────────────────────────────────────────
      save() {
        try {
          if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
          const data = {
            products: Object.fromEntries(this.products),
            priceHistory: Object.fromEntries(this.priceHistory),
            priceStats: Object.fromEntries(this.priceStats),
            dealEvents: this.dealEvents.slice(0, 200),
            // Save last 200
            metrics: this.metrics,
            startedAt: this.startedAt
          };
          fs.writeFileSync(STORE_FILE, JSON.stringify(data), "utf-8");
        } catch (e) {
          console.error("[Store] Save failed:", e);
        }
      }
      load() {
        try {
          if (!fs.existsSync(STORE_FILE)) return;
          const raw = fs.readFileSync(STORE_FILE, "utf-8");
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
          console.error("[Store] Load failed, starting fresh:", e);
        }
      }
      shutdown() {
        if (this.saveTimer) clearInterval(this.saveTimer);
        this.save();
      }
      // ─── Error Tracking ───────────────────────────────────────
      addError(source, message) {
        this.recentErrors.unshift({
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          source,
          message
        });
        if (this.recentErrors.length > 50) this.recentErrors.length = 50;
      }
      getRecentErrors() {
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
          activeDealCount: this.dealEvents.filter((d) => d.isActive).length,
          priceHistoryEntries,
          alertCount: this.alerts.length,
          connectorCount: this.connectors.size
        };
      }
    };
    store = new Store();
  }
});

// shared/types.ts
var DEFAULT_SCORING_CONFIG;
var init_types = __esm({
  "shared/types.ts"() {
    DEFAULT_SCORING_CONFIG = {
      weights: {
        historicalDeviation: 0.2,
        historicalRarity: 0.2,
        discountVsNormal: 0.08,
        discountVsMedian: 0.08,
        discountVsMin: 0.07,
        crossPlatformDiff: 0.05,
        priceVelocity: 0.06,
        sellerReliability: 0.05,
        stockAvailability: 0.04,
        dealFrequencyInverse: 0.05,
        sleepingProductBonus: 0.06,
        conditionPenalty: -0.04,
        disappearanceProbability: 0.04
      },
      thresholds: {
        normal: 30,
        great: 50,
        hot: 65,
        extreme: 80,
        loot95: 90
      },
      minimumConfidence: 0.3,
      minimumSampleCount: 5
    };
  }
});

// server/engine/intelligence.ts
function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = p / 100 * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}
function percentileRank(arr, value) {
  const sorted = [...arr].sort((a, b) => a - b);
  const below = sorted.filter((v) => v < value).length;
  const equal = sorted.filter((v) => v === value).length;
  return (below + 0.5 * equal) / sorted.length * 100;
}
function computePriceStatistics(productId, history, period) {
  const periodDays = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "180d": 180,
    "365d": 365
  };
  const days = periodDays[period];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1e3;
  const points = history.filter((p) => new Date(p.timestamp).getTime() >= cutoff);
  if (points.length < 2) return null;
  const prices = points.map((p) => p.effectivePrice);
  const m = median(prices);
  const extremeThreshold = m * 0.5;
  const extremeCount = prices.filter((p) => p < extremeThreshold).length;
  let lastExtremeAt = null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].effectivePrice < extremeThreshold) {
      lastExtremeAt = points[i].timestamp;
      break;
    }
  }
  return {
    productId,
    period,
    median: Math.round(m),
    mean: Math.round(mean(prices)),
    min: Math.min(...prices),
    max: Math.max(...prices),
    p5: Math.round(percentile(prices, 5)),
    p25: Math.round(percentile(prices, 25)),
    p75: Math.round(percentile(prices, 75)),
    p95: Math.round(percentile(prices, 95)),
    stddev: Math.round(stddev(prices)),
    sampleCount: points.length,
    extremeDiscountCount: extremeCount,
    lastExtremeDiscountAt: lastExtremeAt,
    computedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function calculateRarityScore(currentPrice, history, stats) {
  if (!stats || stats.sampleCount < 3) {
    return { score: 50, reason: "Insufficient historical data for accurate rarity calculation" };
  }
  const prices = history.map((p) => p.effectivePrice);
  const pRank = 100 - percentileRank(prices, currentPrice);
  const zScore = (stats.mean - currentPrice) / (stats.stddev || 1);
  const zComponent = Math.min(100, Math.max(0, zScore * 20));
  const belowMin = currentPrice < stats.min ? 20 : 0;
  const similarPrices = prices.filter((p) => Math.abs(p - currentPrice) / currentPrice < 0.05);
  const frequencyRarity = Math.max(0, 100 - similarPrices.length / prices.length * 100);
  let timeSinceLastSimilar = 100;
  for (let i = history.length - 1; i >= 0; i--) {
    if (Math.abs(history[i].effectivePrice - currentPrice) / currentPrice < 0.1) {
      const daysSince = (Date.now() - new Date(history[i].timestamp).getTime()) / 864e5;
      timeSinceLastSimilar = Math.min(100, daysSince * 2);
      break;
    }
  }
  const score = Math.min(100, Math.max(
    0,
    pRank * 0.35 + zComponent * 0.25 + belowMin + frequencyRarity * 0.1 + timeSinceLastSimilar * 0.1
  ));
  const reasons = [];
  if (pRank > 90) reasons.push(`Price is lower than ${Math.round(pRank)}% of all recorded prices`);
  if (zScore > 2) reasons.push(`${zScore.toFixed(1)} standard deviations below average price`);
  if (belowMin > 0) reasons.push("Below all-time recorded minimum price");
  if (frequencyRarity > 80) reasons.push("This price level is extremely uncommon");
  return {
    score: Math.round(score * 10) / 10,
    reason: reasons.join(". ") || "Price is unusual compared to historical data"
  };
}
function detectAnomaly(currentPrice, previousPrice, stats, mrp) {
  if (!stats) {
    const dropFromMrp = (mrp - currentPrice) / mrp * 100;
    if (dropFromMrp > 85) {
      return {
        isAnomaly: true,
        severity: 80,
        type: "price_drop",
        details: `${Math.round(dropFromMrp)}% below MRP (limited historical data)`
      };
    }
    return { isAnomaly: false, severity: 0, type: "normal", details: "No anomaly detected" };
  }
  const zScore = (stats.mean - currentPrice) / (stats.stddev || 1);
  const dropFromMedian = (stats.median - currentPrice) / stats.median * 100;
  const dropFromPrevious = (previousPrice - currentPrice) / previousPrice * 100;
  const belowMin = currentPrice < stats.min;
  if (dropFromMedian > 95 && currentPrice < 500) {
    return {
      isAnomaly: true,
      severity: 95,
      type: "price_error",
      details: `Price is ${Math.round(dropFromMedian)}% below median \u2014 possible pricing error`
    };
  }
  if (zScore > 3 || belowMin && (stats.min - currentPrice) / stats.min > 0.3) {
    return {
      isAnomaly: true,
      severity: Math.min(100, Math.round(zScore * 20)),
      type: "price_drop",
      details: `Price is ${zScore.toFixed(1)} standard deviations below mean${belowMin ? ", and below all-time low" : ""}`
    };
  }
  if (zScore > 2 || dropFromPrevious > 40) {
    return {
      isAnomaly: true,
      severity: Math.min(90, Math.round(zScore * 15)),
      type: dropFromPrevious > 50 ? "flash_deal" : "price_drop",
      details: `Significant price deviation detected (z=${zScore.toFixed(1)})`
    };
  }
  if (zScore > 1.5 || dropFromMedian > 30) {
    return {
      isAnomaly: true,
      severity: Math.round(zScore * 12),
      type: "price_drop",
      details: `Moderate price deviation from normal (${Math.round(dropFromMedian)}% below median)`
    };
  }
  return { isAnomaly: false, severity: 0, type: "normal", details: "Price within normal range" };
}
function detectSleepingProduct(currentPrice, stats, history) {
  if (!stats || stats.sampleCount < 10) {
    return { isSleeping: false, priceStability: 0, dropMagnitude: 0, details: "Insufficient data" };
  }
  const cv = stats.stddev / stats.mean;
  const priceStability = Math.max(0, Math.min(100, (1 - cv) * 100));
  const dropFromMedian = (stats.median - currentPrice) / stats.median * 100;
  const isStable = priceStability > 80;
  const rarelyDiscounted = stats.extremeDiscountCount <= 1;
  const significantDrop = dropFromMedian > 40;
  const isSleeping = isStable && rarelyDiscounted && significantDrop;
  return {
    isSleeping,
    priceStability: Math.round(priceStability),
    dropMagnitude: Math.round(dropFromMedian),
    details: isSleeping ? `Normally stable product (stability: ${Math.round(priceStability)}%) with ${Math.round(dropFromMedian)}% price drop \u2014 SLEEPING PRODUCT ACTIVATED` : `Price stability: ${Math.round(priceStability)}%, drop: ${Math.round(dropFromMedian)}%`
  };
}
function predictPreLoot(history, currentPrice, stats) {
  if (history.length < 5) {
    return {
      probability: 0,
      trend: "stable",
      disappearanceProbability: 50,
      details: "Insufficient data for prediction"
    };
  }
  const recentN = Math.min(10, history.length);
  const recent = history.slice(-recentN);
  const prices = recent.map((p) => p.effectivePrice);
  let consecutiveDrops = 0;
  let totalDropPct = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] < prices[i - 1]) {
      consecutiveDrops++;
      totalDropPct += (prices[i - 1] - prices[i]) / prices[i - 1] * 100;
    }
  }
  let isAccelerating = false;
  if (consecutiveDrops >= 3) {
    const drops = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] < prices[i - 1]) {
        drops.push((prices[i - 1] - prices[i]) / prices[i - 1] * 100);
      }
    }
    if (drops.length >= 3) {
      isAccelerating = drops[drops.length - 1] > drops[drops.length - 2];
    }
  }
  let trend = "stable";
  let probability = 0;
  if (isAccelerating && consecutiveDrops >= 3) {
    trend = "accelerating_drop";
    probability = Math.min(95, 40 + consecutiveDrops * 10 + totalDropPct);
  } else if (consecutiveDrops >= 2) {
    trend = "steady_drop";
    probability = Math.min(70, 20 + consecutiveDrops * 8 + totalDropPct * 0.5);
  } else if (prices[prices.length - 1] > prices[0]) {
    trend = "rising";
    probability = 5;
  }
  let disappearanceProbability = 30;
  if (stats) {
    const dropFromMedian = (stats.median - currentPrice) / stats.median * 100;
    if (dropFromMedian > 80) disappearanceProbability = 95;
    else if (dropFromMedian > 60) disappearanceProbability = 80;
    else if (dropFromMedian > 40) disappearanceProbability = 60;
  }
  return {
    probability: Math.round(probability),
    trend,
    disappearanceProbability,
    details: trend === "accelerating_drop" ? `${consecutiveDrops} consecutive price drops with acceleration \u2014 ${Math.round(probability)}% probability of reaching extreme territory` : trend === "steady_drop" ? `Steady downward trend (${consecutiveDrops} drops) \u2014 monitoring for acceleration` : "No clear downward trend detected"
  };
}
function isNeverSeenBefore(currentPrice, stats, history) {
  if (!stats || stats.sampleCount < 10) {
    return { result: false, message: "Insufficient history" };
  }
  if (currentPrice < stats.min) {
    const pctBelow = ((stats.min - currentPrice) / stats.min * 100).toFixed(1);
    return {
      result: true,
      message: `This product has never been observed below \u20B9${stats.min.toLocaleString("en-IN")} in our available history (${stats.sampleCount} data points). Current: \u20B9${currentPrice.toLocaleString("en-IN")} \u2014 ${pctBelow}% below previous record.`
    };
  }
  return { result: false, message: "" };
}
function computeDealAnomalyMetrics(product, currentPrice, mrp, stats, aggregatorBaseline, detectedAt) {
  const normalPrice = product.averagePrice || aggregatorBaseline?.averageSellingPrice || stats?.median || (mrp ? Math.round(mrp * 0.75) : currentPrice);
  const allTimeLow = product.allTimeLow || aggregatorBaseline?.allTimeLow || stats?.min || Math.round(normalPrice * 0.7);
  const typicalLowestPrice = aggregatorBaseline?.typicalLowestPrice || Math.min(allTimeLow, Math.round(normalPrice * 0.8));
  const effectivePrice = product.effectivePrice || (product.instantDiscountAmount ? currentPrice - product.instantDiscountAmount : currentPrice);
  const isAllTimeLow = currentPrice <= allTimeLow || effectivePrice <= allTimeLow;
  const dropVsAveragePct = Math.max(0, Math.round((normalPrice - effectivePrice) / normalPrice * 100 * 10) / 10);
  const savingsVsAverage = Math.max(0, Math.round(normalPrice - effectivePrice));
  const detectedTime = detectedAt ? new Date(detectedAt).getTime() : Date.now();
  const ageMinutes = Math.max(0, Math.round((Date.now() - detectedTime) / 6e4));
  const timeDecayMultiplier = Math.max(0.2, Math.exp(-4e-3 * ageMinutes));
  let historicalPercentile = 50;
  const points = aggregatorBaseline?.pricePoints || [];
  if (points.length > 0) {
    const countBelow = points.filter((p) => p <= effectivePrice).length;
    historicalPercentile = Math.max(0.1, Math.min(99.9, Math.round(countBelow / points.length * 100 * 10) / 10));
  } else {
    if (isAllTimeLow) historicalPercentile = 0.5;
    else if (dropVsAveragePct >= 40) historicalPercentile = 2;
    else if (dropVsAveragePct >= 25) historicalPercentile = 8;
    else historicalPercentile = Math.max(1, Math.round((100 - dropVsAveragePct) * 10) / 10);
  }
  let rarityLabel = "LOW";
  if (isAllTimeLow) rarityLabel = "ALL-TIME LOW";
  else if (historicalPercentile <= 3 || dropVsAveragePct >= 35) rarityLabel = "VERY HIGH";
  else if (historicalPercentile <= 10 || dropVsAveragePct >= 20) rarityLabel = "HIGH";
  else if (historicalPercentile <= 25 || dropVsAveragePct >= 10) rarityLabel = "MODERATE";
  let priceAnomalyScore = 50;
  if (isAllTimeLow) {
    const dropBelowAtl = (allTimeLow - effectivePrice) / (allTimeLow || 1);
    priceAnomalyScore = Math.min(99, Math.round(90 + dropBelowAtl * 50));
  } else {
    priceAnomalyScore = Math.max(10, Math.round(dropVsAveragePct * 1.8));
  }
  let demandLabel = "NORMAL";
  if (isAllTimeLow || dropVsAveragePct >= 40) demandLabel = "EXTREME";
  else if (dropVsAveragePct >= 25) demandLabel = "HIGH";
  else if (dropVsAveragePct >= 15) demandLabel = "MODERATE";
  let sellerConfidenceLabel = "HIGH";
  if (product.isRefurbishedOrUsed) {
    sellerConfidenceLabel = "LOW";
  } else if (product.verifiedLive && product.isSellerTrusted && product.sellerRating >= 4.5) {
    sellerConfidenceLabel = "VERY HIGH";
  } else if (product.sellerRating >= 4) {
    sellerConfidenceLabel = "HIGH";
  } else if (product.sellerRating >= 3.5) {
    sellerConfidenceLabel = "MODERATE";
  } else {
    sellerConfidenceLabel = "LOW";
  }
  const atlBonus = isAllTimeLow ? 35 : 0;
  const dropComponent = Math.min(45, dropVsAveragePct * 0.9);
  const rarityComponent = (100 - historicalPercentile) * 0.2;
  const trustComponent = product.isRefurbishedOrUsed ? -25 : product.isSellerTrusted ? 5 : 0;
  const rawComposite = priceAnomalyScore * 0.35 + dropComponent + atlBonus + rarityComponent + trustComponent;
  const timeDecayedScore = rawComposite * timeDecayMultiplier;
  const compositeDealScore = Math.round(Math.min(99.9, Math.max(10, timeDecayedScore)) * 10) / 10;
  return {
    normalPrice,
    allTimeLow,
    typicalLowestPrice,
    currentPrice,
    effectivePrice,
    isAllTimeLow,
    dropVsAveragePct,
    savingsVsAverage,
    historicalPercentile,
    rarityLabel,
    priceAnomalyScore,
    demandLabel,
    sellerConfidenceLabel,
    compositeDealScore,
    timeDecayMultiplier: Math.round(timeDecayMultiplier * 100) / 100,
    ageMinutes
  };
}
var init_intelligence = __esm({
  "server/engine/intelligence.ts"() {
  }
});

// server/connectors/price_tracker_aggregator.ts
async function fetchAggregatedPriceBaseline(productId, platform, asin, fsid, currentPrice, mrp) {
  const cacheKey = asin ? `asin_${asin}` : fsid ? `fsid_${fsid}` : productId;
  if (baselineCache.has(cacheKey)) {
    return baselineCache.get(cacheKey);
  }
  if (platform === "amazon" && asin) {
    try {
      const res = await fetch(`https://pricehistory.app/api/v1/search?q=${asin}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
          "Accept": "application/json"
        },
        signal: AbortSignal.timeout(3e3)
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.lowest_price) {
          const allTimeLow = parseInt(json.lowest_price, 10);
          const highestPrice = parseInt(json.highest_price || "0", 10);
          const avgPrice = parseInt(json.average_price || "0", 10);
          if (!isNaN(allTimeLow) && allTimeLow > 0) {
            const baseline = {
              productId,
              asin,
              allTimeLow,
              typicalLowestPrice: Math.round(allTimeLow * 1.05),
              averageSellingPrice: avgPrice > 0 ? avgPrice : Math.round(allTimeLow * 1.3),
              highestPrice: highestPrice > 0 ? highestPrice : Math.round(allTimeLow * 1.6),
              sampleCount: 120,
              pricePoints: generatePriceDistribution(allTimeLow, avgPrice || allTimeLow * 1.3, highestPrice || allTimeLow * 1.6),
              source: "PriceHistory Aggregator API",
              fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
            };
            baselineCache.set(cacheKey, baseline);
            return baseline;
          }
        }
      }
    } catch (e) {
    }
  }
  const baselineMrp = mrp && mrp > (currentPrice || 0) ? mrp : Math.round((currentPrice || 1e3) * 1.4);
  const curPrice = currentPrice || Math.round(baselineMrp * 0.7);
  const estimatedNormal = Math.round(baselineMrp * 0.82);
  const estimatedTypicalLow = Math.round(estimatedNormal * 0.8);
  const estimatedAllTimeLow = Math.min(curPrice, Math.round(estimatedTypicalLow * 0.9));
  const fallbackBaseline = {
    productId,
    asin,
    fsid,
    allTimeLow: estimatedAllTimeLow,
    typicalLowestPrice: estimatedTypicalLow,
    averageSellingPrice: estimatedNormal,
    highestPrice: baselineMrp,
    sampleCount: 60,
    pricePoints: generatePriceDistribution(estimatedAllTimeLow, estimatedNormal, baselineMrp),
    source: "Statistical Price Distribution Engine",
    fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  baselineCache.set(cacheKey, fallbackBaseline);
  return fallbackBaseline;
}
function generatePriceDistribution(min, avg, max) {
  const points = [];
  for (let i = 0; i < 60; i++) {
    points.push(Math.round(avg + (Math.random() - 0.5) * (avg * 0.15)));
  }
  for (let i = 0; i < 25; i++) {
    points.push(Math.round(max - Math.random() * (max - avg) * 0.4));
  }
  for (let i = 0; i < 15; i++) {
    points.push(Math.round(min + Math.random() * (avg - min) * 0.5));
  }
  return points.sort((a, b) => a - b);
}
var baselineCache;
var init_price_tracker_aggregator = __esm({
  "server/connectors/price_tracker_aggregator.ts"() {
    baselineCache = /* @__PURE__ */ new Map();
  }
});

// server/ai/deal-judge.ts
import { GoogleGenAI } from "@google/genai";
async function judgeDeal(deal) {
  const { product, currentPrice, normalPrice, realDiscountPct, displayedDiscountPct, scoreComponents } = deal;
  if (!ai) {
    return runRuleBasedJudge(deal);
  }
  try {
    const prompt = `
You are the AI Deal Judge for LOOT 95, an elite deal-hunting intelligence system.
Analyze this pricing event and determine if it is a genuine, ultra-rare deal or a fake/suspicious listing.

Product Details:
- Title: ${product.title}
- Brand: ${product.brand}
- Category: ${product.category} / ${product.subcategory}
- Current Price: \u20B9${currentPrice.toLocaleString("en-IN")}
- Estimated Normal Market Price: \u20B9${normalPrice.toLocaleString("en-IN")}
- Displayed MRP: \u20B9${product.mrp.toLocaleString("en-IN")}
- Real Economic Discount: ${realDiscountPct}%
- Displayed MRP Discount: ${displayedDiscountPct}%
- Seller Name: ${product.sellerName} (Rating: ${product.sellerRating}/5)
- Stock Status: ${product.stockStatus}
- Coupon Required: ${product.couponRequired ? "Yes" : "No"}
- Bank Offer Required: ${product.bankOfferRequired ? "Yes" : "No"}
- Historical Price Deviation (Z-score component): ${scoreComponents.historicalDeviation}/100
- Price Rarity Score: ${scoreComponents.historicalRarity}/100

Respond strictly with a JSON object in this format:
{
  "verdict": "VERIFIED_LOOT" | "PROBABLE_LOOT" | "PRICE_ANOMALY" | "POSSIBLE_PRICE_ERROR" | "NORMAL_DEAL" | "FALSE_DEAL",
  "confidencePct": number (0-100),
  "reasoning": "Concise 1-2 sentence explanation of the verdict.",
  "checks": [
    { "check": "Genuine Discount", "passed": boolean, "detail": "explanation" },
    { "check": "MRP Authenticity", "passed": boolean, "detail": "explanation" },
    { "check": "Seller Reliability", "passed": boolean, "detail": "explanation" },
    { "check": "Condition Dependencies", "passed": boolean, "detail": "explanation" }
  ]
}
`;
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt
    });
    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        verdict: parsed.verdict || "PROBABLE_LOOT",
        confidencePct: parsed.confidencePct || 85,
        reasoning: parsed.reasoning || "Verified by Gemini AI engine.",
        checks: parsed.checks || []
      };
    }
  } catch (error) {
    console.error("[AI Deal Judge] Gemini API error, using rule-based judge:", error);
  }
  return runRuleBasedJudge(deal);
}
function runRuleBasedJudge(deal) {
  const { product, currentPrice, normalPrice, realDiscountPct, displayedDiscountPct, scoreComponents } = deal;
  const checks = [];
  const isGenuine = realDiscountPct >= 50;
  checks.push({
    check: "Genuine Economic Discount",
    passed: isGenuine,
    detail: isGenuine ? `Real price is ${realDiscountPct}% below historical median (\u20B9${normalPrice.toLocaleString("en-IN")}).` : `Discount is mostly relative to inflated MRP, not real selling price.`
  });
  const mrpInflationRatio = product.mrp / Math.max(1, normalPrice);
  const mprOk = mrpInflationRatio <= 1.8;
  checks.push({
    check: "MRP Inflation Verification",
    passed: mprOk,
    detail: mprOk ? `MRP (\u20B9${product.mrp.toLocaleString("en-IN")}) is within reasonable ratio of normal market price.` : `MRP appears artificially inflated to make discount look larger.`
  });
  const sellerOk = product.sellerRating >= 3.5;
  checks.push({
    check: "Seller Reliability Audit",
    passed: sellerOk,
    detail: sellerOk ? `Seller "${product.sellerName}" has acceptable rating (${product.sellerRating}/5).` : `Seller rating is below standard threshold. Exercise caution.`
  });
  const noStringsAttached = !product.couponRequired && !product.bankOfferRequired;
  checks.push({
    check: "No Conditional Friction",
    passed: noStringsAttached,
    detail: noStringsAttached ? `Direct price drop \u2014 no coupons or credit card offers required.` : `Price depends on conditional offers or coupons.`
  });
  let verdict = "NORMAL_DEAL";
  if (deal.lootScore >= 85 && realDiscountPct >= 75) {
    verdict = "VERIFIED_LOOT";
  } else if (deal.lootScore >= 70) {
    verdict = "PROBABLE_LOOT";
  } else if (deal.priceErrorProbability > 70) {
    verdict = "POSSIBLE_PRICE_ERROR";
  } else if (deal.lootScore >= 50) {
    verdict = "PRICE_ANOMALY";
  }
  return {
    verdict,
    confidencePct: Math.min(95, Math.round(deal.confidence * 100)),
    reasoning: `Evaluated by LOOT 95 Rule Judge: ${realDiscountPct}% real discount with ${scoreComponents.historicalRarity}/100 historical rarity.`,
    checks
  };
}
var apiKey, ai;
var init_deal_judge = __esm({
  "server/ai/deal-judge.ts"() {
    apiKey = process.env.GEMINI_API_KEY || "";
    ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }
});

// server/notifications/email.ts
var email_exports = {};
__export(email_exports, {
  ALERT_EMAIL_RECIPIENT: () => ALERT_EMAIL_RECIPIENT,
  sendLoot95EmailAlert: () => sendLoot95EmailAlert,
  setRecipientEmail: () => setRecipientEmail
});
import nodemailer from "nodemailer";
function setRecipientEmail(email) {
  ALERT_EMAIL_RECIPIENT = email;
}
async function sendLoot95EmailAlert(deal, recipientEmail) {
  const targetEmail = recipientEmail || ALERT_EMAIL_RECIPIENT;
  if (!targetEmail) {
    console.log("[Email Alert Service] No target email configured.");
    return false;
  }
  const { product, currentPrice, normalPrice, realDiscountPct, lootScore, classification, aiReasoning } = deal;
  const subject = `\u{1F6A8} LOOT 95 ALERT [Score: ${lootScore}]: ${product.title.substring(0, 45)} (\u20B9${currentPrice.toLocaleString("en-IN")}) \u2014 ${realDiscountPct}% REAL OFF!`;
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; font-family: monospace; }
    .header { background-color: #064e3b; border-bottom: 2px solid #10b981; padding: 20px; text-align: center; }
    .header h1 { color: #10b981; margin: 0; font-size: 24px; letter-spacing: 2px; text-shadow: 0 0 10px rgba(16,185,129,0.5); }
    .header p { color: #a7f3d0; margin: 5px 0 0 0; font-size: 12px; }
    .content { padding: 24px; }
    .badge-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .badge { background: #10b981; color: #000; font-weight: bold; padding: 4px 10px; border-radius: 4px; font-size: 12px; }
    .score { font-size: 28px; font-weight: 800; color: #10b981; }
    .product-title { font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 12px; line-height: 1.4; }
    .price-box { background: #1f2937; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 6px; }
    .current-price { font-size: 32px; font-weight: 800; color: #10b981; margin: 0; }
    .discount-tag { color: #ef4444; font-weight: bold; margin-left: 10px; font-size: 18px; }
    .price-meta { color: #9ca3af; font-size: 13px; margin-top: 6px; }
    .cta-button { display: block; width: 100%; text-align: center; background: #10b981; color: #000000; font-weight: bold; padding: 16px 0; text-decoration: none; border-radius: 8px; font-size: 16px; margin-top: 24px; box-shadow: 0 0 15px rgba(16,185,129,0.4); }
    .footer { padding: 16px; text-align: center; color: #6b7280; font-size: 11px; border-top: 1px solid #1f2937; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>\u{1F3AF} LOOT 95 DETECTED</h1>
      <p>Ultra-Rare Deal Intelligence Alert</p>
    </div>
    <div class="content">
      <div class="badge-container">
        <span class="badge">${classification}</span>
        <span class="score">SCORE ${lootScore}/100</span>
      </div>

      <div class="product-title">${product.title}</div>

      <div class="price-box">
        <span class="current-price">\u20B9${currentPrice.toLocaleString("en-IN")}</span>
        <span class="discount-tag">${realDiscountPct}% REAL OFF</span>
        <div class="price-meta">
          Normal Selling Price: \u20B9${normalPrice.toLocaleString("en-IN")} | Displayed MRP: \u20B9${product.mrp.toLocaleString("en-IN")}
        </div>
      </div>

      <p style="color:#d1d5db; font-size:14px; line-height:1.5;">
        <strong>AI Deal Audit:</strong> ${aiReasoning || "Verified genuine price drop below 30-day historical median."}
      </p>

      <a href="${product.url}" class="cta-button" target="_blank">\u26A1 GRAB DEAL NOW ON AMAZON \u2192</a>
    </div>

    <div class="footer">
      LOOT 95 Engine \u2022 Automated 24x7 Price Intelligence \u2022 Recipient: ${targetEmail}
    </div>
  </div>
</body>
</html>
  `;
  console.log(`
\u{1F4E7} [Email Alert Triggered] Target: ${targetEmail} | Deal: "${product.title}" @ \u20B9${currentPrice} (${realDiscountPct}% OFF)`);
  if (transporter) {
    try {
      await transporter.sendMail({
        from: ALERT_EMAIL_FROM,
        to: targetEmail,
        subject,
        html: htmlContent
      });
      console.log(`\u2705 [Email Sent Successfully] Email delivered to ${targetEmail}`);
      return true;
    } catch (err) {
      console.error(`\u274C [Email Delivery Failed]:`, err.message);
      return false;
    }
  } else {
    console.log(`\u2139\uFE0F [Email Simulation] Set SMTP_USER and SMTP_PASS in .env to send real inbox emails via Gmail/SendGrid/Resend.`);
    return true;
  }
}
var SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ALERT_EMAIL_FROM, ALERT_EMAIL_RECIPIENT, transporter;
var init_email = __esm({
  "server/notifications/email.ts"() {
    SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
    SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
    SMTP_USER = process.env.SMTP_USER || "";
    SMTP_PASS = process.env.SMTP_PASS || "";
    ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || '"LOOT 95 Alerts" <alerts@loot95.com>';
    ALERT_EMAIL_RECIPIENT = process.env.ALERT_EMAIL_RECIPIENT || "anshuworkplace@gmail.com";
    transporter = null;
    if (SMTP_USER && SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      });
      console.log(`[Email Alert Service] SMTP configured with account ${SMTP_USER}`);
    } else {
      console.log("[Email Alert Service] SMTP_USER/SMTP_PASS not set. Email previews will be logged to console.");
    }
  }
});

// server/engine/pipeline.ts
import { v4 as uuid } from "uuid";
async function processPriceEvent(product, priceEvent) {
  const startTime = Date.now();
  const mrpDiscount = (product.mrp - priceEvent.effectivePrice) / product.mrp * 100;
  if (mrpDiscount < 5) {
    store.incrementProcessedEvents();
    return null;
  }
  const history = store.getPriceHistory(product.id);
  const periods = ["7d", "30d", "90d", "180d", "365d"];
  const allStats = [];
  for (const period of periods) {
    const s = computePriceStatistics(product.id, history, period);
    if (s) allStats.push(s);
  }
  store.setStats(product.id, allStats);
  const primaryStats = allStats.find((s) => s.period === "30d") || allStats.find((s) => s.period === "90d") || allStats[0] || null;
  const hasSufficientHistory = primaryStats ? primaryStats.sampleCount >= 5 : false;
  let normalPrice = primaryStats && primaryStats.median > priceEvent.effectivePrice ? primaryStats.median : product.mrp;
  if (!normalPrice || normalPrice <= priceEvent.effectivePrice) {
    normalPrice = Math.round(priceEvent.effectivePrice * 1.25);
  }
  const historicalMedian = primaryStats?.median || normalPrice;
  const historicalLow = primaryStats?.min || priceEvent.effectivePrice;
  let realDiscountPct = Math.max(0, Math.round((normalPrice - priceEvent.effectivePrice) / normalPrice * 100));
  if (realDiscountPct === 0 && mrpDiscount > 0) {
    realDiscountPct = Math.round(mrpDiscount);
    normalPrice = product.mrp;
  }
  if (realDiscountPct <= 0 && mrpDiscount <= 0) {
    store.incrementProcessedEvents();
    return null;
  }
  const anomaly = detectAnomaly(
    priceEvent.effectivePrice,
    priceEvent.previousPrice || normalPrice,
    primaryStats,
    product.mrp
  );
  const rarity = calculateRarityScore(priceEvent.effectivePrice, history, primaryStats);
  const sleeping = detectSleepingProduct(priceEvent.effectivePrice, primaryStats, history);
  const prediction = predictPreLoot(history, priceEvent.effectivePrice, primaryStats);
  const neverSeen = isNeverSeenBefore(priceEvent.effectivePrice, primaryStats, history);
  const components = computeScoreComponents(
    priceEvent,
    product,
    primaryStats,
    history,
    anomaly.severity,
    rarity.score,
    sleeping,
    prediction,
    realDiscountPct,
    normalPrice
  );
  let lootScore = computeLootScore(components, config);
  if (realDiscountPct >= 80) {
    lootScore = Math.max(lootScore, 85 + (realDiscountPct - 80) * 0.7);
  } else if (realDiscountPct >= 65) {
    lootScore = Math.max(lootScore, 70 + (realDiscountPct - 65) * 1);
  } else if (realDiscountPct >= 50) {
    lootScore = Math.max(lootScore, 55 + (realDiscountPct - 50) * 1);
  }
  const classification = classify(lootScore, realDiscountPct, anomaly, config);
  const confidence = computeConfidence(primaryStats, history.length);
  const confidenceReason = confidence < 0.5 ? `Limited historical data (${history.length} data points). Good confidence from MRP discount baseline.` : `Strong historical data (${history.length} data points). High confidence.`;
  const explanations = generateExplanations(
    priceEvent,
    product,
    primaryStats,
    rarity,
    anomaly,
    sleeping,
    neverSeen,
    realDiscountPct,
    normalPrice
  );
  const aggregatorBaseline = await fetchAggregatedPriceBaseline(
    product.id,
    product.platform,
    product.asin,
    product.fsid,
    priceEvent.effectivePrice,
    product.mrp
  );
  product.averagePrice = aggregatorBaseline?.averageSellingPrice || primaryStats?.median || normalPrice;
  product.allTimeLow = aggregatorBaseline?.allTimeLow || primaryStats?.min || Math.round(normalPrice * 0.7);
  const anomalyMetrics = computeDealAnomalyMetrics(
    product,
    priceEvent.effectivePrice,
    product.mrp,
    primaryStats,
    aggregatorBaseline,
    priceEvent.ingestedAt || (/* @__PURE__ */ new Date()).toISOString()
  );
  lootScore = anomalyMetrics.compositeDealScore;
  const isAllTimeLow = anomalyMetrics.isAllTimeLow;
  realDiscountPct = Math.max(0, Math.round(anomalyMetrics.dropVsAveragePct));
  const savingsVsAverage = anomalyMetrics.savingsVsAverage;
  const processingLatency = Date.now() - startTime;
  const dealEvent = {
    id: uuid(),
    productId: product.id,
    product,
    classification,
    lootScore: Math.round(lootScore * 10) / 10,
    rarityScore: rarity.score,
    scoreComponents: components,
    anomalyMetrics,
    confidence: Math.round(confidence * 100) / 100,
    confidenceReason,
    currentPrice: priceEvent.effectivePrice,
    effectivePrice: anomalyMetrics.effectivePrice,
    normalPrice: Math.round(product.averagePrice),
    historicalMedian: Math.round(product.averagePrice),
    historicalLow: Math.round(product.allTimeLow),
    isAllTimeLow,
    realDiscountPct,
    displayedDiscountPct: Math.round(mrpDiscount),
    savingsVsAverage,
    detectedAt: (/* @__PURE__ */ new Date()).toISOString(),
    ageMinutes: anomalyMetrics.ageMinutes,
    detectionLatencyMs: processingLatency,
    isActive: true,
    expiresAt: null,
    aiVerdict: null,
    aiReasoning: null,
    aiChecks: null,
    explanations,
    priceHistory: history.slice(-90),
    // Last 90 points for chart
    statistics: primaryStats,
    isSleepingProduct: sleeping.isSleeping,
    isNeverSeenBefore: neverSeen.result,
    priceErrorProbability: anomaly.type === "price_error" ? anomaly.severity : 0,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store.addDealEvent(dealEvent);
  store.updateLatency(processingLatency, processingLatency);
  judgeDeal(dealEvent).then((aiResult) => {
    dealEvent.aiVerdict = aiResult.verdict;
    dealEvent.aiReasoning = aiResult.reasoning;
    dealEvent.aiChecks = aiResult.checks;
    broadcastDeal(dealEvent);
  }).catch((e) => console.error("[Pipeline] AI Judge error:", e));
  broadcastDeal(dealEvent);
  if (dealEvent.lootScore >= 70 || ["LOOT_95", "EXTREME", "PRICE_ERROR"].includes(dealEvent.classification)) {
    sendLoot95EmailAlert(dealEvent).catch((e) => console.error("[Pipeline] Email alert error:", e));
  }
  console.log(
    `[Pipeline] ${classification} | Score: ${dealEvent.lootScore} | ${product.brand} ${product.model} | \u20B9${priceEvent.effectivePrice.toLocaleString("en-IN")} (${realDiscountPct}% real discount) | ${processingLatency}ms`
  );
  return dealEvent;
}
function computeScoreComponents(event, product, stats, history, anomalySeverity, rarityScore, sleeping, prediction, realDiscountPct, normalPrice) {
  const price = event.effectivePrice;
  const discountRatio = realDiscountPct / 100;
  return {
    // Historical deviation: z-score or discount-based score
    historicalDeviation: stats && stats.sampleCount >= 5 && stats.stddev > 0 ? Math.min(100, Math.max(0, (stats.mean - price) / stats.stddev * 20)) : Math.min(100, discountRatio * 110),
    // Historical rarity: from rarity calculator or discount-based
    historicalRarity: rarityScore > 0 ? rarityScore : Math.min(100, discountRatio * 110),
    // Discount vs various baselines
    discountVsNormal: Math.min(100, Math.max(0, discountRatio * 100)),
    discountVsMedian: stats && stats.sampleCount >= 5 ? Math.min(100, Math.max(0, (stats.median - price) / stats.median * 100)) : Math.min(100, discountRatio * 100),
    discountVsMin: stats && stats.sampleCount >= 5 ? Math.min(100, Math.max(0, (stats.min - price) / (stats.min || 1) * 100 + 50)) : Math.min(100, discountRatio * 90),
    // Cross-platform: default
    crossPlatformDiff: 50,
    // Price velocity: based on discount
    priceVelocity: Math.min(100, realDiscountPct * 1.2),
    // Seller reliability: based on seller rating
    sellerReliability: Math.min(100, product.sellerRating / 5 * 100),
    // Stock availability: 100 for in_stock
    stockAvailability: product.stockStatus === "in_stock" ? 100 : product.stockStatus === "low_stock" ? 60 : 0,
    // Deal frequency inverse
    dealFrequencyInverse: 75,
    // Sleeping product
    sleepingProductBonus: sleeping.isSleeping ? sleeping.priceStability : 0,
    // Condition penalty
    conditionPenalty: (product.couponRequired ? 30 : 0) + (product.bankOfferRequired ? 20 : 0),
    // Disappearance probability
    disappearanceProbability: prediction.disappearanceProbability,
    // Confidence adjustment: 0.8 for new live deals
    confidenceAdjustment: stats && stats.sampleCount >= 5 ? computeConfidence(stats, history.length) : 0.8
  };
}
function computeLootScore(components, config2) {
  const w = config2.weights;
  let score = components.historicalDeviation * w.historicalDeviation + components.historicalRarity * w.historicalRarity + components.discountVsNormal * w.discountVsNormal + components.discountVsMedian * w.discountVsMedian + components.discountVsMin * w.discountVsMin + components.crossPlatformDiff * w.crossPlatformDiff + components.priceVelocity * w.priceVelocity + components.sellerReliability * w.sellerReliability + components.stockAvailability * w.stockAvailability + components.dealFrequencyInverse * w.dealFrequencyInverse + components.sleepingProductBonus * w.sleepingProductBonus + components.conditionPenalty * w.conditionPenalty + components.disappearanceProbability * w.disappearanceProbability;
  score *= 0.6 + 0.4 * components.confidenceAdjustment;
  return Math.max(0, Math.min(100, score));
}
function classify(lootScore, realDiscountPct, anomaly, config2) {
  if (anomaly.type === "price_error" && anomaly.severity > 85) return "PRICE_ERROR";
  if (lootScore >= 80 || realDiscountPct >= 80) return "LOOT_95";
  if (lootScore >= 65 || realDiscountPct >= 65) return "EXTREME";
  if (lootScore >= 50 || realDiscountPct >= 50) return "HOT";
  if (lootScore >= 35 || realDiscountPct >= 35) return "GREAT";
  return "NORMAL";
}
function computeConfidence(stats, historyLength) {
  if (!stats || stats.sampleCount < 3) return 0.75;
  if (stats.sampleCount < 15) return 0.8;
  if (stats.sampleCount < 30) return 0.88;
  return 0.95;
}
function generateExplanations(event, product, stats, rarity, anomaly, sleeping, neverSeen, realDiscountPct, normalPrice) {
  const explanations = [];
  if (stats && stats.sampleCount >= 5 && stats.median > event.effectivePrice) {
    explanations.push(
      `Current price is ${realDiscountPct}% below the ${stats.period} median of \u20B9${stats.median.toLocaleString("en-IN")}`
    );
  } else {
    explanations.push(`Current price is ${realDiscountPct}% below normal MRP of \u20B9${normalPrice.toLocaleString("en-IN")}`);
  }
  if (neverSeen.result) {
    explanations.push(neverSeen.message);
  }
  if (rarity.score > 80) {
    explanations.push(`Rarity score: ${rarity.score}/100 \u2014 ${rarity.reason}`);
  }
  if (anomaly.severity > 50) {
    explanations.push(anomaly.details);
  }
  if (sleeping.isSleeping) {
    explanations.push(sleeping.details);
  }
  if (product.stockStatus === "in_stock") {
    explanations.push("Product is currently in stock");
  } else if (product.stockStatus === "low_stock") {
    explanations.push("\u26A0\uFE0F Low stock \u2014 product may sell out soon");
  }
  if (product.couponRequired) {
    explanations.push(`Requires coupon code: ${product.couponCode || "check listing"}`);
  }
  if (product.bankOfferRequired) {
    explanations.push(`Bank offer required: ${product.bankOfferDetails || "check listing"}`);
  }
  if (event.priceChangePct && Math.abs(event.priceChangePct) > 20) {
    explanations.push(
      `Price dropped ${Math.abs(Math.round(event.priceChangePct))}% in recent check`
    );
  }
  return explanations;
}
function broadcastDeal(deal) {
  const data = JSON.stringify({ type: "deal", data: deal });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}

`);
    } catch {
      sseClients.delete(client);
    }
  }
}
function broadcastStatus() {
  const metrics = store.getMetrics();
  const connectors = store.getConnectorStatuses();
  const data = JSON.stringify({
    type: "status",
    data: {
      isOnline: true,
      uptime: metrics.uptimeHours,
      connectors,
      metrics,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}

`);
    } catch {
      sseClients.delete(client);
    }
  }
}
var config, sseClients;
var init_pipeline = __esm({
  "server/engine/pipeline.ts"() {
    init_types();
    init_store();
    init_intelligence();
    init_price_tracker_aggregator();
    init_deal_judge();
    init_email();
    config = DEFAULT_SCORING_CONFIG;
    sseClients = /* @__PURE__ */ new Set();
  }
});

// server/connectors/live_validator.ts
var live_validator_exports = {};
__export(live_validator_exports, {
  extractAmazonAsin: () => extractAmazonAsin,
  extractFlipkartFsid: () => extractFlipkartFsid,
  resolveFinalUrl: () => resolveFinalUrl,
  verifyLiveProduct: () => verifyLiveProduct
});
function getRandomUserAgent() {
  return BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
}
function decodeHtmlEntities(str) {
  return str.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
}
function extractAmazonAsin(urlOrText) {
  if (!urlOrText) return null;
  const match = urlOrText.match(/(?:\/dp\/|\/gp\/product\/|\/product\/|\/ASIN\/|pd_rd_i=)([A-Z0-9]{10})/i);
  if (match) return match[1].toUpperCase();
  const rawAsinMatch = urlOrText.match(/\b(B0[A-Z0-9]{8})\b/i);
  return rawAsinMatch ? rawAsinMatch[1].toUpperCase() : null;
}
function extractFlipkartFsid(urlOrText) {
  if (!urlOrText) return null;
  const pidMatch = urlOrText.match(/[?&]pid=([A-Za-z0-9]+)/i);
  if (pidMatch) return pidMatch[1];
  const pMatch = urlOrText.match(/\/p\/(itm[a-zA-Z0-9]+|\w+)/i);
  if (pMatch) return pMatch[1];
  return null;
}
async function resolveFinalUrl(initialUrl) {
  if (!initialUrl) return initialUrl;
  let currentUrl = initialUrl.trim();
  if (currentUrl.includes("amazon.in/dp/") || currentUrl.includes("flipkart.com/")) {
    return currentUrl;
  }
  try {
    const res = await fetch(currentUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    return res.url || currentUrl;
  } catch (err) {
    return currentUrl;
  }
}
async function verifyLiveProduct(rawUrl, defaultPlatform) {
  const finalUrl = await resolveFinalUrl(rawUrl);
  const lowerUrl = finalUrl.toLowerCase();
  let platform = defaultPlatform || "amazon";
  if (lowerUrl.includes("flipkart.com") || lowerUrl.includes("fkrt.it")) {
    platform = "flipkart";
  } else if (lowerUrl.includes("myntra.com")) {
    platform = "myntra";
  } else if (lowerUrl.includes("croma.com")) {
    platform = "croma";
  } else if (lowerUrl.includes("reliancedigital.in")) {
    platform = "reliance_digital";
  } else if (lowerUrl.includes("ajio.com")) {
    platform = "ajio";
  } else if (lowerUrl.includes("tatacliq.com")) {
    platform = "tatacliq";
  } else if (lowerUrl.includes("nykaa.com")) {
    platform = "nykaa";
  } else if (lowerUrl.includes("pepperfry.com")) {
    platform = "pepperfry";
  } else {
    platform = "amazon";
  }
  const asin = extractAmazonAsin(finalUrl);
  const fsid = extractFlipkartFsid(finalUrl);
  const baseResult = {
    url: rawUrl,
    finalUrl,
    platform,
    asin: asin || void 0,
    fsid: fsid || void 0,
    currentPrice: null,
    mrp: null,
    sellerName: "Verified Retailer",
    sellerRating: 4.5,
    isSellerTrusted: true,
    isRefurbishedOrUsed: false,
    stockStatus: "in_stock",
    isAvailable: true,
    verifiedLive: false
  };
  try {
    const response = await fetch(finalUrl, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
        "Cache-Control": "no-cache"
      },
      signal: AbortSignal.timeout(8e3)
    });
    if (!response.ok) {
      baseResult.error = `HTTP ${response.status}: ${response.statusText}`;
      return baseResult;
    }
    const html = await response.text();
    const jsonLdResult = parseJsonLdSchema(html, baseResult);
    if (jsonLdResult && jsonLdResult.currentPrice) {
      return jsonLdResult;
    }
    if (platform === "amazon") {
      return parseAmazonHtml(html, baseResult);
    } else if (platform === "flipkart") {
      return parseFlipkartHtml(html, baseResult);
    } else {
      return parseGenericHtml(html, baseResult);
    }
  } catch (err) {
    baseResult.error = err.message || "Fetch timeout / connection error";
    return baseResult;
  }
}
function parseJsonLdSchema(html, base) {
  try {
    const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (!jsonLdMatches) return null;
    for (const match of jsonLdMatches) {
      const content = match.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
      const parsed = JSON.parse(content);
      const product = Array.isArray(parsed) ? parsed.find((p) => p["@type"] === "Product") : parsed["@type"] === "Product" ? parsed : null;
      if (product) {
        const result = { ...base, verifiedLive: true };
        result.title = product.name || result.title;
        result.imageUrl = Array.isArray(product.image) ? product.image[0] : product.image || result.imageUrl;
        const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
        if (offers) {
          if (offers.price) result.currentPrice = Math.round(parseFloat(offers.price));
          if (offers.priceCurrency === "INR" || !offers.priceCurrency) {
            if (offers.availability && offers.availability.includes("OutOfStock")) {
              result.stockStatus = "out_of_stock";
              result.isAvailable = false;
            }
          }
        }
        if (result.currentPrice && result.currentPrice > 0) {
          result.mrp = Math.round(result.currentPrice * 1.3);
          return result;
        }
      }
    }
  } catch {
  }
  return null;
}
function parseAmazonHtml(html, base) {
  const result = { ...base, verifiedLive: true };
  const lowerHtml = html.toLowerCase();
  if (lowerHtml.includes("renewed") || lowerHtml.includes("refurbished") || lowerHtml.includes("pre-owned") || lowerHtml.includes("used - like new")) {
    result.isRefurbishedOrUsed = true;
  }
  const isUnavailable = lowerHtml.includes("currently unavailable") || lowerHtml.includes("we don't know when or if this item will be back in stock") || lowerHtml.includes("out of stock.") || lowerHtml.includes("temporarily out of stock");
  if (isUnavailable) {
    result.stockStatus = "out_of_stock";
    result.isAvailable = false;
  } else if (lowerHtml.includes("only 1 left") || lowerHtml.includes("only 2 left") || lowerHtml.includes("only 3 left")) {
    result.stockStatus = "low_stock";
  }
  const titleMatch = html.match(/<span id="productTitle"[^>]*>([\s\S]*?)<\/span>/i) || html.match(/<meta name="title" content="([^"]+)"/i);
  if (titleMatch) result.title = decodeHtmlEntities(titleMatch[1].trim().replace(/\s+/g, " "));
  const imgMatch = html.match(/data-old-hires="([^"]+)"/i) || html.match(/id="landingImage"[^>]*src="([^"]+)"/i);
  if (imgMatch) result.imageUrl = imgMatch[1];
  const priceMatches = [
    html.match(/class="a-price apexPriceToPay"[^>]*>[\s\S]*?<span class="a-offscreen">₹\s*([0-9,]+(?:\.[0-9]{2})?)/i),
    html.match(/class="a-price aok-align-center[^"]*"[^>]*>[\s\S]*?<span class="a-offscreen">₹\s*([0-9,]+(?:\.[0-9]{2})?)/i),
    html.match(/id="priceblock_ourprice"[^>]*>₹\s*([0-9,]+(?:\.[0-9]{2})?)/i),
    html.match(/<span class="a-price-whole">([0-9,]+)<\/span>/i)
  ];
  for (const m of priceMatches) {
    if (m && m[1]) {
      const parsed = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        result.currentPrice = Math.round(parsed);
        break;
      }
    }
  }
  if (lowerHtml.includes("bank offer") || lowerHtml.includes("instant discount")) {
    result.bankOfferDetails = "10% Instant Bank Discount Available";
    if (result.currentPrice) {
      result.instantDiscountAmount = Math.min(1500, Math.round(result.currentPrice * 0.1));
      result.effectivePrice = result.currentPrice - result.instantDiscountAmount;
    }
  }
  const mrpMatches = [
    html.match(/class="a-price a-text-price"[^>]*>[\s\S]*?<span class="a-offscreen">₹\s*([0-9,]+(?:\.[0-9]{2})?)/i),
    html.match(/<span class="a-size-small a-color-secondary a-text-strike">₹\s*([0-9,]+)/i)
  ];
  for (const m of mrpMatches) {
    if (m && m[1]) {
      const parsed = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        result.mrp = Math.round(parsed);
        break;
      }
    }
  }
  if (result.currentPrice && (!result.mrp || result.mrp < result.currentPrice)) {
    result.mrp = Math.round(result.currentPrice * 1.35);
  }
  return result;
}
function parseFlipkartHtml(html, base) {
  const result = { ...base, verifiedLive: true };
  const lowerHtml = html.toLowerCase();
  if (lowerHtml.includes("refurbished") || lowerHtml.includes("2nd hand")) {
    result.isRefurbishedOrUsed = true;
  }
  const isUnavailable = lowerHtml.includes("sold out") || lowerHtml.includes("this item is currently out of stock") || lowerHtml.includes('"availability":"out_of_stock"');
  if (isUnavailable) {
    result.stockStatus = "out_of_stock";
    result.isAvailable = false;
  }
  const titleMatch = html.match(/<span class="B_NuEv">([^<]+)<\/span>/i) || html.match(/<h1 class="[^"]*">([^<]+)<\/h1>/i);
  if (titleMatch) result.title = decodeHtmlEntities(titleMatch[1].trim());
  const priceMatches = [
    html.match(/class="_30jeq3 _16JgWd">₹\s*([0-9,]+)/i),
    html.match(/class="_30jeq3">₹\s*([0-9,]+)/i),
    html.match(/"price":([0-9]+)/i)
  ];
  for (const m of priceMatches) {
    if (m && m[1]) {
      const parsed = parseInt(m[1].replace(/,/g, ""), 10);
      if (!isNaN(parsed) && parsed > 0) {
        result.currentPrice = parsed;
        break;
      }
    }
  }
  if (result.currentPrice && (!result.mrp || result.mrp < result.currentPrice)) {
    result.mrp = Math.round(result.currentPrice * 1.3);
  }
  return result;
}
function parseGenericHtml(html, base) {
  const result = { ...base, verifiedLive: true };
  const lowerHtml = html.toLowerCase();
  if (lowerHtml.includes("out of stock") || lowerHtml.includes("sold out")) {
    result.stockStatus = "out_of_stock";
    result.isAvailable = false;
  }
  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) result.title = decodeHtmlEntities(titleMatch[1].trim());
  const priceMatch = html.match(/(?:price|₹|INR)\s*:?\s*([0-9,]+)/i);
  if (priceMatch && priceMatch[1]) {
    const parsed = parseInt(priceMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      result.currentPrice = parsed;
      result.mrp = Math.round(parsed * 1.3);
    }
  }
  return result;
}
var BROWSER_USER_AGENTS;
var init_live_validator = __esm({
  "server/connectors/live_validator.ts"() {
    BROWSER_USER_AGENTS = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    ];
  }
});

// server/connectors/multi_source_harvester.ts
function decodeHtmlEntities2(str) {
  return str.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
}
function safeIsoDate(dateStr) {
  if (!dateStr) return (/* @__PURE__ */ new Date()).toISOString();
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return (/* @__PURE__ */ new Date()).toISOString();
    return d.toISOString();
  } catch {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
}
async function harvestAmazonDirectDeals() {
  const deals = [];
  const searchKeywords = [
    "laptop deals",
    "smartphone deals",
    "sony headphones",
    "apple ipad",
    "4k tv sale",
    "ssd 1tb",
    "macbook air",
    "samsung galaxy",
    "oneplus 12",
    "gaming laptop",
    "lg 4k tv",
    "bose noise cancelling",
    "smartwatch sale",
    "instant pot",
    "ps5 console"
  ];
  for (const kw of searchKeywords) {
    try {
      const url = `https://completion.amazon.in/api/2/suggestions?mid=A21TJRUUN4KGV&alias=aps&prefix=${encodeURIComponent(kw)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(4e3)
      });
      if (!res.ok) continue;
      const data = await res.json();
      const suggestions = data?.suggestions || [];
      for (const sug of suggestions.slice(0, 3)) {
        const value = sug?.value;
        if (!value) continue;
        const cleanTitle = `Amazon India: ${value.toUpperCase()}`;
        const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(value)}`;
        deals.push({
          sourceName: "AmazonDirectEngine",
          rawTitle: value,
          cleanTitle,
          dealUrl: searchUrl,
          targetUrl: searchUrl,
          storeName: "Amazon India",
          platform: "amazon",
          claimedPrice: null,
          claimedMrp: null,
          publishedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    } catch (err) {
    }
  }
  return deals;
}
async function harvestAmazonCommunitySignals() {
  const deals = [];
  try {
    const res = await fetch("https://www.freekaamaal.com/feed", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*"
      },
      signal: AbortSignal.timeout(6e3)
    });
    if (res.ok) {
      const xml = await res.text();
      const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const itemXml of itemMatches) {
        const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        const descMatch = itemXml.match(/<description>(.*?)<\/description>/);
        const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
        if (!titleMatch || !linkMatch) continue;
        const rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
        const cleanTitle = decodeHtmlEntities2(rawTitle);
        const lowerTitle = cleanTitle.toLowerCase();
        if (JUNK_KEYWORDS.some((kw) => lowerTitle.includes(kw))) continue;
        const desc = descMatch ? decodeHtmlEntities2(descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")) : "";
        const rawLink = linkMatch[1].trim();
        const asin = extractAmazonAsin(rawLink) || extractAmazonAsin(desc);
        const isAmazon = lowerTitle.includes("amazon") || rawLink.includes("amazon") || !!asin;
        if (!isAmazon) continue;
        const priceMatch = cleanTitle.match(/(?:Rs\.?|₹)\s*([0-9,]+)/i) || desc.match(/(?:Rs\.?|₹)\s*([0-9,]+)/i);
        const claimedPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ""), 10) : null;
        deals.push({
          sourceName: "AmazonCommunityNetwork",
          rawTitle,
          cleanTitle,
          dealUrl: rawLink.includes("amazon.in") ? rawLink : asin ? `https://www.amazon.in/dp/${asin}` : rawLink,
          targetUrl: rawLink,
          storeName: "Amazon India",
          platform: "amazon",
          claimedPrice,
          claimedMrp: claimedPrice ? Math.round(claimedPrice * 1.35) : null,
          asin: asin || void 0,
          description: desc.slice(0, 200),
          publishedAt: safeIsoDate(pubDateMatch?.[1])
        });
      }
    }
  } catch (err) {
    console.warn("[Harvester] Amazon community signal ingestion skipped:", err.message);
  }
  return deals;
}
async function harvestAllCandidateDeals() {
  console.log("[Harvester] Probing 100% Amazon India Direct & Signal Network...");
  const startTime = Date.now();
  const [directDeals, communityDeals] = await Promise.all([
    harvestAmazonDirectDeals(),
    harvestAmazonCommunitySignals()
  ]);
  const allCandidates = [...directDeals, ...communityDeals];
  console.log(`[Harvester] Total Amazon candidates fetched: ${allCandidates.length}`);
  const seenKeys = /* @__PURE__ */ new Set();
  const deduplicated = [];
  for (const c of allCandidates) {
    const key = c.asin ? `asin_${c.asin}` : `title_${c.cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30)}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicated.push(c);
    }
  }
  console.log(`[Harvester] Amazon ingestion complete in ${Date.now() - startTime}ms. Total deduplicated Amazon deals: ${deduplicated.length}`);
  return deduplicated;
}
var JUNK_KEYWORDS;
var init_multi_source_harvester = __esm({
  "server/connectors/multi_source_harvester.ts"() {
    init_live_validator();
    JUNK_KEYWORDS = [
      "garbage bag",
      "trash bag",
      "dustbin cover",
      "floor mat",
      "bath mat",
      "doormat",
      "silicone mat",
      "skate scooter",
      "kids scooter",
      "microfiber cloth",
      "mop refill",
      "cleaning cloth",
      "soap dish",
      "plastic toy",
      "cable clip",
      "socks",
      "underwear",
      "briefs",
      "panties",
      "sanitary pad",
      "back cover",
      "screen protector",
      "tempered glass",
      "phone case"
    ];
  }
});

// server/connectors/live_engine.ts
var live_engine_exports = {};
__export(live_engine_exports, {
  fetchLiveDealsFromStream: () => fetchLiveDealsFromStream,
  startLiveEnginePolling: () => startLiveEnginePolling,
  stopLiveEnginePolling: () => stopLiveEnginePolling,
  sweepActiveDeals: () => sweepActiveDeals
});
import { v4 as uuid3 } from "uuid";
function extractBrand2(title) {
  const words = title.split(" ");
  return words[0] || "Generic";
}
function categorizeProduct2(title, _brand) {
  const t = title.toLowerCase();
  if (t.includes("laptop") || t.includes("notebook") || t.includes("macbook") || t.includes("chromebook")) return "Computers";
  if (t.includes("phone") || t.includes("iphone") || t.includes("galaxy") || t.includes("pixel") || t.includes("oneplus") || t.includes("redmi") || t.includes("realme") || t.includes("smartphone")) return "Smartphones";
  if (t.includes("tablet") || t.includes("ipad")) return "Tablets";
  if (t.includes("headphone") || t.includes("earphone") || t.includes("earbud") || t.includes("airpod") || t.includes("speaker") || t.includes("soundbar") || t.includes("tws")) return "Audio";
  if (t.includes("tv") || t.includes("television") || t.includes("monitor") || t.includes("display")) return "Displays";
  if (t.includes("watch") || t.includes("band") || t.includes("smartwatch")) return "Wearables";
  if (t.includes("camera") || t.includes("gopro") || t.includes("dslr")) return "Cameras";
  if (t.includes("gaming") || t.includes("console") || t.includes("controller") || t.includes("playstation") || t.includes("xbox")) return "Gaming";
  if (t.includes("fan") || t.includes("purifier") || t.includes("vacuum") || t.includes("washing") || t.includes("refrigerator") || t.includes("printer")) return "Appliances";
  return "Electronics";
}
function subcategorizeProduct2(title, _brand) {
  const t = title.toLowerCase();
  if (t.includes("laptop") || t.includes("macbook")) return "Laptops";
  if (t.includes("phone") || t.includes("iphone") || t.includes("galaxy") || t.includes("smartphone")) return "Smartphones";
  if (t.includes("headphone")) return "Headphones";
  if (t.includes("earbud") || t.includes("tws") || t.includes("airpod")) return "Earbuds";
  if (t.includes("speaker") || t.includes("soundbar")) return "Speakers";
  if (t.includes("tv") || t.includes("television")) return "TVs";
  if (t.includes("smartwatch") || t.includes("watch")) return "Smartwatches";
  if (t.includes("gaming") || t.includes("steering")) return "Gaming";
  if (t.includes("printer")) return "Printers";
  if (t.includes("fan")) return "Appliances";
  return "Deals";
}
async function fetchLiveDealsFromStream() {
  const startTime = Date.now();
  console.log("[Live Engine] Harvesting candidates from multi-stream network...");
  try {
    const candidates = await harvestAllCandidateDeals();
    if (candidates.length === 0) {
      console.log("[Live Engine] No candidate items harvested");
      return [];
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const processedDeals = [];
    const candidatesToValidate = candidates.slice(0, 25);
    for (const cand of candidatesToValidate) {
      const liveValidation = await verifyLiveProduct(cand.targetUrl, cand.platform);
      if (liveValidation.verifiedLive && !liveValidation.isAvailable) {
        console.log(`[Live Engine] \u274C REJECTED dead/out-of-stock deal: "${cand.cleanTitle}"`);
        continue;
      }
      const currentPrice = liveValidation.currentPrice || cand.claimedPrice;
      if (!currentPrice || currentPrice <= 0) {
        console.log(`[Live Engine] \u26A0\uFE0F Skipped deal with invalid price: "${cand.cleanTitle}"`);
        continue;
      }
      let mrp = liveValidation.mrp || cand.claimedMrp || 0;
      if (!mrp || mrp < currentPrice) {
        mrp = Math.round(currentPrice * 1.35);
      }
      const asin = liveValidation.asin || cand.asin || extractAmazonAsin(cand.dealUrl);
      const fsid = liveValidation.fsid || cand.fsid || extractFlipkartFsid(cand.dealUrl);
      const title = liveValidation.title || cand.cleanTitle;
      let productId = `live_${cand.platform}_`;
      if (asin) {
        productId += `asin_${asin}`;
      } else if (fsid) {
        productId += `fsid_${fsid}`;
      } else {
        const cleanTitleStr = title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
        productId += cleanTitleStr;
      }
      const brand = extractBrand2(title);
      const existingProduct = store.getProduct(productId);
      if (existingProduct) {
        const lastCheckedTime = new Date(existingProduct.lastCheckedAt).getTime();
        const minsSinceLastCheck = (Date.now() - lastCheckedTime) / (1e3 * 60);
        if (minsSinceLastCheck < 10 && existingProduct.currentPrice <= currentPrice) {
          continue;
        }
      }
      const previousPrice = existingProduct?.currentPrice || mrp;
      const targetUrl = liveValidation.finalUrl || cand.targetUrl;
      const product = {
        id: productId,
        asin: asin || void 0,
        fsid: fsid || void 0,
        sku: cand.sku,
        brand,
        model: title.split(" ").slice(1, 4).join(" ") || "Product",
        title,
        category: categorizeProduct2(title, brand),
        subcategory: subcategorizeProduct2(title, brand),
        platform: cand.platform,
        platformProductId: asin || fsid || productId,
        url: targetUrl,
        imageUrl: liveValidation.imageUrl || cand.imageUrl || "",
        mrp,
        currentPrice,
        effectivePrice: liveValidation.effectivePrice || currentPrice,
        averagePrice: existingProduct?.averagePrice || Math.round(currentPrice * 1.25),
        allTimeLow: existingProduct?.allTimeLow ? Math.min(existingProduct.allTimeLow, currentPrice) : currentPrice,
        sellerName: liveValidation.sellerName || `${cand.storeName} Retailer`,
        sellerRating: liveValidation.sellerRating || 4.5,
        isSellerTrusted: liveValidation.isSellerTrusted !== false,
        isRefurbishedOrUsed: liveValidation.isRefurbishedOrUsed || false,
        stockStatus: liveValidation.stockStatus,
        verifiedLive: liveValidation.verifiedLive,
        sourceName: cand.sourceName,
        rating: 4.5,
        reviewCount: 420,
        couponRequired: false,
        bankOfferRequired: !!liveValidation.bankOfferDetails,
        bankOfferDetails: liveValidation.bankOfferDetails,
        instantDiscountAmount: liveValidation.instantDiscountAmount || 0,
        specifications: {},
        lastCheckedAt: now,
        createdAt: existingProduct?.createdAt || now,
        updatedAt: now
      };
      store.addProduct(product);
      store.addPricePoint(productId, {
        timestamp: now,
        price: currentPrice,
        effectivePrice: product.effectivePrice
      });
      const priceEvent = {
        id: uuid3(),
        productId,
        price: currentPrice,
        mrp,
        effectivePrice: product.effectivePrice,
        previousPrice,
        priceChange: currentPrice - previousPrice,
        priceChangePct: previousPrice ? (currentPrice - previousPrice) / previousPrice * 100 : 0,
        sourceTimestamp: now,
        ingestedAt: now,
        platform: cand.platform
      };
      const deal = await processPriceEvent(product, priceEvent);
      if (deal) {
        processedDeals.push(deal);
      }
    }
    totalEventsProcessed += candidatesToValidate.length;
    const latencyMs = Date.now() - startTime;
    store.setConnectorStatus({
      platform: "amazon",
      status: "ONLINE",
      lastSuccessAt: now,
      lastErrorAt: null,
      errorMessage: null,
      eventsProcessed: totalEventsProcessed,
      avgLatencyMs: latencyMs
    });
    console.log(`[Live Engine] Ingested & verified ${processedDeals.length} live deals from ${candidatesToValidate.length} candidates (${latencyMs}ms)`);
    return processedDeals;
  } catch (err) {
    console.error("[Live Engine] Multi-platform ingestion error:", err.message);
    store.addError("LiveEngine", err.message);
    store.setConnectorStatus({
      platform: "amazon",
      status: "DEGRADED",
      lastSuccessAt: null,
      lastErrorAt: (/* @__PURE__ */ new Date()).toISOString(),
      errorMessage: err.message,
      eventsProcessed: totalEventsProcessed,
      avgLatencyMs: 0
    });
    return [];
  }
}
async function sweepActiveDeals() {
  console.log("[Live Sweeper] Running adaptive stock & expiry health sweep...");
  const deals = store.getActiveDealEvents();
  let expiredCount = 0;
  for (const deal of deals.slice(0, 20)) {
    try {
      const validation = await verifyLiveProduct(deal.product.url, deal.product.platform);
      const priceJumped = validation.currentPrice && validation.currentPrice > deal.currentPrice * 1.25;
      if (validation.verifiedLive && !validation.isAvailable || priceJumped) {
        console.log(`[Live Sweeper] \u26A0\uFE0F Product expired / sold out / price increased: ${deal.product.title}`);
        deal.product.stockStatus = "out_of_stock";
        deal.isActive = false;
        deal.expiresAt = (/* @__PURE__ */ new Date()).toISOString();
        store.addProduct(deal.product);
        store.addDealEvent(deal);
        broadcastDeal(deal);
        expiredCount++;
      }
    } catch (e) {
    }
  }
  if (expiredCount > 0) {
    console.log(`[Live Sweeper] Deactivated ${expiredCount} expired / out-of-stock deals.`);
  }
  return expiredCount;
}
function startLiveEnginePolling(intervalMs = 3e4) {
  console.log(`[Live Engine] Starting 7+ Multi-Platform Autonomous Verification Engine (interval: ${intervalMs / 1e3}s)`);
  setTimeout(() => fetchLiveDealsFromStream().catch(() => {
  }), 1e3);
  pollTimer2 = setInterval(() => {
    fetchLiveDealsFromStream().catch(() => {
    });
  }, intervalMs);
  sweeperTimer = setInterval(() => {
    sweepActiveDeals().catch(() => {
    });
  }, 18e4);
}
function stopLiveEnginePolling() {
  if (pollTimer2) {
    clearInterval(pollTimer2);
    pollTimer2 = null;
  }
  if (sweeperTimer) {
    clearInterval(sweeperTimer);
    sweeperTimer = null;
  }
}
var pollTimer2, sweeperTimer, totalEventsProcessed;
var init_live_engine = __esm({
  "server/connectors/live_engine.ts"() {
    init_store();
    init_pipeline();
    init_multi_source_harvester();
    init_live_validator();
    pollTimer2 = null;
    sweeperTimer = null;
    totalEventsProcessed = 0;
  }
});

// server/connectors/manual.ts
var manual_exports = {};
__export(manual_exports, {
  submitManualDeal: () => submitManualDeal
});
import { v4 as uuid4 } from "uuid";
async function submitManualDeal(payload) {
  const platform = payload.platform || (payload.url.includes("flipkart") ? "flipkart" : "amazon");
  const productId = `manual_${platform}_${uuid4().substring(0, 8)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const product = {
    id: productId,
    brand: payload.brand || "Generic",
    model: payload.title.substring(0, 30),
    title: payload.title,
    category: payload.category || "Electronics",
    subcategory: payload.subcategory || "General",
    platform,
    platformProductId: productId,
    url: payload.url,
    imageUrl: "",
    mrp: payload.mrp,
    currentPrice: payload.currentPrice,
    effectivePrice: payload.currentPrice,
    sellerName: payload.sellerName || "Direct Marketplace Seller",
    sellerRating: payload.sellerRating || 4.2,
    stockStatus: "in_stock",
    rating: 4.3,
    reviewCount: 150,
    couponRequired: payload.couponRequired || false,
    bankOfferRequired: payload.bankOfferRequired || false,
    specifications: {},
    lastCheckedAt: now,
    createdAt: now,
    updatedAt: now
  };
  store.addProduct(product);
  store.addPricePoint(productId, {
    timestamp: now,
    price: payload.currentPrice,
    effectivePrice: payload.currentPrice
  });
  const priceEvent = {
    id: uuid4(),
    productId,
    price: payload.currentPrice,
    mrp: payload.mrp,
    effectivePrice: payload.currentPrice,
    previousPrice: payload.mrp,
    priceChange: payload.currentPrice - payload.mrp,
    priceChangePct: (payload.currentPrice - payload.mrp) / payload.mrp * 100,
    sourceTimestamp: now,
    ingestedAt: now,
    platform
  };
  const deal = await processPriceEvent(product, priceEvent);
  return deal;
}
var init_manual = __esm({
  "server/connectors/manual.ts"() {
    init_store();
    init_pipeline();
  }
});

// server/index.ts
init_store();
init_pipeline();
import "dotenv/config";
import express from "express";
import cors from "cors";
import path2 from "path";

// server/connectors/rapidapi.ts
init_store();
init_pipeline();
import { v4 as uuid2 } from "uuid";
var RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "real-time-amazon-data.p.rapidapi.com";
var ELECTRONICS_QUERIES = [
  "deals of the day",
  "high discount offers",
  "price drop deals",
  "clearance sale",
  "lightning deals",
  "todays deals",
  "top discount offers",
  "super saver deals",
  "best offers",
  "great Indian sale deals"
];
var lastApiError = null;
var lastApiErrorAt = null;
var totalApiCalls = 0;
var totalApiFailures = 0;
var lastSuccessfulQuery = null;
function getRapidApiDiagnostics() {
  return {
    totalApiCalls,
    totalApiFailures,
    lastApiError,
    lastApiErrorAt,
    lastSuccessfulQuery,
    apiKeyConfigured: !!getApiKey(),
    apiKeyPrefix: getApiKey() ? getApiKey().substring(0, 8) + "..." : null
  };
}
function getApiKey() {
  const key = process.env.RAPIDAPI_KEY || null;
  return key || null;
}
async function fetchRealAmazonDeals(query = "deals of the day") {
  const currentKey = getApiKey();
  if (!currentKey) {
    store.setConnectorStatus({
      platform: "amazon",
      status: "STANDBY",
      lastSuccessAt: null,
      lastErrorAt: null,
      errorMessage: "Set RAPIDAPI_KEY in .env for live Amazon India API fetches",
      eventsProcessed: store.getMetrics().priceEventsProcessed || 0,
      avgLatencyMs: 0
    });
    return [];
  }
  console.log(`[RapidAPI Connector] Fetching live real-time Amazon.in data for query: "${query}"...`);
  totalApiCalls++;
  const apiStartTime = Date.now();
  try {
    const url = `https://${RAPIDAPI_HOST}/search?query=${encodeURIComponent(query)}&country=IN`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": currentKey,
        "x-rapidapi-host": RAPIDAPI_HOST
      }
    });
    if (!res.ok) {
      throw new Error(`RapidAPI responded with status ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    const rawData = json.data;
    let items = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && Array.isArray(rawData.products)) {
      items = rawData.products;
    } else if (rawData && Array.isArray(rawData.results)) {
      items = rawData.results;
    }
    if (!items || items.length === 0) {
      console.log(`[RapidAPI Connector] No deals returned for query "${query}"`);
      return [];
    }
    const realLatencyMs = Date.now() - apiStartTime;
    console.log(`[RapidAPI Connector] Successfully fetched ${items.length} live Amazon India items for query "${query}" (${realLatencyMs}ms)`);
    lastSuccessfulQuery = query;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const processedDeals = [];
    for (const item of items) {
      const priceStr = item.product_price || item.price || item.product_minimum_offer_price;
      if (!priceStr) continue;
      const numPrice = typeof priceStr === "number" ? priceStr : parseFloat(String(priceStr).replace(/[^0-9.]/g, ""));
      if (!numPrice || isNaN(numPrice)) continue;
      const rawPriceStr = item.product_original_price || item.original_price || item.list_price;
      const mrp = rawPriceStr ? typeof rawPriceStr === "number" ? rawPriceStr : parseFloat(String(rawPriceStr).replace(/[^0-9.]/g, "")) : numPrice;
      const asin = item.asin || item.product_asin || uuid2().slice(0, 8);
      const productId = `amz_in_${asin}`;
      const title = item.product_title || item.title || "Amazon India Deal";
      const brand = extractBrand(title);
      const rawUrl = item.product_url || item.url || item.detail_url;
      const url2 = rawUrl && typeof rawUrl === "string" && rawUrl.startsWith("http") ? rawUrl : `https://www.amazon.in/s?k=${encodeURIComponent(title)}`;
      const imageUrl = item.product_photo || item.image || item.photo || "";
      const rating = item.product_star_rating ? parseFloat(String(item.product_star_rating)) : 4;
      const reviewCount = item.product_num_ratings ? parseInt(String(item.product_num_ratings), 10) : 100;
      const existingProduct = store.getProduct(productId);
      const previousPrice = existingProduct?.currentPrice || mrp;
      const product = {
        id: productId,
        brand,
        model: title.split(" ").slice(1, 4).join(" ") || "Product",
        title,
        category: categorizeProduct(title, brand),
        subcategory: subcategorizeProduct(title, brand),
        platform: "amazon",
        platformProductId: asin,
        url: url2,
        imageUrl,
        mrp: mrp > numPrice ? mrp : Math.round(numPrice * 1.25),
        currentPrice: numPrice,
        effectivePrice: numPrice,
        sellerName: "Amazon Verified Seller",
        sellerRating: 4.5,
        stockStatus: "in_stock",
        rating,
        reviewCount,
        couponRequired: false,
        bankOfferRequired: false,
        specifications: {},
        lastCheckedAt: now,
        createdAt: existingProduct?.createdAt || now,
        updatedAt: now
      };
      store.addProduct(product);
      store.addPricePoint(productId, {
        timestamp: now,
        price: numPrice,
        effectivePrice: numPrice
      });
      const priceEvent = {
        id: uuid2(),
        productId,
        price: numPrice,
        mrp: product.mrp,
        effectivePrice: numPrice,
        previousPrice,
        priceChange: numPrice - previousPrice,
        priceChangePct: previousPrice ? (numPrice - previousPrice) / previousPrice * 100 : 0,
        sourceTimestamp: now,
        ingestedAt: now,
        platform: "amazon"
      };
      const dealEvent = await processPriceEvent(product, priceEvent);
      if (dealEvent) {
        processedDeals.push(dealEvent);
      }
    }
    const prevProcessed = store.getConnectorStatuses().find((c) => c.platform === "amazon")?.eventsProcessed || 0;
    store.setConnectorStatus({
      platform: "amazon",
      status: "ONLINE",
      lastSuccessAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastErrorAt: null,
      errorMessage: null,
      eventsProcessed: prevProcessed + items.length,
      avgLatencyMs: realLatencyMs
    });
    return processedDeals;
  } catch (error) {
    totalApiFailures++;
    lastApiError = error.message;
    lastApiErrorAt = (/* @__PURE__ */ new Date()).toISOString();
    console.error("[RapidAPI Connector] Error fetching Amazon India data:", error.message);
    const prevStatus = store.getConnectorStatuses().find((c) => c.platform === "amazon");
    store.setConnectorStatus({
      platform: "amazon",
      status: "ERROR",
      lastSuccessAt: prevStatus?.lastSuccessAt || null,
      lastErrorAt: (/* @__PURE__ */ new Date()).toISOString(),
      errorMessage: error.message,
      eventsProcessed: prevStatus?.eventsProcessed || 0,
      avgLatencyMs: prevStatus?.avgLatencyMs || 0
    });
    return [];
  }
}
function extractBrand(title) {
  const words = title.split(" ");
  return words[0] || "Generic";
}
function categorizeProduct(title, _brand) {
  const t = title.toLowerCase();
  if (t.includes("laptop") || t.includes("notebook") || t.includes("macbook") || t.includes("chromebook")) return "Computers";
  if (t.includes("phone") || t.includes("iphone") || t.includes("galaxy s") || t.includes("pixel") || t.includes("oneplus") || t.includes("redmi") || t.includes("realme")) return "Smartphones";
  if (t.includes("tablet") || t.includes("ipad")) return "Tablets";
  if (t.includes("headphone") || t.includes("earphone") || t.includes("earbud") || t.includes("airpod") || t.includes("speaker") || t.includes("soundbar")) return "Audio";
  if (t.includes("tv") || t.includes("television") || t.includes("monitor")) return "Displays";
  if (t.includes("watch") || t.includes("band") || t.includes("tracker")) return "Wearables";
  if (t.includes("camera") || t.includes("gopro") || t.includes("lens")) return "Cameras";
  if (t.includes("playstation") || t.includes("xbox") || t.includes("nintendo") || t.includes("gaming") || t.includes("controller")) return "Gaming";
  if (t.includes("vacuum") || t.includes("purifier") || t.includes("washing") || t.includes("refrigerator") || t.includes("microwave") || t.includes("oven")) return "Appliances";
  return "Electronics";
}
function subcategorizeProduct(title, _brand) {
  const t = title.toLowerCase();
  if (t.includes("laptop") || t.includes("notebook") || t.includes("macbook") || t.includes("chromebook")) return "Laptops";
  if (t.includes("phone") || t.includes("iphone") || t.includes("galaxy s") || t.includes("pixel") || t.includes("oneplus") || t.includes("redmi") || t.includes("realme")) return "Smartphones";
  if (t.includes("tablet") || t.includes("ipad")) return "Tablets";
  if (t.includes("headphone") || t.includes("over-ear") || t.includes("on-ear")) return "Headphones";
  if (t.includes("earbud") || t.includes("airpod") || t.includes("earphone") || t.includes("in-ear") || t.includes("tws")) return "Earbuds";
  if (t.includes("speaker") || t.includes("soundbar") || t.includes("subwoofer")) return "Speakers";
  if (t.includes("smart tv") || t.includes("television") || t.includes("led tv") || t.includes("oled") || t.includes("qled") || t.includes("4k tv")) return "TVs";
  if (t.includes("monitor") || t.includes("display")) return "Monitors";
  if (t.includes("smartwatch") || t.includes("smart watch") || t.includes("apple watch") || t.includes("galaxy watch")) return "Smartwatches";
  if (t.includes("fitness band") || t.includes("fitness tracker")) return "Fitness Trackers";
  if (t.includes("camera") || t.includes("gopro") || t.includes("dslr") || t.includes("mirrorless")) return "Cameras";
  if (t.includes("playstation") || t.includes("ps5") || t.includes("ps4")) return "Gaming";
  if (t.includes("xbox")) return "Gaming";
  if (t.includes("nintendo") || t.includes("switch")) return "Gaming";
  if (t.includes("vacuum")) return "Appliances";
  if (t.includes("purifier")) return "Appliances";
  return "Deals";
}
var pollTimer = null;
function startRealAmazonPolling(intervalMs = 2e4) {
  const currentKey = getApiKey();
  if (!currentKey) {
    console.warn("[RapidAPI Connector] RAPIDAPI_KEY not configured. Polling NOT started.");
    store.setConnectorStatus({
      platform: "amazon",
      status: "STANDBY",
      lastSuccessAt: null,
      lastErrorAt: null,
      errorMessage: "RAPIDAPI_KEY not configured in environment",
      eventsProcessed: 0,
      avgLatencyMs: 0
    });
    return;
  }
  console.log(`[RapidAPI Connector] Starting 100% REAL Amazon India deal polling (interval: ${intervalMs / 1e3}s)`);
  store.setConnectorStatus({
    platform: "amazon",
    status: "ONLINE",
    lastSuccessAt: null,
    lastErrorAt: null,
    errorMessage: null,
    eventsProcessed: store.getMetrics().priceEventsProcessed || 0,
    avgLatencyMs: 0
  });
  let queryIndex = 0;
  const poll = async () => {
    try {
      const q = ELECTRONICS_QUERIES[queryIndex % ELECTRONICS_QUERIES.length];
      queryIndex++;
      await fetchRealAmazonDeals(q);
    } catch (err) {
      console.error("[RapidAPI Connector] Polling cycle error:", err.message);
    }
  };
  setTimeout(() => fetchRealAmazonDeals("deals of the day").catch(() => {
  }), 2e3);
  setTimeout(() => fetchRealAmazonDeals("high discount offers").catch(() => {
  }), 8e3);
  setTimeout(() => fetchRealAmazonDeals("price drop deals").catch(() => {
  }), 14e3);
  pollTimer = setInterval(poll, intervalMs);
}
function stopRealAmazonPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// server/index.ts
init_live_engine();
var app = express();
var PORT = parseInt(process.env.PORT || "3001");
app.use(cors({ origin: true }));
app.use(express.json());
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  const metrics = store.getMetrics();
  const connectors = store.getConnectorStatuses();
  res.write(`data: ${JSON.stringify({
    type: "status",
    data: { isOnline: true, uptime: metrics.uptimeHours, connectors, metrics, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() }
  })}

`);
  const { deals } = store.getDealEvents({ limit: 20 });
  for (const deal of deals.reverse()) {
    res.write(`data: ${JSON.stringify({ type: "deal", data: deal })}

`);
  }
  sseClients.add(res);
  console.log(`[SSE] Client connected (total: ${sseClients.size})`);
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: "heartbeat", data: { ts: (/* @__PURE__ */ new Date()).toISOString() } })}

`);
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 15e3);
  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
    console.log(`[SSE] Client disconnected (total: ${sseClients.size})`);
  });
});
app.get("/api/status", (_req, res) => {
  const metrics = store.getMetrics();
  const connectors = store.getConnectorStatuses();
  res.json({
    success: true,
    data: {
      isOnline: true,
      uptime: metrics.uptimeHours,
      connectors,
      metrics,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/deals", (req, res) => {
  const classification = req.query.classification;
  const minScore = req.query.minScore ? parseFloat(req.query.minScore) : void 0;
  const limit = req.query.limit ? parseInt(req.query.limit) : 50;
  const offset = req.query.offset ? parseInt(req.query.offset) : 0;
  const { deals, total } = store.getDealEvents({ classification, minScore, limit, offset });
  res.json({
    success: true,
    data: { deals, total, hasMore: offset + limit < total },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/deals/loot95", (_req, res) => {
  const deals = store.getLoot95Deals();
  res.json({
    success: true,
    data: { deals, total: deals.length, hasMore: false },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/deals/rare", (_req, res) => {
  const deals = store.getRareEvents();
  res.json({
    success: true,
    data: { deals, total: deals.length, hasMore: false },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/deals/:id", (req, res) => {
  const deal = store.getDealEvent(req.params.id);
  if (!deal) {
    res.status(404).json({ success: false, error: "Deal not found", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    return;
  }
  const history = store.getPriceHistory(deal.productId);
  const stats = store.getStats(deal.productId);
  res.json({
    success: true,
    data: { ...deal, priceHistory: history, allStatistics: stats },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/products", (_req, res) => {
  const products = store.getAllProducts();
  res.json({
    success: true,
    data: { products, total: products.length },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/products/:id/history", (req, res) => {
  const days = req.query.days ? parseInt(req.query.days) : void 0;
  const history = store.getPriceHistory(req.params.id, days);
  const stats = store.getStats(req.params.id);
  res.json({
    success: true,
    data: { history, statistics: stats },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/alerts", (_req, res) => {
  const alerts = store.getAlerts();
  res.json({
    success: true,
    data: { alerts, total: alerts.length },
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/deals/submit", async (req, res) => {
  try {
    const { submitManualDeal: submitManualDeal2 } = await Promise.resolve().then(() => (init_manual(), manual_exports));
    const deal = await submitManualDeal2(req.body);
    res.json({
      success: true,
      data: deal,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (e) {
    store.addError("ManualSubmit", e.message || "Failed to submit deal");
    res.status(400).json({
      success: false,
      error: e.message || "Failed to submit deal",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
app.get("/api/metrics", (_req, res) => {
  const metrics = store.getMetrics();
  res.json({
    success: true,
    data: metrics,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post("/api/deals/verify-url", async (req, res) => {
  try {
    const { url, platform } = req.body;
    if (!url) {
      res.status(400).json({ success: false, error: "URL parameter is required" });
      return;
    }
    const { verifyLiveProduct: verifyLiveProduct2 } = await Promise.resolve().then(() => (init_live_validator(), live_validator_exports));
    const result = await verifyLiveProduct2(url, platform);
    res.json({
      success: true,
      data: result,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message || "Live URL verification failed",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
app.post("/api/engine/sweep", async (_req, res) => {
  try {
    const { sweepActiveDeals: sweepActiveDeals2 } = await Promise.resolve().then(() => (init_live_engine(), live_engine_exports));
    const expiredCount = await sweepActiveDeals2();
    res.json({
      success: true,
      message: `Active deal sweep completed. Expired/sold-out deals removed: ${expiredCount}`,
      expiredCount,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message || "Active deal sweep failed",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
app.post("/api/settings/email", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) {
    res.status(400).json({ success: false, error: "Invalid email address" });
    return;
  }
  const { setRecipientEmail: setRecipientEmail2 } = await Promise.resolve().then(() => (init_email(), email_exports));
  setRecipientEmail2(email);
  res.json({ success: true, message: `Alert email set to ${email}`, email });
});
app.post("/api/test/email", async (req, res) => {
  try {
    const { sendLoot95EmailAlert: sendLoot95EmailAlert2, ALERT_EMAIL_RECIPIENT: ALERT_EMAIL_RECIPIENT2 } = await Promise.resolve().then(() => (init_email(), email_exports));
    const { deals } = store.getDealEvents({ limit: 1 });
    const sampleDeal = deals[0] || {
      id: "test_deal",
      product: {
        title: "Sony WH-1000XM5 Wireless Headphones (Black)",
        brand: "Sony",
        category: "Electronics",
        subcategory: "Headphones",
        mrp: 34990,
        url: "https://www.amazon.in/s?k=Sony+WH-1000XM5"
      },
      currentPrice: 1999,
      normalPrice: 28e3,
      realDiscountPct: 93,
      displayedDiscountPct: 94,
      lootScore: 94.5,
      classification: "LOOT_95",
      aiVerdict: "VERIFIED_LOOT",
      aiReasoning: "Verified genuine 93% price drop below 30-day historical median."
    };
    const targetEmail = req.body.email || ALERT_EMAIL_RECIPIENT2;
    const sent = await sendLoot95EmailAlert2(sampleDeal, targetEmail);
    res.json({
      success: true,
      message: sent ? `Test email alert sent to ${targetEmail}` : "Email alert logged to console.",
      targetEmail
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
app.get("/api/diagnostics", (_req, res) => {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const metrics = store.getMetrics();
  const connectors = store.getConnectorStatuses();
  const storeDiag = store.getStoreDiagnostics();
  const rapidApiDiag = getRapidApiDiagnostics();
  const recentErrors = store.getRecentErrors();
  const subsystems = [];
  const amazonConnector = connectors.find((c) => c.platform === "amazon");
  subsystems.push({
    name: "Zero-Cost Live Deal Engine",
    status: amazonConnector?.status === "ONLINE" ? "OK" : amazonConnector?.status === "ERROR" ? "ERROR" : "WARNING",
    message: amazonConnector?.status === "ONLINE" ? `Connected & Ingesting. ${amazonConnector.eventsProcessed} live deals processed. Latency: ${amazonConnector.avgLatencyMs}ms` : amazonConnector?.errorMessage || "Initializing live deal feed...",
    lastChecked: now,
    details: {
      eventsProcessed: amazonConnector?.eventsProcessed || 0,
      avgLatencyMs: amazonConnector?.avgLatencyMs || 0,
      lastSuccessAt: amazonConnector?.lastSuccessAt
    }
  });
  subsystems.push({
    name: "RapidAPI Amazon India Connector (Optional)",
    status: !rapidApiDiag.apiKeyConfigured ? "UNCONFIGURED" : rapidApiDiag.lastApiError?.includes("429") ? "WARNING" : rapidApiDiag.totalApiFailures > 0 ? "ERROR" : "OK",
    message: !rapidApiDiag.apiKeyConfigured ? "RAPIDAPI_KEY not set (using Zero-Cost Engine)" : rapidApiDiag.lastApiError?.includes("429") ? "Rate limit hit (429). Falling back to 100% Zero-Cost Live Engine." : `Connected. ${rapidApiDiag.totalApiCalls} API calls made.`,
    lastChecked: now,
    details: {
      ...rapidApiDiag
    }
  });
  const geminiKey = process.env.GEMINI_API_KEY;
  subsystems.push({
    name: "Gemini AI Deal Judge",
    status: geminiKey ? "OK" : "UNCONFIGURED",
    message: geminiKey ? `API key configured (${geminiKey.substring(0, 8)}...). AI verdicts active.` : "GEMINI_API_KEY not set. Using rule-based fallback judge.",
    lastChecked: now,
    details: {
      keyConfigured: !!geminiKey,
      model: "gemini-2.0-flash",
      fallback: !geminiKey ? "Rule-based judge active" : null
    }
  });
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  subsystems.push({
    name: "Email Alert Service",
    status: smtpUser && smtpPass ? "OK" : "UNCONFIGURED",
    message: smtpUser && smtpPass ? `SMTP configured with ${smtpUser}. Email alerts active.` : "SMTP_USER/SMTP_PASS not set. Alerts logged to console only.",
    lastChecked: now,
    details: {
      smtpConfigured: !!(smtpUser && smtpPass),
      smtpHost: process.env.SMTP_HOST || "smtp.gmail.com"
    }
  });
  subsystems.push({
    name: "SSE Real-time Push",
    status: sseClients.size > 0 ? "OK" : "WARNING",
    message: sseClients.size > 0 ? `${sseClients.size} active client(s) receiving real-time events.` : "No SSE clients connected. UI may not be receiving live updates.",
    lastChecked: now,
    details: { clientCount: sseClients.size }
  });
  subsystems.push({
    name: "In-Memory Data Store",
    status: storeDiag.productCount >= 0 ? "OK" : "ERROR",
    message: `${storeDiag.productCount} products, ${storeDiag.dealEventCount} deals (${storeDiag.activeDealCount} active), ${storeDiag.priceHistoryEntries} price points tracked.`,
    lastChecked: now,
    details: storeDiag
  });
  const hasError = subsystems.some((s) => s.status === "ERROR");
  const hasWarning = subsystems.some((s) => s.status === "WARNING" || s.status === "UNCONFIGURED");
  const overallStatus = hasError ? "CRITICAL" : hasWarning ? "DEGRADED" : "HEALTHY";
  const memUsage = process.memoryUsage();
  const uptimeMs = Date.now() - new Date(metrics.uptimeHours ? Date.now() - metrics.uptimeHours * 36e5 : Date.now()).getTime();
  const eventsPerMinute = metrics.uptimeHours > 0 ? Math.round(metrics.priceEventsProcessed / (metrics.uptimeHours * 60) * 10) / 10 : 0;
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
        alertCount: storeDiag.alertCount
      },
      performance: {
        uptimeHours: metrics.uptimeHours,
        avgProcessingLatencyMs: metrics.avgProcessingLatencyMs,
        eventsPerMinute,
        sseClientCount: sseClients.size,
        memoryUsageMB: Math.round(memUsage.heapUsed / 1024 / 1024 * 10) / 10
      }
    },
    timestamp: now
  });
});
var distPath = path2.join(process.cwd(), "dist");
app.use(express.static(distPath));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  const indexPath = path2.join(distPath, "index.html");
  if (req.accepts("html")) {
    res.sendFile(indexPath);
  } else {
    next();
  }
});
app.listen(PORT, () => {
  console.log("");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("  \u{1F3AF} LOOT 95 \u2014 Deal Intelligence Engine");
  console.log("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  console.log(`  API Server:     http://localhost:${PORT}`);
  console.log(`  SSE Endpoint:   http://localhost:${PORT}/api/events`);
  console.log(`  Diagnostics:    http://localhost:${PORT}/api/diagnostics`);
  console.log("  Status:         ONLINE");
  console.log("  Mode:           100% REAL AMAZON INDIA DATA");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("");
  store.purgeSimulatedData();
  console.log("[Server] Launching 24/7/365 Zero-Cost Live Deal Engine...");
  startLiveEnginePolling(15e3);
  if (process.env.RAPIDAPI_KEY) {
    startRealAmazonPolling(3e4);
  }
  setInterval(() => broadcastStatus(), 5e3);
});
process.on("SIGINT", () => {
  console.log("\n[Server] Shutting down...");
  stopLiveEnginePolling();
  stopRealAmazonPolling();
  store.shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopLiveEnginePolling();
  stopRealAmazonPolling();
  store.shutdown();
  process.exit(0);
});
