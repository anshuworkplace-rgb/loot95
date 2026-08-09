// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Telemetry StatsBar Component
// Displays live system statistics and anomaly metrics
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import type { SystemMetrics } from '../../shared/types';
import { formatNumber } from '../hooks/useApi';

interface StatsBarProps {
  metrics: SystemMetrics | undefined;
  isOnline: boolean;
}

export const StatsBar: React.FC<StatsBarProps> = ({ metrics, isOnline }) => {
  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-label">SYSTEM STATUS</div>
        <div className="stat-value green" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="status-dot" style={{ background: isOnline ? 'var(--status-online)' : 'var(--status-offline)' }} />
          {isOnline ? 'ONLINE ● HUNTING' : 'OFFLINE'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">MONITORED PRODUCTS</div>
        <div className="stat-value blue">
          {metrics ? formatNumber(metrics.productsMonitored) : '—'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">EVENTS PROCESSED</div>
        <div className="stat-value">
          {metrics ? formatNumber(metrics.priceEventsProcessed) : '—'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">ANOMALIES DETECTED</div>
        <div className="stat-value orange">
          {metrics ? formatNumber(metrics.anomaliesDetected) : '—'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">EXTREME DEALS</div>
        <div className="stat-value purple">
          {metrics ? formatNumber(metrics.extremeDeals) : '—'}
        </div>
      </div>

      <div className="stat-card" style={{ borderColor: 'rgba(0, 255, 136, 0.2)' }}>
        <div className="stat-label" style={{ color: 'var(--loot-green)' }}>LOOT 95 EVENTS</div>
        <div className="stat-value green">
          {metrics ? metrics.loot95Events : '—'}
        </div>
      </div>
    </div>
  );
};
