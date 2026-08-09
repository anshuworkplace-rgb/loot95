// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Deal Card Component
// Displays Deal Anomaly Score breakdown and price history analytics
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import type { DealEvent } from '../../shared/types';
import { formatPrice, formatTimeAgo, getScoreClass } from '../hooks/useApi';

interface DealCardProps {
  deal: DealEvent;
  onSelect: (deal: DealEvent) => void;
}

export const DealCard: React.FC<DealCardProps> = ({ deal, onSelect }) => {
  const {
    product,
    classification,
    lootScore,
    currentPrice,
    normalPrice,
    realDiscountPct,
    displayedDiscountPct,
    detectedAt,
    anomalyMetrics,
    explanations,
  } = deal;

  const scoreClass = getScoreClass(lootScore);

  // Fallback calculations for anomaly metrics if missing
  const anomaly = anomalyMetrics || {
    normalPrice: normalPrice,
    allTimeLow: deal.historicalLow || Math.round(normalPrice * 0.70),
    typicalLowestPrice: deal.historicalLow || Math.round(normalPrice * 0.82),
    currentPrice: currentPrice,
    effectivePrice: deal.effectivePrice || currentPrice,
    isAllTimeLow: deal.isAllTimeLow || false,
    dropVsAveragePct: realDiscountPct,
    savingsVsAverage: deal.savingsVsAverage || 0,
    historicalPercentile: Math.max(0.8, Math.round((1 - realDiscountPct / 100) * 12 * 10) / 10),
    rarityLabel: deal.isAllTimeLow ? 'ALL-TIME LOW' as const : realDiscountPct >= 50 ? 'VERY HIGH' as const : realDiscountPct >= 30 ? 'HIGH' as const : 'MODERATE' as const,
    priceAnomalyScore: Math.min(99, Math.round(55 + realDiscountPct * 0.45)),
    demandLabel: realDiscountPct >= 40 ? 'HIGH' as const : 'NORMAL' as const,
    sellerConfidenceLabel: product.verifiedLive ? 'HIGH' as const : 'MODERATE' as const,
    compositeDealScore: lootScore,
    timeDecayMultiplier: 1.0,
    ageMinutes: deal.ageMinutes || 0,
  };

  return (
    <div className={`deal-card ${classification}`} onClick={() => onSelect(deal)}>
      <div className="deal-card-left">
        <div className="deal-card-top">
          <span className={`deal-badge ${classification}`}>
            {classification.replace('_', ' ')}
          </span>
          {deal.isAllTimeLow && (
            <span style={{
              background: 'linear-gradient(90deg, #06b6d4, #3b82f6)',
              color: '#000',
              fontWeight: 800,
              fontSize: '0.68rem',
              padding: '3px 8px',
              borderRadius: '4px',
              letterSpacing: '0.5px',
              boxShadow: '0 0 10px rgba(6, 182, 212, 0.5)',
            }}>
              🔥 ALL-TIME LOW
            </span>
          )}
          <span className="deal-brand">{product.brand}</span>
          <span className="deal-source-badge" style={{ textTransform: 'uppercase' }}>
            🛒 {product.platform}
          </span>
        </div>

        <div className="deal-title">{product.title}</div>

        <div className="deal-price-row" style={{ flexWrap: 'wrap', gap: '8px', alignItems: 'baseline' }}>
          <span className="deal-current-price">{formatPrice(deal.effectivePrice || currentPrice)}</span>
          {normalPrice > currentPrice && (
            <span className="deal-original-price" title="90-Day Average Selling Price">
              Avg: {formatPrice(normalPrice)}
            </span>
          )}
          {realDiscountPct > 0 ? (
            <span className="deal-discount" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--loot-green)' }}>
              {realDiscountPct}% BELOW AVG PRICE
            </span>
          ) : (
            <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', borderRadius: '4px' }}>
              REGULAR PRICE
            </span>
          )}
          {deal.savingsVsAverage > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--loot-green)', fontWeight: 700 }}>
              (Save {formatPrice(deal.savingsVsAverage)})
            </span>
          )}
          {displayedDiscountPct > realDiscountPct && displayedDiscountPct > 0 && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              ({displayedDiscountPct}% MRP OFF)
            </span>
          )}
        </div>

        {product.instantDiscountAmount > 0 && (
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', marginTop: '2px', fontWeight: 600 }}>
            💳 Bank Offer: Less {formatPrice(product.instantDiscountAmount)} instant checkout discount
          </div>
        )}

        {/* ─── Deal Anomaly Score Panel ──────────────────────────────── */}
        <div className="deal-anomaly-card">
          <div className="anomaly-header">
            <span className="anomaly-title">⚡ REAL DEAL METRIC TRIAD</span>
            <span className="anomaly-score-badge">
              DEAL SCORE: <strong>{anomaly.compositeDealScore.toFixed(1)}/100</strong>
            </span>
          </div>

          <div className="anomaly-table">
            <div className="anomaly-cell">
              <span className="cell-label">90-Day Avg Price</span>
              <span className="cell-value">{formatPrice(anomaly.normalPrice)}</span>
            </div>
            <div className="anomaly-cell">
              <span className="cell-label">All-Time Low (ATL)</span>
              <span className="cell-value highlight-lowest">{formatPrice(anomaly.allTimeLow || anomaly.typicalLowestPrice)}</span>
            </div>
            <div className="anomaly-cell">
              <span className="cell-label">Current Live Price</span>
              <span className="cell-value highlight-current">{formatPrice(anomaly.effectivePrice || anomaly.currentPrice)}</span>
            </div>

            <div className="anomaly-cell">
              <span className="cell-label">Historical Percentile</span>
              <span className="cell-value highlight-percentile">{anomaly.historicalPercentile}%</span>
            </div>
            <div className="anomaly-cell">
              <span className="cell-label">Rarity Metric</span>
              <span className={`rarity-pill rarity-${(anomaly.rarityLabel || 'HIGH').toLowerCase().replace(/\s+/g, '-')}`}>
                {anomaly.rarityLabel}
              </span>
            </div>
            <div className="anomaly-cell">
              <span className="cell-label">Seller Confidence</span>
              <span className="cell-value">{anomaly.sellerConfidenceLabel}</span>
            </div>
          </div>
        </div>

        <div className="deal-meta" style={{ marginTop: '8px' }}>
          <span className="deal-meta-item">
            🏪 {product.sellerName || product.platform}
          </span>
          <span className="deal-meta-item">
            ⭐ {product.rating.toFixed(1)} ({product.reviewCount} reviews)
          </span>
          {product.stockStatus === 'low_stock' && (
            <span className="deal-meta-item" style={{ color: 'var(--accent-orange)' }}>
              ⚠️ Low Stock
            </span>
          )}
        </div>

        {explanations && explanations.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            💡 {explanations[0]}
          </div>
        )}
      </div>

      <div className="deal-card-right">
        <div className="deal-score-group">
          <div className="score-label">DEAL SCORE</div>
          <div>
            <span className={`score-value ${scoreClass}`}>{lootScore.toFixed(1)}</span>
            <span className="score-max">/100</span>
          </div>
        </div>

        <div style={{ textAlign: 'right', marginTop: 'auto' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            ATL LOW: <strong style={{ color: 'var(--accent-cyan)' }}>{formatPrice(anomaly.allTimeLow || anomaly.typicalLowestPrice)}</strong>
          </div>
          <div className="deal-timing">⚡ {formatTimeAgo(detectedAt)}</div>
        </div>
      </div>
    </div>
  );
};

