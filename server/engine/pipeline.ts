// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Processing Pipeline
// Full scoring, classification, and deal event generation
// ═══════════════════════════════════════════════════════════════

import { v4 as uuid } from 'uuid';
import {
  Product, PriceEvent, DealEvent, DealClassification,
  LootScoreComponents, PriceStatistics,
  DEFAULT_SCORING_CONFIG, ScoringConfig,
} from '../../shared/types.js';
import { store } from '../store.js';
import {
  computePriceStatistics, calculateRarityScore,
  detectAnomaly, detectSleepingProduct,
  predictPreLoot, isNeverSeenBefore,
} from './intelligence.js';
import { judgeDeal } from '../ai/deal-judge.js';
import { sendLoot95EmailAlert } from '../notifications/email.js';

const config = DEFAULT_SCORING_CONFIG;

// SSE clients for real-time push
export const sseClients: Set<import('express').Response> = new Set();

// ─── Main Pipeline ────────────────────────────────────────────

export async function processPriceEvent(product: Product, priceEvent: PriceEvent): Promise<DealEvent | null> {
  const startTime = Date.now();

  // ─── FAST PATH: Reject non-interesting events ─────────────
  const mrpDiscount = (product.mrp - priceEvent.effectivePrice) / product.mrp * 100;

  // Fast reject: less than 30% off MRP → not interesting
  if (mrpDiscount < 30) {
    store.incrementProcessedEvents();
    return null;
  }

  // ─── COMPUTE STATISTICS ───────────────────────────────────
  const history = store.getPriceHistory(product.id);

  // Compute/update statistics for available periods
  const periods: Array<'7d' | '30d' | '90d' | '180d' | '365d'> = ['7d', '30d', '90d', '180d', '365d'];
  const allStats: PriceStatistics[] = [];
  for (const period of periods) {
    const s = computePriceStatistics(product.id, history, period);
    if (s) allStats.push(s);
  }
  store.setStats(product.id, allStats);

  // Use 30d stats as primary, fall back to any available
  const primaryStats = allStats.find(s => s.period === '30d')
    || allStats.find(s => s.period === '90d')
    || allStats[0] || null;

  // ─── DETERMINE NORMAL PRICE ───────────────────────────────
  const normalPrice = primaryStats?.median || product.mrp * 0.85; // If no history, assume ~15% off MRP as "normal"
  const historicalMedian = primaryStats?.median || normalPrice;
  const historicalLow = primaryStats?.min || priceEvent.effectivePrice;

  // Real discount = discount vs actual normal selling price (NOT MRP)
  const realDiscountPct = Math.round((normalPrice - priceEvent.effectivePrice) / normalPrice * 100);

  // Fast reject: less than 30% real discount → not interesting enough
  if (realDiscountPct < 30 && mrpDiscount < 50) {
    store.incrementProcessedEvents();
    return null;
  }

  // ─── ANOMALY DETECTION ────────────────────────────────────
  const anomaly = detectAnomaly(
    priceEvent.effectivePrice,
    priceEvent.previousPrice || normalPrice,
    primaryStats,
    product.mrp
  );

  // ─── RARITY SCORE ─────────────────────────────────────────
  const rarity = calculateRarityScore(priceEvent.effectivePrice, history, primaryStats);

  // ─── SLEEPING PRODUCT ─────────────────────────────────────
  const sleeping = detectSleepingProduct(priceEvent.effectivePrice, primaryStats, history);

  // ─── PRE-LOOT PREDICTION ──────────────────────────────────
  const prediction = predictPreLoot(history, priceEvent.effectivePrice, primaryStats);

  // ─── NEVER SEEN BEFORE ────────────────────────────────────
  const neverSeen = isNeverSeenBefore(priceEvent.effectivePrice, primaryStats, history);

  // ─── COMPUTE SCORE COMPONENTS ─────────────────────────────
  const components = computeScoreComponents(
    priceEvent, product, primaryStats, history,
    anomaly.severity, rarity.score, sleeping, prediction
  );

  // ─── COMPOSITE LOOT SCORE ─────────────────────────────────
  const lootScore = computeLootScore(components, config);

  // ─── CLASSIFY ─────────────────────────────────────────────
  const classification = classify(lootScore, realDiscountPct, anomaly, config);

  // ─── CONFIDENCE ───────────────────────────────────────────
  const confidence = computeConfidence(primaryStats, history.length);
  const confidenceReason = confidence < 0.5
    ? `Limited historical data (${history.length} data points). Score accuracy will improve over time.`
    : confidence < 0.8
      ? `Moderate historical data (${history.length} data points). Good confidence.`
      : `Strong historical data (${history.length} data points). High confidence.`;

  // ─── BUILD EXPLANATIONS ───────────────────────────────────
  const explanations = generateExplanations(
    priceEvent, product, primaryStats, rarity,
    anomaly, sleeping, neverSeen, realDiscountPct
  );

  // ─── CREATE DEAL EVENT ────────────────────────────────────
  const processingLatency = Date.now() - startTime;

  const dealEvent: DealEvent = {
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
    detectedAt: new Date().toISOString(),
    detectionLatencyMs: processingLatency,
    isActive: true,
    expiresAt: null,
    aiVerdict: null,
    aiReasoning: null,
    aiChecks: null,
    explanations,
    priceHistory: history.slice(-90), // Last 90 points for chart
    statistics: primaryStats,
    isSleepingProduct: sleeping.isSleeping,
    isNeverSeenBefore: neverSeen.result,
    priceErrorProbability: anomaly.type === 'price_error' ? anomaly.severity : 0,
    createdAt: new Date().toISOString(),
  };

  // Store the deal event
  store.addDealEvent(dealEvent);
  store.updateLatency(processingLatency, processingLatency);

  // Run AI Deal Judge asynchronously
  judgeDeal(dealEvent).then(aiResult => {
    dealEvent.aiVerdict = aiResult.verdict;
    dealEvent.aiReasoning = aiResult.reasoning;
    dealEvent.aiChecks = aiResult.checks;
    // Broadcast updated deal event to subscribers
    broadcastDeal(dealEvent);
  }).catch(e => console.error('[Pipeline] AI Judge error:', e));

  // Push initial deal event to SSE clients
  broadcastDeal(dealEvent);

  // Trigger Email Alert for rare/loot deals (score >= 70 or LOOT_95 / EXTREME / PRICE_ERROR)
  if (dealEvent.lootScore >= 70 || ['LOOT_95', 'EXTREME', 'PRICE_ERROR'].includes(dealEvent.classification)) {
    sendLoot95EmailAlert(dealEvent).catch(e => console.error('[Pipeline] Email alert error:', e));
  }

  console.log(
    `[Pipeline] ${classification} | Score: ${dealEvent.lootScore} | ` +
    `${product.brand} ${product.model} | ₹${priceEvent.effectivePrice.toLocaleString('en-IN')} ` +
    `(${realDiscountPct}% real discount) | ${processingLatency}ms`
  );

  return dealEvent;
}

// ─── Score Component Calculation ──────────────────────────────

function computeScoreComponents(
  event: PriceEvent,
  product: Product,
  stats: PriceStatistics | null,
  history: PriceHistoryPoint[],
  anomalySeverity: number,
  rarityScore: number,
  sleeping: ReturnType<typeof detectSleepingProduct>,
  prediction: ReturnType<typeof predictPreLoot>
): LootScoreComponents {
  const price = event.effectivePrice;
  const normalPrice = stats?.median || product.mrp * 0.85;

  return {
    // Historical deviation: z-score mapped to 0-100
    historicalDeviation: stats
      ? Math.min(100, Math.max(0, ((stats.mean - price) / (stats.stddev || 1)) * 20))
      : Math.min(100, ((product.mrp - price) / product.mrp) * 120),

    // Historical rarity: from rarity calculator
    historicalRarity: rarityScore,

    // Discount vs various baselines
    discountVsNormal: Math.min(100, Math.max(0, ((normalPrice - price) / normalPrice) * 100)),
    discountVsMedian: stats
      ? Math.min(100, Math.max(0, ((stats.median - price) / stats.median) * 100))
      : 0,
    discountVsMin: stats
      ? Math.min(100, Math.max(0, ((stats.min - price) / (stats.min || 1)) * 100 + 50))
      : 0,

    // Cross-platform: future feature, default to 50
    crossPlatformDiff: 50,

    // Price velocity: how fast did price drop?
    priceVelocity: event.priceChangePct
      ? Math.min(100, Math.abs(event.priceChangePct) * 1.5)
      : 0,

    // Seller reliability: based on seller rating
    sellerReliability: Math.min(100, (product.sellerRating / 5) * 100),

    // Stock
    stockAvailability: product.stockStatus === 'in_stock' ? 100
      : product.stockStatus === 'low_stock' ? 60 : 0,

    // Deal frequency inverse: how rarely does this discount?
    dealFrequencyInverse: stats
      ? Math.max(0, 100 - (stats.extremeDiscountCount / Math.max(1, stats.sampleCount)) * 500)
      : 70,

    // Sleeping product
    sleepingProductBonus: sleeping.isSleeping ? sleeping.priceStability : 0,

    // Condition penalty
    conditionPenalty: (product.couponRequired ? 30 : 0) + (product.bankOfferRequired ? 20 : 0),

    // Disappearance probability
    disappearanceProbability: prediction.disappearanceProbability,

    // Confidence adjustment
    confidenceAdjustment: computeConfidence(stats, history.length),
  };
}

// ─── Composite Loot Score ─────────────────────────────────────

function computeLootScore(components: LootScoreComponents, config: ScoringConfig): number {
  const w = config.weights;

  let score =
    components.historicalDeviation * w.historicalDeviation +
    components.historicalRarity * w.historicalRarity +
    components.discountVsNormal * w.discountVsNormal +
    components.discountVsMedian * w.discountVsMedian +
    components.discountVsMin * w.discountVsMin +
    components.crossPlatformDiff * w.crossPlatformDiff +
    components.priceVelocity * w.priceVelocity +
    components.sellerReliability * w.sellerReliability +
    components.stockAvailability * w.stockAvailability +
    components.dealFrequencyInverse * w.dealFrequencyInverse +
    components.sleepingProductBonus * w.sleepingProductBonus +
    components.conditionPenalty * w.conditionPenalty +
    components.disappearanceProbability * w.disappearanceProbability;

  // Scale by confidence
  score *= (0.5 + 0.5 * components.confidenceAdjustment);

  return Math.max(0, Math.min(100, score));
}

// ─── Classification ───────────────────────────────────────────

function classify(
  lootScore: number,
  realDiscountPct: number,
  anomaly: { type: string; severity: number },
  config: ScoringConfig
): DealClassification {
  // Price error overrides
  if (anomaly.type === 'price_error' && anomaly.severity > 85) return 'PRICE_ERROR';

  // Score-based classification
  if (lootScore >= config.thresholds.loot95 && realDiscountPct >= 80) return 'LOOT_95';
  if (lootScore >= config.thresholds.extreme && realDiscountPct >= 60) return 'EXTREME';
  if (lootScore >= config.thresholds.hot) return 'HOT';
  if (lootScore >= config.thresholds.great) return 'GREAT';
  return 'NORMAL';
}

// ─── Confidence ───────────────────────────────────────────────

function computeConfidence(stats: PriceStatistics | null, historyLength: number): number {
  if (!stats) return 0.2;
  if (stats.sampleCount < 5) return 0.3;
  if (stats.sampleCount < 15) return 0.5;
  if (stats.sampleCount < 30) return 0.7;
  if (stats.sampleCount < 60) return 0.85;
  return 0.95;
}

// ─── Explanation Generator ────────────────────────────────────

function generateExplanations(
  event: PriceEvent,
  product: Product,
  stats: PriceStatistics | null,
  rarity: { score: number; reason: string },
  anomaly: { severity: number; details: string; type: string },
  sleeping: { isSleeping: boolean; details: string },
  neverSeen: { result: boolean; message: string },
  realDiscountPct: number
): string[] {
  const explanations: string[] = [];

  if (stats) {
    explanations.push(
      `Current price is ${realDiscountPct}% below the ${stats.period} median of ₹${stats.median.toLocaleString('en-IN')}`
    );
  } else {
    explanations.push(`Current price is ${realDiscountPct}% below normal market price`);
  }

  if (neverSeen.result) {
    explanations.push(neverSeen.message);
  }

  if (rarity.score > 80) {
    explanations.push(`Rarity score: ${rarity.score}/100 — ${rarity.reason}`);
  }

  if (anomaly.severity > 50) {
    explanations.push(anomaly.details);
  }

  if (sleeping.isSleeping) {
    explanations.push(sleeping.details);
  }

  if (product.stockStatus === 'in_stock') {
    explanations.push('Product is currently in stock');
  } else if (product.stockStatus === 'low_stock') {
    explanations.push('⚠️ Low stock — product may sell out soon');
  }

  if (product.couponRequired) {
    explanations.push(`Requires coupon code: ${product.couponCode || 'check listing'}`);
  }

  if (product.bankOfferRequired) {
    explanations.push(`Bank offer required: ${product.bankOfferDetails || 'check listing'}`);
  }

  if (event.priceChangePct && Math.abs(event.priceChangePct) > 20) {
    explanations.push(
      `Price dropped ${Math.abs(Math.round(event.priceChangePct))}% in recent check`
    );
  }

  return explanations;
}

// ─── SSE Broadcasting ─────────────────────────────────────────

function broadcastDeal(deal: DealEvent): void {
  const data = JSON.stringify({ type: 'deal', data: deal });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function broadcastStatus(): void {
  const metrics = store.getMetrics();
  const connectors = store.getConnectorStatuses();
  const data = JSON.stringify({
    type: 'status',
    data: {
      isOnline: true,
      uptime: metrics.uptimeHours,
      connectors,
      metrics,
      lastUpdated: new Date().toISOString(),
    },
  });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}
