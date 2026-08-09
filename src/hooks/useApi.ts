// ═══════════════════════════════════════════════════════════════
// LOOT 95 — API + SSE Hooks
// Real-time data streaming and API calls
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import type { DealEvent, SystemStatus } from '../../shared/types';

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

// ─── SSE Hook ─────────────────────────────────────────────────

export function useSSE() {
  const [deals, setDeals] = useState<DealEvent[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const connect = () => {
      const es = new EventSource(`${API_BASE}/api/events`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);

          if (parsed.type === 'deal') {
            setDeals(prev => {
              const exists = prev.find(d => d.id === parsed.data.id);
              if (exists) return prev;
              const updated = [parsed.data, ...prev];
              return updated.slice(0, 100); // Keep last 100
            });
          }

          if (parsed.type === 'status') {
            setStatus(parsed.data);
          }
        } catch (e) {
          // Ignore parse errors (heartbeats, etc.)
        }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return { deals, status, connected };
}

// ─── API Fetch Hook ───────────────────────────────────────────

export function useApi<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`${API_BASE}${path}`)
      .then(r => r.json())
      .then(res => {
        if (!cancelled) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, deps);

  return { data, loading, error };
}

// ─── Fetch Deal Detail ────────────────────────────────────────

export function useDealDetail(id: string | null) {
  return useApi<DealEvent & { allStatistics: unknown[] }>(
    `/api/deals/${id}`,
    [id]
  );
}

// ─── Fetch Deals ──────────────────────────────────────────────

export function useDeals(filter?: string) {
  const queryParams = filter && filter !== 'ALL' ? `?classification=${filter}` : '';
  return useApi<{ deals: DealEvent[]; total: number }>(
    `/api/deals${queryParams}`,
    [filter]
  );
}

// ─── Format Helpers ───────────────────────────────────────────

export function formatPrice(price: number): string {
  return '₹' + price.toLocaleString('en-IN');
}

export function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

export function getScoreColor(score: number): string {
  if (score >= 85) return 'var(--loot-green)';
  if (score >= 65) return 'var(--accent-purple)';
  if (score >= 50) return 'var(--accent-orange)';
  if (score >= 30) return 'var(--accent-blue)';
  return 'var(--text-secondary)';
}

export function getScoreClass(score: number): string {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}
