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

// ─── Preferences View Component ────────────────────────────────

const PreferencesView: React.FC = () => {
  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>PERSONAL DEAL RADAR CONFIGURATION</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
        Configure your private deal intelligence thresholds. The engine will alert you only when deals meet your custom criteria.
      </p>

      <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            MINIMUM REAL DISCOUNT THRESHOLD
          </label>
          <select style={{ width: '100%', padding: '10px', background: 'var(--bg-deep)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}>
            <option value="90">90%+ Real Discount (LOOT 95 Only)</option>
            <option value="80">80%+ Real Discount (Extreme Deals)</option>
            <option value="60">60%+ Real Discount (Hot Deals)</option>
            <option value="50">50%+ Real Discount (All Deals)</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            TARGET CATEGORIES
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {['Electronics', 'Smartphones', 'Laptops', 'Audio & Headphones', 'TVs & Appliances', 'Cameras & Accessories'].map(cat => (
              <label key={cat} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked /> {cat}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            NOTIFICATION CHANNELS
          </label>
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" defaultChecked /> Browser Web Push
            </label>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" defaultChecked /> Email Alerts
            </label>
          </div>
        </div>

        <button style={{ padding: '12px 24px', background: 'var(--loot-green)', color: '#000', border: 'none', fontWeight: 700, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
          SAVE PREFERENCES
        </button>
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
