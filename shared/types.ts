// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Shared Types
// All TypeScript types used across server and client
// ═══════════════════════════════════════════════════════════════

// ─── Platform & Enums ─────────────────────────────────────────

export type Platform = 'amazon' | 'flipkart' | 'myntra' | 'croma' | 'ajio' | 'nykaa' | 'simulator';

export type DealClassification = 'NORMAL' | 'GREAT' | 'HOT' | 'EXTREME' | 'LOOT_95' | 'PRICE_ERROR';

export type AIVerdict = 
  | 'VERIFIED_LOOT'
  | 'PROBABLE_LOOT'
  | 'PRICE_ANOMALY'
  | 'POSSIBLE_PRICE_ERROR'
  | 'NORMAL_DEAL'
  | 'FALSE_DEAL';

export type AlertPriority = 'CRITICAL' | 'HIGH' | 'NORMAL';

export type ConnectorStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'ERROR';

// ─── Product ──────────────────────────────────────────────────

export interface Product {
  id: string;
  brand: string;
  model: string;
  title: string;
  category: string;
  subcategory: string;
  platform: Platform;
  platformProductId: string;
  url: string;
  imageUrl: string;
  mrp: number;
  currentPrice: number;
  effectivePrice: number;
  sellerName: string;
  sellerRating: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  rating: number;
  reviewCount: number;
  couponRequired: boolean;
  couponCode?: string;
  bankOfferRequired: boolean;
  bankOfferDetails?: string;
  specifications: Record<string, string>;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Price Event ──────────────────────────────────────────────

export interface PriceEvent {
  id: string;
  productId: string;
  price: number;
  mrp: number;
  effectivePrice: number;
  previousPrice: number;
  priceChange: number;
  priceChangePct: number;
  sourceTimestamp: string;
  ingestedAt: string;
  platform: Platform;
}

// ─── Price Statistics ─────────────────────────────────────────

export interface PriceStatistics {
  productId: string;
  period: '7d' | '30d' | '90d' | '180d' | '365d';
  median: number;
  mean: number;
  min: number;
  max: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  stddev: number;
  sampleCount: number;
  extremeDiscountCount: number;
  lastExtremeDiscountAt: string | null;
  computedAt: string;
}

// ─── Price History Point ──────────────────────────────────────

export interface PriceHistoryPoint {
  timestamp: string;
  price: number;
  effectivePrice: number;
}

// ─── Score Components ─────────────────────────────────────────

export interface LootScoreComponents {
  historicalDeviation: number;    // 0-100: How far below historical median
  historicalRarity: number;       // 0-100: Percentile rarity in price distribution
  discountVsNormal: number;      // 0-100: Discount vs normal selling price
  discountVsMedian: number;      // 0-100: Discount vs historical median
  discountVsMin: number;         // 0-100: Discount vs historical minimum
  crossPlatformDiff: number;     // 0-100: Price gap vs other platforms
  priceVelocity: number;         // 0-100: Speed of price drop
  sellerReliability: number;     // 0-100: Seller trustworthiness
  stockAvailability: number;     // 0-100: Is it actually available?
  dealFrequencyInverse: number;  // 0-100: How rarely does this product discount?
  sleepingProductBonus: number;  // 0-100: Stable-price product sudden drop
  conditionPenalty: number;      // 0-100 negative: Coupon/bank-offer dependency
  disappearanceProbability: number; // 0-100: Likely to vanish?
  confidenceAdjustment: number;  // 0-1: Scale by data confidence
}

// ─── Deal Event ───────────────────────────────────────────────

export interface DealEvent {
  id: string;
  productId: string;
  product: Product;
  classification: DealClassification;
  lootScore: number;
  rarityScore: number;
  scoreComponents: LootScoreComponents;
  confidence: number;
  confidenceReason: string;
  currentPrice: number;
  normalPrice: number;
  historicalMedian: number;
  historicalLow: number;
  realDiscountPct: number;
  displayedDiscountPct: number;
  detectedAt: string;
  detectionLatencyMs: number;
  isActive: boolean;
  expiresAt: string | null;
  aiVerdict: AIVerdict | null;
  aiReasoning: string | null;
  aiChecks: AICheck[] | null;
  explanations: string[];
  priceHistory: PriceHistoryPoint[];
  statistics: PriceStatistics | null;
  isSleepingProduct: boolean;
  isNeverSeenBefore: boolean;
  priceErrorProbability: number;
  createdAt: string;
}

export interface AICheck {
  check: string;
  passed: boolean;
  detail: string;
}

// ─── Alert ────────────────────────────────────────────────────

export interface Alert {
  id: string;
  dealEventId: string;
  dealEvent: DealEvent;
  priority: AlertPriority;
  channel: 'web' | 'email' | 'push';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'clicked';
  sentAt: string | null;
  readAt: string | null;
  clickedAt: string | null;
  createdAt: string;
}

// ─── System Status ────────────────────────────────────────────

export interface SystemStatus {
  isOnline: boolean;
  uptime: number;
  connectors: ConnectorInfo[];
  metrics: SystemMetrics;
  lastUpdated: string;
}

export interface ConnectorInfo {
  platform: Platform;
  status: ConnectorStatus;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  errorMessage: string | null;
  eventsProcessed: number;
  avgLatencyMs: number;
}

export interface SystemMetrics {
  productsMonitored: number;
  priceEventsProcessed: number;
  anomaliesDetected: number;
  extremeDeals: number;
  loot95Events: number;
  avgProcessingLatencyMs: number;
  avgDetectionLatencyMs: number;
  falsePositiveRate: number;
  trueLootRate: number;
  uptimeHours: number;
}

// ─── User Preferences ─────────────────────────────────────────

export interface UserPreferences {
  categories: string[];
  brands: string[];
  priceMin: number;
  priceMax: number;
  minRealDiscountPct: number;
  platforms: Platform[];
  dealTypes: DealClassification[];
  loot95Only: boolean;
  alertEmail: string;
  alertsEnabled: boolean;
}

// ─── API Response Types ───────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
}

export interface DealFeedResponse {
  deals: DealEvent[];
  total: number;
  hasMore: boolean;
}

// ─── SSE Event Types ──────────────────────────────────────────

export interface SSEEvent {
  type: 'deal' | 'status' | 'alert' | 'heartbeat';
  data: DealEvent | SystemStatus | Alert | { ts: string };
}

// ─── Scoring Configuration ────────────────────────────────────

export interface ScoringConfig {
  weights: {
    historicalDeviation: number;
    historicalRarity: number;
    discountVsNormal: number;
    discountVsMedian: number;
    discountVsMin: number;
    crossPlatformDiff: number;
    priceVelocity: number;
    sellerReliability: number;
    stockAvailability: number;
    dealFrequencyInverse: number;
    sleepingProductBonus: number;
    conditionPenalty: number;
    disappearanceProbability: number;
  };
  thresholds: {
    normal: number;    // 0-30
    great: number;     // 30-50
    hot: number;       // 50-70
    extreme: number;   // 70-85
    loot95: number;    // 85-100
  };
  minimumConfidence: number;
  minimumSampleCount: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    historicalDeviation: 0.20,
    historicalRarity: 0.20,
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
    disappearanceProbability: 0.04,
  },
  thresholds: {
    normal: 30,
    great: 50,
    hot: 65,
    extreme: 80,
    loot95: 90,
  },
  minimumConfidence: 0.3,
  minimumSampleCount: 5,
};
