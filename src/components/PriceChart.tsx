// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Price Chart Component
// Renders interactive price history with Chart.js
// Shows LOOT Zone, Normal Range, and Historical Low
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { PriceHistoryPoint, PriceStatistics } from '../../shared/types';
import { formatPrice } from '../hooks/useApi';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PriceChartProps {
  history: PriceHistoryPoint[];
  stats?: PriceStatistics | null;
  currentPrice: number;
}

export const PriceChart: React.FC<PriceChartProps> = ({ history, stats, currentPrice }) => {
  if (!history || history.length === 0) {
    return <div className="empty-state">No price history available</div>;
  }

  // Sort history chronologically
  const sorted = [...history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const labels = sorted.map(h => {
    const d = new Date(h.timestamp);
    return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  });

  const prices = sorted.map(h => h.effectivePrice);
  const medianPrice = stats?.median || (prices.reduce((a, b) => a + b, 0) / prices.length);
  const minPrice = stats?.min || Math.min(...prices);

  const data = {
    labels,
    datasets: [
      {
        label: 'Price (₹)',
        data: prices,
        borderColor: '#00ff88',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(0, 255, 136, 0.25)');
          gradient.addColorStop(1, 'rgba(0, 255, 136, 0.0)');
          return gradient;
        },
        borderWidth: 2,
        tension: 0.2,
        pointRadius: prices.map(p => (p === currentPrice ? 6 : 2)),
        pointBackgroundColor: prices.map(p => (p === currentPrice ? '#00ff88' : 'rgba(0, 255, 136, 0.6)')),
        pointHoverRadius: 6,
        fill: true,
      },
      {
        label: 'Historical Median',
        data: new Array(prices.length).fill(medianPrice),
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#9090a8',
          font: { family: 'Inter', size: 11 },
          boxWidth: 12,
        },
      },
      tooltip: {
        backgroundColor: '#141422',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleColor: '#e8e8f0',
        bodyColor: '#00ff88',
        bodyFont: { family: 'JetBrains Mono', weight: 'bold' as const },
        callbacks: {
          label: (context: any) => `Price: ${formatPrice(context.raw)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#606078', font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 8 },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#9090a8',
          font: { family: 'JetBrains Mono', size: 11 },
          callback: (value: any) => '₹' + value.toLocaleString('en-IN'),
        },
      },
    },
  };

  return (
    <div className="chart-container">
      <div style={{ height: '320px', position: 'relative' }}>
        <Line data={data} options={options} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>Hist. Min: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatPrice(minPrice)}</strong></span>
        <span>Hist. Median: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatPrice(medianPrice)}</strong></span>
        <span>Current: <strong style={{ color: 'var(--loot-green)', fontFamily: 'var(--font-mono)' }}>{formatPrice(currentPrice)}</strong></span>
      </div>
    </div>
  );
};
