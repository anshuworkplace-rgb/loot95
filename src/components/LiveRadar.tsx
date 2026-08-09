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

  const JUNK_ACCESSORY_KEYWORDS = [
    'back cover', 'case', 'cover', 'silicon', 'silicone', 'tempered glass', 'screen protector',
    'guard', 'cable', 'adapter', 'charger cable', 'pouch', 'strap', 'skin', 'holder',
    'stand', 'converter', 'lanyard', 'film', 'sleeve', 'keychain', 'tpu'
  ];

  // Read saved user preferences from localStorage
  const savedPrefsRaw = typeof window !== 'undefined' ? localStorage.getItem('loot95_user_prefs') : null;
  const userPrefs = savedPrefsRaw ? JSON.parse(savedPrefsRaw) : null;

  // Filter deals
  const filteredDeals = deals.filter(deal => {
    // IF NO_FILTER TAB IS ACTIVE, BYPASS ALL FILTERS
    if (activeFilter === 'NO_FILTER') {
      return true;
    }

    // Classification filter
    if (activeFilter !== 'ALL' && deal.classification !== activeFilter) {
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

      // Brand Filter
      if (userPrefs.brands) {
        const brandKey = deal.product.brand.toLowerCase();
        if (userPrefs.brands[brandKey] === false) {
          return false;
        }
      }
    }

    return true;
  });

  const categories = ['ALL (NO FILTER)', 'Smartphones', 'Headphones', 'Earbuds', 'Laptops', 'Tablets', 'TVs', 'Cameras', 'Smartwatches', 'Gaming', 'Appliances'];

  return (
    <div className="deal-feed">
      <div className="feed-header">
        <div>
          <h2>LIVE DEAL RADAR</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Real-time feed • Auto-updating via Server-Sent Events
          </span>
        </div>

        <div className="feed-filters">
          {['ALL', 'NO_FILTER', 'LOOT_95', 'EXTREME', 'HOT', 'GREAT'].map(filter => (
            <button
              key={filter}
              className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
              onClick={() => onFilterChange(filter)}
              style={filter === 'NO_FILTER' ? { border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)' } : {}}
            >
              {filter === 'NO_FILTER' ? '🔓 NO FILTER (RAW)' : filter.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary Category Filters */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '8px' }}>
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

      {/* Feed list */}
      {filteredDeals.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📡</div>
          <h3>Scanning for {activeFilter !== 'ALL' ? activeFilter : ''} Deals...</h3>
          <p>The intelligence engine is continuously monitoring Indian e-commerce platforms. High-value deals will appear here in real-time.</p>
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
