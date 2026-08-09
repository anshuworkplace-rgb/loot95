// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Deal Detail Component
// Comprehensive deal inspection page with AI reasoning & history
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import type { DealEvent } from '../../shared/types';
import { PriceChart } from './PriceChart';
import { formatPrice, formatTimeAgo, getScoreClass } from '../hooks/useApi';

interface DealDetailProps {
  deal: DealEvent;
  onBack: () => void;
}

export const DealDetail: React.FC<DealDetailProps> = ({ deal, onBack }) => {
  const {
    product, classification, lootScore, rarityScore, scoreComponents,
    currentPrice, normalPrice, historicalMedian, historicalLow,
    realDiscountPct, detectedAt, explanations,
    priceHistory, statistics, confidence, confidenceReason,
    isSleepingProduct, isNeverSeenBefore
  } = deal;

  const scoreClass = getScoreClass(lootScore);

  return (
    <div className="deal-detail">
      <button className="detail-back" onClick={onBack}>
        ← BACK TO RADAR
      </button>

      {/* Header */}
      <div className="detail-header">
        <div className="detail-price-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`deal-badge ${classification}`}>
              {classification.replace('_', ' ')}
            </span>
            {isSleepingProduct && (
              <span className="deal-badge HOT">💤 SLEEPING PRODUCT ACTIVATED</span>
            )}
            {isNeverSeenBefore && (
              <span className="deal-badge EXTREME">🌟 RECORD LOW PRICE</span>
            )}
          </div>

          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {product.title}
          </h1>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
            <span className="detail-price-big">{formatPrice(currentPrice)}</span>
            <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', textDecoration: 'line-through', fontFamily: 'var(--font-mono)' }}>
              {formatPrice(normalPrice)}
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
              {realDiscountPct}% REAL DISCOUNT
            </span>
          </div>

          <div className="detail-price-compare">
            <div className="price-compare-item">
              <div className="pc-label">MRP</div>
              <div className="pc-value">{formatPrice(product.mrp)}</div>
            </div>
            <div className="price-compare-item">
              <div className="pc-label">Historical Median</div>
              <div className="pc-value">{formatPrice(historicalMedian)}</div>
            </div>
            <div className="price-compare-item">
              <div className="pc-label">Historical Low</div>
              <div className="pc-value">{formatPrice(historicalLow)}</div>
            </div>
            <div className="price-compare-item">
              <div className="pc-label">Seller</div>
              <div className="pc-value">{product.sellerName || 'Amazon'}</div>
            </div>
          </div>
        </div>

        <div className="detail-scores">
          <div className="detail-score-box">
            <div className="dsb-label">LOOT SCORE</div>
            <div className={`dsb-value ${scoreClass}`}>{lootScore.toFixed(1)}</div>
            <div className="dsb-max">/100</div>
          </div>
          <div className="detail-score-box">
            <div className="dsb-label">RARITY</div>
            <div className="dsb-value" style={{ color: 'var(--accent-purple)' }}>{rarityScore.toFixed(1)}</div>
            <div className="dsb-max">/100</div>
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div style={{ marginBottom: '32px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '14px 28px',
            background: 'var(--loot-green)',
            color: '#000',
            fontWeight: 800,
            fontSize: '1rem',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '1px',
            boxShadow: '0 0 20px var(--loot-green-glow)',
            display: 'inline-block',
          }}
        >
          ⚡ GRAB DEAL ON {product.platform.toUpperCase()} →
        </a>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Detected {formatTimeAgo(detectedAt)} • Latency: {deal.detectionLatencyMs}ms
        </span>
      </div>

      {/* AI Explanation / Why Flagged */}
      <div className="detail-section">
        <h3>WHY WE FLAGGED THIS DEAL</h3>
        <div className="explanation-list">
          {explanations.map((exp, idx) => (
            <div key={idx} className="explanation-item">
              <span className="explanation-bullet">✓</span>
              <span>{exp}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          AI Evidence Confidence: <strong>{Math.round(confidence * 100)}%</strong> — {confidenceReason}
        </div>
      </div>

      {/* Price Chart */}
      <div className="detail-section">
        <h3>HISTORICAL PRICE TRACKING</h3>
        <PriceChart history={priceHistory} stats={statistics} currentPrice={currentPrice} />
      </div>

      {/* Score Components Breakdown */}
      <div className="detail-section">
        <h3>LOOT INTELLIGENCE SCORE BREAKDOWN</h3>
        <div className="score-breakdown">
          <ScoreComponentRow name="Historical Low Gap (ATL Bonus)" value={scoreComponents.historicalLowGap} />
          <ScoreComponentRow name="Drop vs 90-Day Average Price" value={scoreComponents.dropVsAverage} />
          <ScoreComponentRow name="Historical Rarity Index" value={scoreComponents.historicalRarity} />
          <ScoreComponentRow name="Price Drop Velocity" value={scoreComponents.priceVelocity} />
          <ScoreComponentRow name="Seller Trust & Quality Score" value={scoreComponents.sellerTrustScore} />
          <ScoreComponentRow name="Bank & Coupon Instant Discount Bonus" value={scoreComponents.bankOfferBonus} />
          <ScoreComponentRow name="Stock Availability" value={scoreComponents.stockAvailability} />
          {scoreComponents.sleepingProductBonus > 0 && (
            <ScoreComponentRow name="Sleeping Product Bonus" value={scoreComponents.sleepingProductBonus} color="var(--loot-green)" />
          )}
        </div>
      </div>
    </div>
  );
};

const ScoreComponentRow: React.FC<{ name: string; value: number; color?: string }> = ({ name, value, color }) => (
  <div className="score-component">
    <span className="score-component-name">{name}</span>
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span className="score-component-value" style={{ color: color || 'var(--text-primary)' }}>
        {value.toFixed(1)}
      </span>
      <div className="score-component-bar">
        <div
          className="score-component-fill"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color || undefined }}
        />
      </div>
    </div>
  </div>
);
