// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Deal Card Component
// Renders single deal event with Loot Score & classification styling
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import type { DealEvent } from '../../shared/types';
import { formatPrice, formatTimeAgo, getScoreClass } from '../hooks/useApi';

interface DealCardProps {
  deal: DealEvent;
  onSelect: (deal: DealEvent) => void;
}

export const DealCard: React.FC<DealCardProps> = ({ deal, onSelect }) => {
  const { product, classification, lootScore, rarityScore, currentPrice, normalPrice, realDiscountPct, displayedDiscountPct, detectedAt, explanations } = deal;

  const scoreClass = getScoreClass(lootScore);

  return (
    <div className={`deal-card ${classification}`} onClick={() => onSelect(deal)}>
      <div className="deal-card-left">
        <div className="deal-card-top">
          <span className={`deal-badge ${classification}`}>
            {classification.replace('_', ' ')}
          </span>
          {product.platform === 'simulator' && (
            <span className="deal-sim-tag">SIMULATED DATA</span>
          )}
          <span className="deal-brand">{product.brand}</span>
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

        <div className="deal-meta">
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
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            💡 {explanations[0]}
          </div>
        )}
      </div>

      <div className="deal-card-right">
        <div className="deal-score-group">
          <div className="score-label">LOOT SCORE</div>
          <div>
            <span className={`score-value ${scoreClass}`}>{lootScore.toFixed(1)}</span>
            <span className="score-max">/100</span>
          </div>
        </div>

        <div style={{ textAlign: 'right', marginTop: 'auto' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            RARITY: <strong style={{ color: 'var(--accent-purple)' }}>{rarityScore.toFixed(1)}</strong>
          </div>
          <div className="deal-timing">⚡ {formatTimeAgo(detectedAt)}</div>
        </div>
      </div>
    </div>
  );
};
