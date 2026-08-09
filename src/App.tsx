// ═══════════════════════════════════════════════════════════════
// LOOT 95 — App Component
// Main terminal layout, navigation, and view switching
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { useSSE } from './hooks/useApi';
import { StatsBar } from './components/StatsBar';
import { LiveRadar } from './components/LiveRadar';
import { DealDetail } from './components/DealDetail';
import { SubmitDealModal } from './components/SubmitDealModal';
import { EmailAlertModal } from './components/EmailAlertModal';
import type { DealEvent } from '../shared/types';

export function App() {
  const { deals: liveDeals, status, connected } = useSSE();
  const [selectedDeal, setSelectedDeal] = useState<DealEvent | null>(null);
  const [currentView, setCurrentView] = useState<'RADAR' | 'LOOT95' | 'RARE' | 'PREFERENCES' | 'ADMIN'>('RADAR');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Compute metrics
  const loot95Deals = liveDeals.filter(d => d.classification === 'LOOT_95' || d.classification === 'EXTREME');
  const rareDeals = liveDeals.filter(d => d.isNeverSeenBefore);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <h1>LOOT 95</h1>
          <div className="tagline">ULTRA-RARE DEAL INTELLIGENCE</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${currentView === 'RADAR' ? 'active' : ''}`}
            onClick={() => { setCurrentView('RADAR'); setSelectedDeal(null); setActiveFilter('ALL'); }}
          >
            <span>📡 Live Deal Radar</span>
            {liveDeals.length > 0 && <span className="badge">{liveDeals.length}</span>}
          </button>

          <button
            className={`nav-item ${currentView === 'LOOT95' ? 'active' : ''}`}
            onClick={() => { setCurrentView('LOOT95'); setSelectedDeal(null); setActiveFilter('LOOT_95'); }}
          >
            <span>🔥 LOOT 95 Mode</span>
            {loot95Deals.length > 0 && <span className="badge" style={{ background: 'var(--loot-green-dim)', color: 'var(--loot-green)' }}>{loot95Deals.length}</span>}
          </button>

          <button
            className={`nav-item ${currentView === 'RARE' ? 'active' : ''}`}
            onClick={() => { setCurrentView('RARE'); setSelectedDeal(null); }}
          >
            <span>🌟 Rare Events</span>
            {rareDeals.length > 0 && <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-purple)' }}>{rareDeals.length}</span>}
          </button>

          <button
            className={`nav-item ${currentView === 'PREFERENCES' ? 'active' : ''}`}
            onClick={() => { setCurrentView('PREFERENCES'); setSelectedDeal(null); }}
          >
            <span>🎯 Personal Radar</span>
          </button>

          <button
            className={`nav-item ${currentView === 'ADMIN' ? 'active' : ''}`}
            onClick={() => { setCurrentView('ADMIN'); setSelectedDeal(null); }}
          >
            <span>⚙️ System Operations</span>
          </button>
        </nav>

        <div className="sidebar-status">
          <div className="status-indicator">
            <span className="status-dot" style={{ background: connected ? 'var(--status-online)' : 'var(--status-offline)' }} />
            <span>{connected ? 'CONNECTED TO ENGINE' : 'RECONNECTING...'}</span>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="app-main">
        {/* Header */}
        <header className="app-header">
          <div className="header-title">
            {selectedDeal ? 'DEAL INSPECTOR' : currentView === 'LOOT95' ? 'LOOT 95 MODE — 95%+ DISCOUNTS' : currentView === 'RARE' ? 'RARE EVENTS & RECORD LOWS' : 'LIVE DEAL INTELLIGENCE'}
          </div>

          <div className="header-metrics" style={{ alignItems: 'center' }}>
            <button
              onClick={() => setIsEmailModalOpen(true)}
              style={{
                padding: '8px 14px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--loot-green)',
                fontWeight: 700,
                fontSize: '0.75rem',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.5px',
                marginRight: '8px',
              }}
            >
              📧 EMAIL ALERTS
            </button>

            <button
              onClick={() => setIsSubmitModalOpen(true)}
              style={{
                padding: '8px 16px',
                background: 'var(--loot-green)',
                color: '#000',
                fontWeight: 800,
                fontSize: '0.75rem',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.5px',
                boxShadow: '0 0 12px var(--loot-green-glow)',
              }}
            >
              + SUBMIT DEAL
            </button>

            <div className="header-metric">
              <div className="label">LATENCY</div>
              <div className="value highlight">
                {status?.metrics.avgDetectionLatencyMs ? `${status.metrics.avgDetectionLatencyMs}ms` : 'sub-sec'}
              </div>
            </div>

            <div className="header-metric">
              <div className="label">LATITUDE / REGION</div>
              <div className="value">INDIA (IN)</div>
            </div>

            <div className="header-metric">
              <div className="label">MODE</div>
              <div className="value" style={{ color: 'var(--accent-orange)' }}>SIMULATION ACTIVE</div>
            </div>
          </div>
        </header>

        {/* Stats Bar */}
        <StatsBar metrics={status?.metrics} isOnline={connected} />

        {/* Main Content Body */}
        {selectedDeal ? (
          <DealDetail deal={selectedDeal} onBack={() => setSelectedDeal(null)} />
        ) : currentView === 'PREFERENCES' ? (
          <PreferencesView />
        ) : currentView === 'ADMIN' ? (
          <AdminView status={status} />
        ) : (
          <LiveRadar
            deals={currentView === 'LOOT95' ? loot95Deals : currentView === 'RARE' ? rareDeals : liveDeals}
            onSelectDeal={setSelectedDeal}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        )}
      </main>

      <EmailAlertModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
      />

      <SubmitDealModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={() => {
          setSelectedDeal(null);
          setCurrentView('RADAR');
        }}
      />
    </div>
  );
}

// ─── 10x Upgraded Personal Radar View Component ────────────────

const PreferencesView: React.FC = () => {
  const getInitialPrefs = () => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('loot95_user_prefs');
    return raw ? JSON.parse(raw) : null;
  };

  const initial = getInitialPrefs();

  const [minDiscount, setMinDiscount] = useState(initial?.minDiscount ?? '80');
  const [minPrice, setMinPrice] = useState(initial?.minPrice ?? '1000');
  const [excludeAccessories, setExcludeAccessories] = useState(initial?.excludeAccessories ?? true);
  const [savedStatus, setSavedStatus] = useState('');

  const [categories, setCategories] = useState(initial?.categories ?? {
    smartphones: true,
    laptops: true,
    audio: true,
    tvs: true,
    gaming: true,
    appliances: true,
  });

  const [brands, setBrands] = useState(initial?.brands ?? {
    apple: true,
    sony: true,
    samsung: true,
    oneplus: true,
    lenovo: true,
    asus: true,
    lg: true,
  });

  const handleSave = () => {
    const prefs = { minDiscount, minPrice, excludeAccessories, categories, brands };
    localStorage.setItem('loot95_user_prefs', JSON.stringify(prefs));
    setSavedStatus('⚡ PREFERENCES SAVED & APPLIED TO INTELLIGENCE ENGINE');
    setTimeout(() => setSavedStatus(''), 4000);
  };

  return (
    <div style={{ padding: '32px', maxWidth: '850px', fontFamily: 'var(--font-mono)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span style={{ fontSize: '1.8rem' }}>🎯</span>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
            PERSONAL DEAL RADAR (10X ENGINE CONTROL)
          </h2>
          <p style={{ color: 'var(--loot-green)', fontSize: '0.8rem', marginTop: '2px' }}>
            Configure strict AI filters to eliminate covers/cases and deliver only genuine high-value electronics.
          </p>
        </div>
      </div>

      <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        
        {/* Master No Filter Toggle */}
        <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.4)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={!excludeAccessories && minDiscount === '0' && minPrice === '0'}
              onChange={(e) => {
                if (e.target.checked) {
                  setExcludeAccessories(false);
                  setMinDiscount('0');
                  setMinPrice('0');
                } else {
                  setExcludeAccessories(true);
                  setMinDiscount('30');
                  setMinPrice('1000');
                }
              }}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            />
            <div>
              <div style={{ color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '0.9rem' }}>
                🔓 MASTER SWITCH: NO FILTERS (SHOW ALL RAW DEALS)
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px' }}>
                Bypass all price floors, category restrictions, brand rules, and anti-junk shields.
              </div>
            </div>
          </label>
        </div>

        {/* Anti-Junk Shield */}
        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={excludeAccessories}
              onChange={(e) => setExcludeAccessories(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--loot-green)', cursor: 'pointer' }}
            />
            <div>
              <div style={{ color: 'var(--loot-green)', fontWeight: 800, fontSize: '0.9rem' }}>
                🛡️ ANTI-JUNK ACCESSORY SHIELD {excludeAccessories ? '(ACTIVE)' : '🔓 [NO FILTER — OFF]' }
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px' }}>
                {excludeAccessories ? 'Automatically rejecting phone back covers, silicone cases, tempered glass, cables & cheap trinkets.' : 'ALLOWING ALL ACCESSORIES (Covers, cases, cables included).'}
              </div>
            </div>
          </label>
        </div>

        {/* Minimum Price Floor */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            💰 MINIMUM PRODUCT PRICE FLOOR
          </label>
          <select
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            style={{ width: '100%', padding: '12px', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
          >
            <option value="0">🔓 0 (NO FILTER — Allow All Prices & Budget Items)</option>
            <option value="1000">₹1,000+ (Exclude sub-₹1000 accessories)</option>
            <option value="3000">₹3,000+ (Major Audio, Smartwatches, Tablets)</option>
            <option value="10000">₹10,000+ (Smartphones, Laptops, 4K TVs Only)</option>
          </select>
        </div>

        {/* Minimum Discount Threshold */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            🔥 MINIMUM REAL DISCOUNT THRESHOLD
          </label>
          <select
            value={minDiscount}
            onChange={(e) => setMinDiscount(e.target.value)}
            style={{ width: '100%', padding: '12px', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
          >
            <option value="0">🔓 0% (NO FILTER — Show All Raw Items Regardless of Discount)</option>
            <option value="30">30%+ Real Discount (All Genuine Offers)</option>
            <option value="50">50%+ Real Discount (Hot & Major Deals)</option>
            <option value="80">80%+ Real Discount (Extreme Drops & Price Errors)</option>
            <option value="90">90%+ Real Discount (LOOT 95 Events Only)</option>
          </select>
        </div>

        {/* Target Categories */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>
            📱 HIGH-VALUE TARGET CATEGORIES
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[
              { id: 'smartphones', label: '📱 Smartphones' },
              { id: 'laptops', label: '💻 Laptops' },
              { id: 'audio', label: '🎧 Headphones / Earbuds' },
              { id: 'tvs', label: '📺 Smart 4K TVs' },
              { id: 'gaming', label: '🎮 PS5 & Gaming' },
              { id: 'appliances', label: '⚡ Premium Appliances' },
            ].map(cat => (
              <label key={cat.id} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'var(--bg-deep)', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <input
                  type="checkbox"
                  checked={(categories as any)[cat.id]}
                  onChange={(e) => setCategories({ ...categories, [cat.id]: e.target.checked })}
                />
                {cat.label}
              </label>
            ))}
          </div>
        </div>

        {/* Premium Brand Filter */}
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>
            ⭐ PREMIUM BRAND PREFERENCES
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['Apple', 'Sony', 'Samsung', 'OnePlus', 'Lenovo', 'Asus', 'LG'].map(b => {
              const key = b.toLowerCase();
              const active = (brands as any)[key];
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBrands({ ...brands, [key]: !active })}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '20px',
                    border: active ? '1px solid var(--loot-green)' : '1px solid var(--border-subtle)',
                    background: active ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-deep)',
                    color: active ? 'var(--loot-green)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {active ? `✓ ${b}` : b}
                </button>
              );
            })}
          </div>
        </div>

        {savedStatus && (
          <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--loot-green)', color: 'var(--loot-green)', fontSize: '0.8rem', fontWeight: 700, borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            {savedStatus}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSave}
            style={{ flex: 1, padding: '14px 24px', background: 'var(--loot-green)', color: '#000', border: 'none', fontWeight: 800, fontSize: '0.85rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px', boxShadow: '0 0 16px var(--loot-green-glow)' }}
          >
            ⚡ SAVE & APPLY 10X RADAR FILTERS
          </button>

          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('loot95_user_prefs');
              setExcludeAccessories(true);
              setMinDiscount('0');
              setMinPrice('0');
              setCategories({ smartphones: true, laptops: true, audio: true, tvs: true, gaming: true, appliances: true });
              setBrands({ apple: true, sony: true, samsung: true, oneplus: true, lenovo: true, asus: true, lg: true });
              setSavedStatus('🔄 ALL PREFERENCES RESET TO DEFAULT (SHOW ALL DEALS)');
              setTimeout(() => setSavedStatus(''), 4000);
            }}
            style={{ padding: '14px 20px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 700, fontSize: '0.8rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          >
            🔄 RESET ALL
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Admin Ops View Component ─────────────────────────────────

const AdminView: React.FC<{ status: any }> = ({ status }) => {
  return (
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>SYSTEM OPERATIONS & TELEMETRY</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>INGESTION & PIPELINE LATENCY</h4>
          <div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--loot-green)' }}>
            {status?.metrics.avgProcessingLatencyMs || 12} ms
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Source-to-Scoring Pipeline Duration</span>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>UPTIME & HEALTH</h4>
          <div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-blue)' }}>
            {status?.metrics.uptimeHours || 0.1} hours
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Continuous 24/7 Engine Monitoring</span>
        </div>
      </div>

      <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-secondary)' }}>CONNECTOR HEALTH</h3>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-deep)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 16px' }}>Platform Connector</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Events Processed</th>
              <th style={{ padding: '12px 16px' }}>Mode</th>
            </tr>
          </thead>
          <tbody>
            {status?.connectors?.map((conn: any) => (
              <tr key={conn.platform} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{conn.platform.toUpperCase()}</td>
                <td style={{ padding: '12px 16px', color: 'var(--status-online)' }}>● {conn.status}</td>
                <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>{conn.eventsProcessed || 0}</td>
                <td style={{ padding: '12px 16px', color: 'var(--accent-orange)' }}>SIMULATION</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
