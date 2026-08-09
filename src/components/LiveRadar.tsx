// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Live Radar Component
// Main live deal feed dashboard with category & classification filters
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import type { DealEvent } from '../../shared/types';
import { DealCard } from './DealCard';

interface LiveRadarProps {
  deals: DealEvent[];
  onSelectDeal: (deal: DealEvent) => void;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export const LiveRadar: React.FC<LiveRadarProps> = ({
  deals,
  onSelectDeal,
  activeFilter,
  onFilterChange,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'SCORE' | 'ATL' | 'SAVINGS' | 'NEWEST'>('SCORE');

  const JUNK_ACCESSORY_KEYWORDS = [
    'back cover', 'phone case', 'silicone case', 'silicone cover', 'tempered glass',
    'screen protector', 'camera lens protector', 'charging cable', 'cable adapter',
    'pouch case', 'watch strap', 'phone stand', 'screen guard'
  ];

  const savedPrefsRaw = typeof window !== 'undefined' ? localStorage.getItem('loot95_user_prefs') : null;
  const userPrefs = savedPrefsRaw ? JSON.parse(savedPrefsRaw) : null;

  const platforms = [
    { id: 'ALL', label: '🌐 All Stores' },
    { id: 'amazon', label: 'Amazon India' },
    { id: 'flipkart', label: 'Flipkart' },
    { id: 'myntra', label: 'Myntra' },
    { id: 'croma', label: 'Croma' },
    { id: 'reliance_digital', label: 'Reliance Digital' },
    { id: 'ajio', label: 'Ajio' },
    { id: 'tatacliq', label: 'Tata CLiQ' },
    { id: 'nykaa', label: 'Nykaa' },
    { id: 'pepperfry', label: 'Pepperfry' },
  ];

  // Filter deals
  let filteredDeals = deals.filter(deal => {
    // Platform Filter
    if (platformFilter !== 'ALL' && deal.product.platform !== platformFilter) {
      return false;
    }

    // IF NO_FILTER TAB IS ACTIVE, BYPASS ALL FILTERS
    if (activeFilter === 'NO_FILTER') {
      return true;
    }

    // Classification filter
    if (activeFilter === 'ATL_ONLY') {
      if (!deal.isAllTimeLow) return false;
    } else if (activeFilter !== 'ALL' && deal.classification !== activeFilter) {
      return false;
    }

    // Category filter
    if (!categoryFilter.startsWith('ALL') && deal.product.subcategory !== categoryFilter) {
      return false;
    }

    // Apply User Preferences (if set)
    if (userPrefs) {
      const minDiscountVal = parseInt(userPrefs.minDiscount || '0', 10);
      const minPriceVal = parseInt(userPrefs.minPrice || '0', 10);

      // Minimum Discount Filter
      if (minDiscountVal > 0 && deal.realDiscountPct < minDiscountVal) {
        return false;
      }

      // Minimum Price Floor Filter
      if (minPriceVal > 0 && deal.currentPrice < minPriceVal) {
        return false;
      }

      // Anti-Junk Accessory Shield Filter
      if (userPrefs.excludeAccessories) {
        const lowerTitle = deal.product.title.toLowerCase();
        if (JUNK_ACCESSORY_KEYWORDS.some(kw => lowerTitle.includes(kw))) {
          return false;
        }
      }
    }

    return true;
  });

  // Sort deals
  filteredDeals = [...filteredDeals].sort((a, b) => {
    if (sortBy === 'ATL') {
      if (a.isAllTimeLow && !b.isAllTimeLow) return -1;
      if (!a.isAllTimeLow && b.isAllTimeLow) return 1;
      return b.lootScore - a.lootScore;
    } else if (sortBy === 'SAVINGS') {
      return b.savingsVsAverage - a.savingsVsAverage;
    } else if (sortBy === 'NEWEST') {
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    }
    return b.lootScore - a.lootScore;
  });

  const categories = ['ALL (NO FILTER)', 'Smartphones', 'Headphones', 'Earbuds', 'Laptops', 'Tablets', 'TVs', 'Cameras', 'Smartwatches', 'Gaming', 'Appliances'];

  return (
    <div className="deal-feed">
      <div className="feed-header">
        <div>
          <h2>LIVE MULTI-PLATFORM DEAL RADAR</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Direct Intelligence across 7+ Indian Stores • Real-time SSE Stream
          </span>
        </div>

        <div className="feed-filters" style={{ flexWrap: 'wrap', gap: '6px' }}>
          {['ALL', 'ATL_ONLY', 'LOOT_95', 'EXTREME', 'HOT', 'NO_FILTER'].map(filter => (
            <button
              key={filter}
              className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
              onClick={() => onFilterChange(filter)}
              style={filter === 'ATL_ONLY' ? { border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', fontWeight: 800 } : {}}
            >
              {filter === 'ATL_ONLY' ? '🔥 ALL-TIME LOWS' : filter === 'NO_FILTER' ? '🔓 RAW FEED' : filter.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* 7+ Platform Filter Bar */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '8px' }}>
        {platforms.map(p => (
          <button
            key={p.id}
            onClick={() => setPlatformFilter(p.id)}
            style={{
              padding: '6px 12px',
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              borderRadius: 'var(--radius-sm)',
              border: platformFilter === p.id ? '1px solid var(--loot-green)' : '1px solid var(--border-subtle)',
              background: platformFilter === p.id ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
              color: platformFilter === p.id ? 'var(--loot-green)' : 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Secondary Category & Sorting Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: '4px 10px',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-sans)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: categoryFilter === cat ? 'var(--bg-elevated)' : 'transparent',
                color: categoryFilter === cat ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>SORT BY:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
            }}
          >
            <option value="SCORE">⚡ Highest Deal Score</option>
            <option value="ATL">🔥 All-Time Lows First</option>
            <option value="SAVINGS">💰 Max ₹ Saved vs Avg</option>
            <option value="NEWEST">⏱️ Freshness (Newest)</option>
          </select>
        </div>
      </div>

      {/* Feed list */}
      {filteredDeals.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📡</div>
          <h3>Scanning 7+ Platforms for {activeFilter !== 'ALL' ? activeFilter : ''} Deals...</h3>
          <p>The intelligence engine is continuously monitoring Amazon, Flipkart, Myntra, Croma, Reliance Digital, Ajio, Tata CLiQ, Nykaa, and Pepperfry in real-time.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredDeals.map(deal => (
            <DealCard key={deal.id} deal={deal} onSelect={onSelectDeal} />
          ))}
        </div>
      )}
    </div>
  );
};

