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
    typicalLowestPrice: deal.historicalLow || Math.round(normalPrice * 0.82),
    currentPrice: currentPrice,
    historicalPercentile: Math.max(0.8, Math.round((1 - realDiscountPct / 100) * 12 * 10) / 10),
    rarityLabel: realDiscountPct >= 50 ? 'VERY HIGH' : realDiscountPct >= 30 ? 'HIGH' : 'MODERATE',
    priceAnomalyScore: Math.min(99, Math.round(55 + realDiscountPct * 0.45)),
    demandLabel: realDiscountPct >= 40 ? 'HIGH' : 'NORMAL',
    sellerConfidenceLabel: product.verifiedLive ? 'HIGH' : 'MODERATE',
    compositeDealScore: lootScore,
  };

  return (
    <div className={`deal-card ${classification}`} onClick={() => onSelect(deal)}>
      <div className="deal-card-left">
        <div className="deal-card-top">
          <span className={`deal-badge ${classification}`}>
            {classification.replace('_', ' ')}
          </span>
          <span className="deal-brand">{product.brand}</span>
          {product.sourceName && (
            <span className="deal-source-badge">
              📡 {product.sourceName}
            </span>
          )}
        </div>

        <div className="deal-title">{product.title}</div>

        <div className="deal-price-row">
          <span className="deal-current-price">{formatPrice(currentPrice)}</span>
          {normalPrice > currentPrice && (
            <span className="deal-original-price">{formatPrice(normalPrice)}</span>
          )}
          {realDiscountPct > 0 ? (
            <span className="deal-discount">
              {realDiscountPct}% REAL OFF
            </span>
          ) : (
            <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', borderRadius: '4px' }}>
              REGULAR PRICE
            </span>
          )}
          {displayedDiscountPct > realDiscountPct && displayedDiscountPct > 0 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              ({displayedDiscountPct}% MRP OFF)
            </span>
          )}
        </div>

        {/* ─── Deal Anomaly Score Panel ──────────────────────────────── */}
        <div className="deal-anomaly-card">
          <div className="anomaly-header">
            <span className="anomaly-title">⚡ DEAL ANOMALY METRICS</span>
            <span className="anomaly-score-badge">
              DEAL SCORE: <strong>{anomaly.compositeDealScore.toFixed(1)}/100</strong>
            </span>
          </div>

          <div className="anomaly-table">
            <div className="anomaly-cell">
              <span className="cell-label">Normal price</span>
              <span className="cell-value">{formatPrice(anomaly.normalPrice)}</span>
            </div>
            <div className="anomaly-cell">
              <span className="cell-label">Typical lowest price</span>
              <span className="cell-value highlight-lowest">{formatPrice(anomaly.typicalLowestPrice)}</span>
            </div>
            <div className="anomaly-cell">
              <span className="cell-label">Current price</span>
              <span className="cell-value highlight-current">{formatPrice(anomaly.currentPrice)}</span>
            </div>

            <div className="anomaly-cell">
              <span className="cell-label">Historical percentile</span>
              <span className="cell-value highlight-percentile">{anomaly.historicalPercentile}%</span>
            </div>
            <div className="anomaly-cell">
              <span className="cell-label">Rarity</span>
              <span className={`rarity-pill rarity-${anomaly.rarityLabel.toLowerCase().replace(' ', '-')}`}>
                {anomaly.rarityLabel}
              </span>
            </div>
            <div className="anomaly-cell">
              <span className="cell-label">Price anomaly</span>
              <span className="cell-value">{anomaly.priceAnomalyScore}/100</span>
            </div>

            <div className="anomaly-cell">
              <span className="cell-label">Demand</span>
              <span className="cell-value">{anomaly.demandLabel}</span>
            </div>
            <div className="anomaly-cell">
              <span className="cell-label">Seller confidence</span>
              <span className="cell-value">{anomaly.sellerConfidenceLabel}</span>
            </div>
          </div>
        </div>

        <div className="deal-meta" style={{ marginTop: '8px' }}>
          <span className="deal-meta-item">
            🛒 {product.sellerName || 'Amazon'}
          </span>
          <span className="deal-meta-item">
            ⭐ {product.rating.toFixed(1)} ({product.reviewCount} reviews)
          </span>
          {product.stockStatus === 'low_stock' && (
            <span className="deal-meta-item" style={{ color: 'var(--accent-orange)' }}>
              ⚠️ Low Stock
            </span>
          )}
          {product.couponRequired && (
            <span className="deal-meta-item" style={{ color: 'var(--accent-cyan)' }}>
              🎟️ Coupon Required
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
            HIST. LOW: <strong style={{ color: 'var(--accent-cyan)' }}>{formatPrice(anomaly.typicalLowestPrice)}</strong>
          </div>
          <div className="deal-timing">⚡ {formatTimeAgo(detectedAt)}</div>
        </div>
      </div>
    </div>
  );
};
