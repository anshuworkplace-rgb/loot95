// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Intelligence Engine
// Rarity calculation, anomaly detection, sleeping product hunter,
// price statistics, pre-loot prediction
// ═══════════════════════════════════════════════════════════════

import { PriceHistoryPoint, PriceStatistics, Product, DealAnomalyMetrics } from '../../shared/types.js';
import type { AggregatedPriceBaseline } from '../connectors/price_tracker_aggregator.js';

// ─── Statistical Helpers ──────────────────────────────────────

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function percentileRank(arr: number[], value: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;
  const equal = sorted.filter(v => v === value).length;
  return ((below + 0.5 * equal) / sorted.length) * 100;
}

// ─── Compute Price Statistics ─────────────────────────────────

export function computePriceStatistics(
  productId: string,
  history: PriceHistoryPoint[],
  period: '7d' | '30d' | '90d' | '180d' | '365d'
): PriceStatistics | null {
  const periodDays: Record<string, number> = {
    '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365
  };
  const days = periodDays[period];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const points = history.filter(p => new Date(p.timestamp).getTime() >= cutoff);

  if (points.length < 2) return null;

  const prices = points.map(p => p.effectivePrice);
  const m = median(prices);

  // Count extreme discounts (>50% below median)
  const extremeThreshold = m * 0.5;
  const extremeCount = prices.filter(p => p < extremeThreshold).length;

  // Find last extreme discount timestamp
  let lastExtremeAt: string | null = null;
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
    computedAt: new Date().toISOString(),
  };
}

// ─── Rarity Score ─────────────────────────────────────────────

export function calculateRarityScore(
  currentPrice: number,
  history: PriceHistoryPoint[],
  stats: PriceStatistics | null
): { score: number; reason: string } {
  if (!stats || stats.sampleCount < 3) {
    // Not enough data — return moderate rarity with low confidence
    return { score: 50, reason: 'Insufficient historical data for accurate rarity calculation' };
  }

  const prices = history.map(p => p.effectivePrice);
  
  // 1. Percentile rank: what % of historical prices are above current?
  const pRank = 100 - percentileRank(prices, currentPrice);

  // 2. Z-score: how many standard deviations below mean?
  const zScore = (stats.mean - currentPrice) / (stats.stddev || 1);
  const zComponent = Math.min(100, Math.max(0, zScore * 20)); // Scale: 5 stddevs = 100

  // 3. Below historical minimum bonus
  const belowMin = currentPrice < stats.min ? 20 : 0;

  // 4. Frequency of similar prices
  const similarPrices = prices.filter(p => Math.abs(p - currentPrice) / currentPrice < 0.05);
  const frequencyRarity = Math.max(0, 100 - (similarPrices.length / prices.length) * 100);

  // 5. Time since last similar price
  let timeSinceLastSimilar = 100; // Assume very rare
  for (let i = history.length - 1; i >= 0; i--) {
    if (Math.abs(history[i].effectivePrice - currentPrice) / currentPrice < 0.1) {
      const daysSince = (Date.now() - new Date(history[i].timestamp).getTime()) / 86400000;
      timeSinceLastSimilar = Math.min(100, daysSince * 2); // 50 days = 100
      break;
    }
  }

  // Weighted composite
  const score = Math.min(100, Math.max(0,
    pRank * 0.35 +
    zComponent * 0.25 +
    belowMin +
    frequencyRarity * 0.1 +
    timeSinceLastSimilar * 0.1
  ));

  const reasons: string[] = [];
  if (pRank > 90) reasons.push(`Price is lower than ${Math.round(pRank)}% of all recorded prices`);
  if (zScore > 2) reasons.push(`${zScore.toFixed(1)} standard deviations below average price`);
  if (belowMin > 0) reasons.push('Below all-time recorded minimum price');
  if (frequencyRarity > 80) reasons.push('This price level is extremely uncommon');

  return {
    score: Math.round(score * 10) / 10,
    reason: reasons.join('. ') || 'Price is unusual compared to historical data',
  };
}

// ─── Anomaly Detection ────────────────────────────────────────

export interface AnomalyResult {
  isAnomaly: boolean;
  severity: number;  // 0-100
  type: 'price_drop' | 'price_error' | 'flash_deal' | 'normal';
  details: string;
}

export function detectAnomaly(
  currentPrice: number,
  previousPrice: number,
  stats: PriceStatistics | null,
  mrp: number
): AnomalyResult {
  // If no stats, use MRP-based heuristic
  if (!stats) {
    const dropFromMrp = (mrp - currentPrice) / mrp * 100;
    if (dropFromMrp > 85) {
      return {
        isAnomaly: true,
        severity: 80,
        type: 'price_drop',
        details: `${Math.round(dropFromMrp)}% below MRP (limited historical data)`,
      };
    }
    return { isAnomaly: false, severity: 0, type: 'normal', details: 'No anomaly detected' };
  }

  const zScore = (stats.mean - currentPrice) / (stats.stddev || 1);
  const dropFromMedian = (stats.median - currentPrice) / stats.median * 100;
  const dropFromPrevious = (previousPrice - currentPrice) / previousPrice * 100;
  const belowMin = currentPrice < stats.min;

  // Price error detection: >95% below median, extremely low price
  if (dropFromMedian > 95 && currentPrice < 500) {
    return {
      isAnomaly: true,
      severity: 95,
      type: 'price_error',
      details: `Price is ${Math.round(dropFromMedian)}% below median — possible pricing error`,
    };
  }

  // Extreme anomaly: z-score > 3 or below historical min by >30%
  if (zScore > 3 || (belowMin && (stats.min - currentPrice) / stats.min > 0.3)) {
    return {
      isAnomaly: true,
      severity: Math.min(100, Math.round(zScore * 20)),
      type: 'price_drop',
      details: `Price is ${zScore.toFixed(1)} standard deviations below mean${belowMin ? ', and below all-time low' : ''}`,
    };
  }

  // Strong anomaly: z-score > 2 or sudden drop > 40%
  if (zScore > 2 || dropFromPrevious > 40) {
    return {
      isAnomaly: true,
      severity: Math.min(90, Math.round(zScore * 15)),
      type: dropFromPrevious > 50 ? 'flash_deal' : 'price_drop',
      details: `Significant price deviation detected (z=${zScore.toFixed(1)})`,
    };
  }

  // Moderate anomaly
  if (zScore > 1.5 || dropFromMedian > 30) {
    return {
      isAnomaly: true,
      severity: Math.round(zScore * 12),
      type: 'price_drop',
      details: `Moderate price deviation from normal (${Math.round(dropFromMedian)}% below median)`,
    };
  }

  return { isAnomaly: false, severity: 0, type: 'normal', details: 'Price within normal range' };
}

// ─── Sleeping Product Detection ───────────────────────────────

export interface SleepingProductResult {
  isSleeping: boolean;
  priceStability: number;  // 0-100, how stable the price normally is
  dropMagnitude: number;   // How large the current drop is relative to stability
  details: string;
}

export function detectSleepingProduct(
  currentPrice: number,
  stats: PriceStatistics | null,
  history: PriceHistoryPoint[]
): SleepingProductResult {
  if (!stats || stats.sampleCount < 10) {
    return { isSleeping: false, priceStability: 0, dropMagnitude: 0, details: 'Insufficient data' };
  }

  // Calculate coefficient of variation (CV) — measure of price stability
  const cv = stats.stddev / stats.mean;
  const priceStability = Math.max(0, Math.min(100, (1 - cv) * 100));

  // A "sleeping product" has:
  // 1. Very stable pricing (CV < 0.1, stability > 90%)
  // 2. Very few extreme discounts in history
  // 3. Current price is significantly below normal

  const dropFromMedian = (stats.median - currentPrice) / stats.median * 100;
  const isStable = priceStability > 80;
  const rarelyDiscounted = stats.extremeDiscountCount <= 1;
  const significantDrop = dropFromMedian > 40;

  const isSleeping = isStable && rarelyDiscounted && significantDrop;

  return {
    isSleeping,
    priceStability: Math.round(priceStability),
    dropMagnitude: Math.round(dropFromMedian),
    details: isSleeping
      ? `Normally stable product (stability: ${Math.round(priceStability)}%) with ${Math.round(dropFromMedian)}% price drop — SLEEPING PRODUCT ACTIVATED`
      : `Price stability: ${Math.round(priceStability)}%, drop: ${Math.round(dropFromMedian)}%`,
  };
}

// ─── Pre-Loot Prediction ──────────────────────────────────────

export interface PreLootPrediction {
  probability: number;           // 0-100
  trend: 'accelerating_drop' | 'steady_drop' | 'stable' | 'rising';
  disappearanceProbability: number; // 0-100
  details: string;
}

export function predictPreLoot(
  history: PriceHistoryPoint[],
  currentPrice: number,
  stats: PriceStatistics | null
): PreLootPrediction {
  if (history.length < 5) {
    return {
      probability: 0,
      trend: 'stable',
      disappearanceProbability: 50,
      details: 'Insufficient data for prediction',
    };
  }

  // Look at last N price points for trajectory
  const recentN = Math.min(10, history.length);
  const recent = history.slice(-recentN);
  const prices = recent.map(p => p.effectivePrice);

  // Calculate consecutive drops
  let consecutiveDrops = 0;
  let totalDropPct = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] < prices[i - 1]) {
      consecutiveDrops++;
      totalDropPct += (prices[i - 1] - prices[i]) / prices[i - 1] * 100;
    }
  }

  // Check acceleration (drops getting bigger)
  let isAccelerating = false;
  if (consecutiveDrops >= 3) {
    const drops: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] < prices[i - 1]) {
        drops.push((prices[i - 1] - prices[i]) / prices[i - 1] * 100);
      }
    }
    if (drops.length >= 3) {
      isAccelerating = drops[drops.length - 1] > drops[drops.length - 2];
    }
  }

  let trend: PreLootPrediction['trend'] = 'stable';
  let probability = 0;

  if (isAccelerating && consecutiveDrops >= 3) {
    trend = 'accelerating_drop';
    probability = Math.min(95, 40 + consecutiveDrops * 10 + totalDropPct);
  } else if (consecutiveDrops >= 2) {
    trend = 'steady_drop';
    probability = Math.min(70, 20 + consecutiveDrops * 8 + totalDropPct * 0.5);
  } else if (prices[prices.length - 1] > prices[0]) {
    trend = 'rising';
    probability = 5;
  }

  // Disappearance probability: extreme deals vanish fast
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
    details: trend === 'accelerating_drop'
      ? `${consecutiveDrops} consecutive price drops with acceleration — ${Math.round(probability)}% probability of reaching extreme territory`
      : trend === 'steady_drop'
        ? `Steady downward trend (${consecutiveDrops} drops) — monitoring for acceleration`
        : 'No clear downward trend detected',
  };
}

// ─── "Never Seen Before" Detection ────────────────────────────

export function isNeverSeenBefore(
  currentPrice: number,
  stats: PriceStatistics | null,
  history: PriceHistoryPoint[]
): { result: boolean; message: string } {
  if (!stats || stats.sampleCount < 10) {
    return { result: false, message: 'Insufficient history' };
  }

  if (currentPrice < stats.min) {
    const pctBelow = ((stats.min - currentPrice) / stats.min * 100).toFixed(1);
    return {
      result: true,
      message: `This product has never been observed below ₹${stats.min.toLocaleString('en-IN')} in our available history (${stats.sampleCount} data points). Current: ₹${currentPrice.toLocaleString('en-IN')} — ${pctBelow}% below previous record.`,
    };
  }

  return { result: false, message: '' };
}

// ─── Deal Anomaly Metrics Calculator ──────────────────────────

export function computeDealAnomalyMetrics(
  product: Product,
  currentPrice: number,
  mrp: number,
  stats: PriceStatistics | null,
  aggregatorBaseline: AggregatedPriceBaseline | null
): DealAnomalyMetrics {
  const normalPrice = aggregatorBaseline?.averageSellingPrice || stats?.median || mrp;
  const typicalLowestPrice = aggregatorBaseline?.typicalLowestPrice || aggregatorBaseline?.allTimeLow || stats?.min || Math.round(normalPrice * 0.80);

  // Calculate Historical Percentile
  let historicalPercentile = 50.0;
  const points = aggregatorBaseline?.pricePoints || [];

  if (points.length > 0) {
    const countBelow = points.filter(p => p <= currentPrice).length;
    historicalPercentile = Math.max(0.1, Math.min(99.9, Math.round((countBelow / points.length) * 100 * 10) / 10));
  } else {
    const dropBelowLowRatio = (typicalLowestPrice - currentPrice) / (typicalLowestPrice || 1);
    if (dropBelowLowRatio > 0.3) historicalPercentile = 0.8;
    else if (dropBelowLowRatio > 0.15) historicalPercentile = 1.2;
    else if (dropBelowLowRatio > 0) historicalPercentile = 4.5;
    else historicalPercentile = Math.round((currentPrice / normalPrice) * 100 * 10) / 10;
  }

  // Rarity Label
  let rarityLabel: 'VERY HIGH' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
  if (historicalPercentile <= 3.0) rarityLabel = 'VERY HIGH';
  else if (historicalPercentile <= 10.0) rarityLabel = 'HIGH';
  else if (historicalPercentile <= 25.0) rarityLabel = 'MODERATE';

  // Price Anomaly Score (0-100)
  let priceAnomalyScore = 50;
  const dropVsTypical = (typicalLowestPrice - currentPrice) / (typicalLowestPrice || 1);
  const dropVsNormal = (normalPrice - currentPrice) / (normalPrice || 1);

  if (currentPrice < typicalLowestPrice) {
    priceAnomalyScore = Math.min(99, Math.round(80 + dropVsTypical * 40));
  } else {
    priceAnomalyScore = Math.max(10, Math.round(dropVsNormal * 100));
  }

  // Demand Label
  let demandLabel: 'EXTREME' | 'HIGH' | 'MODERATE' | 'NORMAL' = 'NORMAL';
  if (dropVsNormal >= 0.5 || dropVsTypical >= 0.25) demandLabel = 'EXTREME';
  else if (dropVsNormal >= 0.35 || dropVsTypical >= 0.1) demandLabel = 'HIGH';
  else if (dropVsNormal >= 0.20) demandLabel = 'MODERATE';

  // Seller Confidence Label
  let sellerConfidenceLabel: 'VERY HIGH' | 'HIGH' | 'MODERATE' | 'LOW' = 'HIGH';
  if (product.verifiedLive && product.sellerRating >= 4.5) sellerConfidenceLabel = 'VERY HIGH';
  else if (product.sellerRating >= 4.0) sellerConfidenceLabel = 'HIGH';
  else if (product.sellerRating >= 3.5) sellerConfidenceLabel = 'MODERATE';
  else sellerConfidenceLabel = 'LOW';

  // Composite Deal Score (0-100, e.g. 97.8)
  const scoreComponent1 = priceAnomalyScore * 0.45;
  const scoreComponent2 = (100 - historicalPercentile) * 0.35;
  const scoreComponent3 = Math.min(100, Math.max(0, dropVsNormal * 100)) * 0.20;

  const rawComposite = scoreComponent1 + scoreComponent2 + scoreComponent3;
  const compositeDealScore = Math.round(Math.min(99.9, Math.max(10.0, rawComposite)) * 10) / 10;

  return {
    normalPrice,
    typicalLowestPrice,
    currentPrice,
    historicalPercentile,
    rarityLabel,
    priceAnomalyScore,
    demandLabel,
    sellerConfidenceLabel,
    compositeDealScore,
  };
}
