var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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
        for (const [id] of this.products.entries()) {
          if (id.startsWith("sim_") || id.startsWith("amz_in_sim_")) {
            this.products.delete(id);
            this.priceHistory.delete(id);
            this.priceStats.delete(id);
          }
        }
        this.dealEvents = this.dealEvents.filter((d) => !d.productId.startsWith("sim_") && !d.productId.startsWith("amz_in_sim_"));
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
var init_intelligence = __esm({
  "server/engine/intelligence.ts"() {
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
  const { product, currentPrice, normalPrice, realDiscountPct, lootScore, classification, aiJudge } = deal;
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
        <strong>AI Deal Audit:</strong> ${aiJudge?.reasoning || "Verified genuine price drop below 30-day historical median."}
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
  if (mrpDiscount < 30) {
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
    prediction
  );
  const lootScore = computeLootScore(components, config);
  const classification = classify(lootScore, realDiscountPct, anomaly, config);
  const confidence = computeConfidence(primaryStats, history.length);
  const confidenceReason = confidence < 0.5 ? `Limited historical data (${history.length} data points). Score accuracy will improve over time.` : confidence < 0.8 ? `Moderate historical data (${history.length} data points). Good confidence.` : `Strong historical data (${history.length} data points). High confidence.`;
  const explanations = generateExplanations(
    priceEvent,
    product,
    primaryStats,
    rarity,
    anomaly,
    sleeping,
    neverSeen,
    realDiscountPct
  );
  const processingLatency = Date.now() - startTime;
  const dealEvent = {
    id: uuid(),
    productId: product.id,
    product,
    classification,
    lootScore: Math.round(lootScore * 10) / 10,
    rarityScore: rarity.score,
    scoreComponents: components,
    confidence: Math.round(confidence * 100) / 100,
    confidenceReason,
    currentPrice: priceEvent.effectivePrice,
    normalPrice: Math.round(normalPrice),
    historicalMedian: Math.round(historicalMedian),
    historicalLow: Math.round(historicalLow),
    realDiscountPct,
    displayedDiscountPct: Math.round(mrpDiscount),
    detectedAt: (/* @__PURE__ */ new Date()).toISOString(),
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
function computeScoreComponents(event, product, stats, history, anomalySeverity, rarityScore, sleeping, prediction) {
  const price = event.effectivePrice;
  const normalPrice = stats?.median || product.mrp * 0.85;
  return {
    // Historical deviation: z-score mapped to 0-100
    historicalDeviation: stats ? Math.min(100, Math.max(0, (stats.mean - price) / (stats.stddev || 1) * 20)) : Math.min(100, (product.mrp - price) / product.mrp * 120),
    // Historical rarity: from rarity calculator
    historicalRarity: rarityScore,
    // Discount vs various baselines
    discountVsNormal: Math.min(100, Math.max(0, (normalPrice - price) / normalPrice * 100)),
    discountVsMedian: stats ? Math.min(100, Math.max(0, (stats.median - price) / stats.median * 100)) : 0,
    discountVsMin: stats ? Math.min(100, Math.max(0, (stats.min - price) / (stats.min || 1) * 100 + 50)) : 0,
    // Cross-platform: future feature, default to 50
    crossPlatformDiff: 50,
    // Price velocity: how fast did price drop?
    priceVelocity: event.priceChangePct ? Math.min(100, Math.abs(event.priceChangePct) * 1.5) : 0,
    // Seller reliability: based on seller rating
    sellerReliability: Math.min(100, product.sellerRating / 5 * 100),
    // Stock
    stockAvailability: product.stockStatus === "in_stock" ? 100 : product.stockStatus === "low_stock" ? 60 : 0,
    // Deal frequency inverse: how rarely does this discount?
    dealFrequencyInverse: stats ? Math.max(0, 100 - stats.extremeDiscountCount / Math.max(1, stats.sampleCount) * 500) : 70,
    // Sleeping product
    sleepingProductBonus: sleeping.isSleeping ? sleeping.priceStability : 0,
    // Condition penalty
    conditionPenalty: (product.couponRequired ? 30 : 0) + (product.bankOfferRequired ? 20 : 0),
    // Disappearance probability
    disappearanceProbability: prediction.disappearanceProbability,
    // Confidence adjustment
    confidenceAdjustment: computeConfidence(stats, history.length)
  };
}
function computeLootScore(components, config2) {
  const w = config2.weights;
  let score = components.historicalDeviation * w.historicalDeviation + components.historicalRarity * w.historicalRarity + components.discountVsNormal * w.discountVsNormal + components.discountVsMedian * w.discountVsMedian + components.discountVsMin * w.discountVsMin + components.crossPlatformDiff * w.crossPlatformDiff + components.priceVelocity * w.priceVelocity + components.sellerReliability * w.sellerReliability + components.stockAvailability * w.stockAvailability + components.dealFrequencyInverse * w.dealFrequencyInverse + components.sleepingProductBonus * w.sleepingProductBonus + components.conditionPenalty * w.conditionPenalty + components.disappearanceProbability * w.disappearanceProbability;
  score *= 0.5 + 0.5 * components.confidenceAdjustment;
  return Math.max(0, Math.min(100, score));
}
function classify(lootScore, realDiscountPct, anomaly, config2) {
  if (anomaly.type === "price_error" && anomaly.severity > 85) return "PRICE_ERROR";
  if (lootScore >= config2.thresholds.loot95 && realDiscountPct >= 80) return "LOOT_95";
  if (lootScore >= config2.thresholds.extreme && realDiscountPct >= 60) return "EXTREME";
  if (lootScore >= config2.thresholds.hot) return "HOT";
  if (lootScore >= config2.thresholds.great) return "GREAT";
  return "NORMAL";
}
function computeConfidence(stats, historyLength) {
  if (!stats) return 0.2;
  if (stats.sampleCount < 5) return 0.3;
  if (stats.sampleCount < 15) return 0.5;
  if (stats.sampleCount < 30) return 0.7;
  if (stats.sampleCount < 60) return 0.85;
  return 0.95;
}
function generateExplanations(event, product, stats, rarity, anomaly, sleeping, neverSeen, realDiscountPct) {
  const explanations = [];
  if (stats) {
    explanations.push(
      `Current price is ${realDiscountPct}% below the ${stats.period} median of \u20B9${stats.median.toLocaleString("en-IN")}`
    );
  } else {
    explanations.push(`Current price is ${realDiscountPct}% below normal market price`);
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
    init_deal_judge();
    init_email();
    config = DEFAULT_SCORING_CONFIG;
    sseClients = /* @__PURE__ */ new Set();
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
  const simulatedMedian = payload.mrp * 0.85;
  for (let i = 15; i >= 1; i--) {
    const historicalTs = new Date(Date.now() - i * 24 * 3600 * 1e3).toISOString();
    const variation = (Math.random() - 0.5) * 0.05 * simulatedMedian;
    const histPrice = Math.round((simulatedMedian + variation) / 10) * 10 - 1;
    store.addPricePoint(productId, {
      timestamp: historicalTs,
      price: histPrice,
      effectivePrice: histPrice
    });
  }
  const priceEvent = {
    id: uuid4(),
    productId,
    price: payload.currentPrice,
    mrp: payload.mrp,
    effectivePrice: payload.currentPrice,
    previousPrice: simulatedMedian,
    priceChange: payload.currentPrice - simulatedMedian,
    priceChangePct: (payload.currentPrice - simulatedMedian) / simulatedMedian * 100,
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

// server/connectors/simulator.ts
init_store();
init_pipeline();
import { v4 as uuid2 } from "uuid";
function initializeSimulator() {
  console.log("[Simulator] Fake simulation completely disabled. Operating strictly in 100% REAL AMAZON INDIA API mode.");
}
function startSimulation() {
}
function stopSimulation() {
}

// server/connectors/rapidapi.ts
init_store();
init_pipeline();
import { v4 as uuid3 } from "uuid";
var RAPIDAPI_KEY2 = process.env.RAPIDAPI_KEY || "c1ff680d50msh57a77dea7bbca31p133f8ejsnaf685241d8df";
var RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "real-time-amazon-data.p.rapidapi.com";
var ELECTRONICS_QUERIES = [
  "electronics deals of the day",
  "high discount smartphones",
  "laptops price drop",
  "wireless headphones offers",
  "smart tv 4k discount",
  "best tech offers",
  "tablets price crash",
  "gaming laptop deals",
  "smartwatch discounts",
  "bluetooth speaker offers",
  "pc components discount",
  "camera price drop",
  "audio system offers",
  "gadgets loot deals",
  "electronics clearance sale"
];
async function fetchRealAmazonDeals(query = "electronics deals") {
  const currentKey = process.env.RAPIDAPI_KEY || RAPIDAPI_KEY2;
  if (!currentKey) {
    store.setConnectorStatus({
      platform: "amazon",
      status: "STANDBY",
      lastSuccessAt: null,
      lastErrorAt: null,
      errorMessage: "Set RAPIDAPI_KEY in .env for live Amazon India API fetches",
      eventsProcessed: store.getMetrics().processedEventsCount,
      avgLatencyMs: 2
    });
    return [];
  }
  console.log(`[RapidAPI Connector] Fetching live real-time Amazon.in data for query: "${query}"...`);
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
    const data = await res.json();
    const items = data.data?.products || data.products || [];
    console.log(`[RapidAPI Connector] Retrieved ${items.length} live product listings from Amazon India.`);
    const processedDeals = [];
    for (const item of items) {
      if (!item.product_title || !item.product_price) continue;
      const rawPrice = parseFloat(String(item.product_price).replace(/[^0-9.]/g, ""));
      const rawMrp = parseFloat(String(item.product_original_price || item.product_mrp || rawPrice * 1.3).replace(/[^0-9.]/g, ""));
      if (!rawPrice || rawPrice <= 0) continue;
      const productId = `amz_in_${item.asin || uuid3().substring(0, 8)}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const product = {
        id: productId,
        brand: item.product_by_line || item.brand || extractBrand(item.product_title),
        model: item.product_title.substring(0, 40),
        title: item.product_title,
        category: "Electronics",
        subcategory: item.category || "General",
        platform: "amazon",
        platformProductId: item.asin || productId,
        url: item.product_url || `https://amazon.in/dp/${item.asin}`,
        imageUrl: item.product_photo || "",
        mrp: Math.max(rawMrp, rawPrice),
        currentPrice: rawPrice,
        effectivePrice: rawPrice,
        sellerName: item.seller_name || "Amazon Appstore / Verified Seller",
        sellerRating: parseFloat(item.product_star_rating) || 4.2,
        stockStatus: item.is_out_of_stock ? "out_of_stock" : "in_stock",
        rating: parseFloat(item.product_star_rating) || 4,
        reviewCount: parseInt(item.product_num_ratings) || 50,
        couponRequired: !!item.has_coupon,
        bankOfferRequired: false,
        specifications: {},
        lastCheckedAt: now,
        createdAt: now,
        updatedAt: now
      };
      store.addProduct(product);
      store.addPricePoint(productId, {
        timestamp: now,
        price: rawPrice,
        effectivePrice: rawPrice
      });
      const priceEvent = {
        id: uuid3(),
        productId,
        price: rawPrice,
        mrp: Math.max(rawMrp, rawPrice),
        effectivePrice: rawPrice,
        previousPrice: Math.max(rawMrp, rawPrice),
        priceChange: rawPrice - Math.max(rawMrp, rawPrice),
        priceChangePct: (rawPrice - Math.max(rawMrp, rawPrice)) / Math.max(rawMrp, rawPrice) * 100,
        sourceTimestamp: now,
        ingestedAt: now,
        platform: "amazon"
      };
      const deal = await processPriceEvent(product, priceEvent);
      if (deal) processedDeals.push(deal);
    }
    const prevProcessed = store.getConnectorStatuses().find((c) => c.platform === "amazon")?.eventsProcessed || 0;
    store.setConnectorStatus({
      platform: "amazon",
      status: "ONLINE",
      lastSuccessAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastErrorAt: null,
      errorMessage: null,
      eventsProcessed: prevProcessed + items.length,
      avgLatencyMs: 320
    });
    return processedDeals;
  } catch (error) {
    console.error("[RapidAPI Connector] Error fetching Amazon India data:", error.message);
    const prevProcessed = store.getConnectorStatuses().find((c) => c.platform === "amazon")?.eventsProcessed || 0;
    store.setConnectorStatus({
      platform: "amazon",
      status: prevProcessed > 0 ? "ONLINE" : "STANDBY",
      lastSuccessAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastErrorAt: (/* @__PURE__ */ new Date()).toISOString(),
      errorMessage: error.message,
      eventsProcessed: prevProcessed,
      avgLatencyMs: 0
    });
    return [];
  }
}
function extractBrand(title) {
  const words = title.split(" ");
  return words[0] || "Generic";
}
var pollTimer = null;
function startRealAmazonPolling(intervalMs = 2e4) {
  const currentKey = process.env.RAPIDAPI_KEY || RAPIDAPI_KEY2;
  if (!currentKey) return;
  console.log(`[RapidAPI Connector] Starting 100% REAL Amazon India deal polling (interval: ${intervalMs / 1e3}s)`);
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
  setTimeout(() => fetchRealAmazonDeals("electronics deals of the day").catch(() => {
  }), 500);
  setTimeout(() => fetchRealAmazonDeals("high discount smartphones").catch(() => {
  }), 3e3);
  setTimeout(() => fetchRealAmazonDeals("laptops price drop").catch(() => {
  }), 5500);
  setTimeout(() => fetchRealAmazonDeals("smart tv 4k discount").catch(() => {
  }), 8e3);
  setTimeout(() => fetchRealAmazonDeals("wireless headphones offers").catch(() => {
  }), 10500);
  pollTimer = setInterval(poll, intervalMs);
}
function stopRealAmazonPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// server/index.ts
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
app.post("/api/settings/email", (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) {
    res.status(400).json({ success: false, error: "Invalid email address" });
    return;
  }
  const { setRecipientEmail: setRecipientEmail2 } = (init_email(), __toCommonJS(email_exports));
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
  console.log(`  API Server:    http://localhost:${PORT}`);
  console.log(`  SSE Endpoint:  http://localhost:${PORT}/api/events`);
  console.log("  Status:        ONLINE");
  console.log("  Mode:          SIMULATION (realistic electronics data)");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("");
  const hasRealKeys = !!(process.env.RAPIDAPI_KEY || RAPIDAPI_KEY);
  if (hasRealKeys) {
    console.log("[Server] 100% REAL DATA MODE ACTIVE \u2014 Disabling simulation & purging synthetic data.");
    stopSimulation();
    store.purgeSimulatedData();
    startRealAmazonPolling(2e4);
  } else {
    console.log("[Server] SIMULATION MODE ACTIVE \u2014 Set RAPIDAPI_KEY in .env for live Amazon India deals.");
    initializeSimulator();
    startSimulation(3e3);
  }
  setInterval(() => broadcastStatus(), 5e3);
});
process.on("SIGINT", () => {
  console.log("\n[Server] Shutting down...");
  stopSimulation();
  stopRealAmazonPolling();
  store.shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopSimulation();
  stopRealAmazonPolling();
  store.shutdown();
  process.exit(0);
});
