// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Manual Deal Submission Modal
// Allows the user to paste any e-commerce deal URL or product price
// and immediately evaluate it through the LOOT 95 engine.
// ═══════════════════════════════════════════════════════════════

import React, { useState } from 'react';

interface SubmitDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SubmitDealModal: React.FC<SubmitDealModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [mrp, setMrp] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !mrp || !currentPrice) {
      setError('Please fill in product title, MRP, and current price.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/deals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url || 'https://amazon.in',
          title,
          brand: brand || 'Generic',
          mrp: parseFloat(mrp),
          currentPrice: parseFloat(currentPrice),
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
        setUrl('');
        setTitle('');
        setBrand('');
        setMrp('');
        setCurrentPrice('');
      } else {
        setError(data.error || 'Failed to submit deal.');
      }
    } catch (err: any) {
      setError(err.message || 'Error submitting deal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            ⚡ SUBMIT DEAL FOR AI EVALUATION
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              PRODUCT / DEAL URL
            </label>
            <input
              type="text"
              placeholder="https://amazon.in/dp/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{ width: '100%', padding: '10px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              PRODUCT TITLE *
            </label>
            <input
              type="text"
              placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                BRAND
              </label>
              <input
                type="text"
                placeholder="Sony"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                style={{ width: '100%', padding: '10px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                MRP (₹) *
              </label>
              <input
                type="number"
                placeholder="34990"
                value={mrp}
                onChange={e => setMrp(e.target.value)}
                required
                style={{ width: '100%', padding: '10px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              CURRENT OFFER PRICE (₹) *
            </label>
            <input
              type="number"
              placeholder="4999"
              value={currentPrice}
              onChange={e => setCurrentPrice(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--loot-green)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700 }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ flex: 1, padding: '12px', background: 'var(--loot-green)', border: 'none', color: '#000', fontWeight: 800, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
            >
              {submitting ? 'EVALUATING...' : 'RUN LOOT EVALUATION'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
