import React, { useState } from 'react';

interface EmailAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailAlertModal: React.FC<EmailAlertModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('anshuworkplace@gmail.com');
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');

    try {
      const res = await fetch('/api/test/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✅ ${data.message}`);
      } else {
        setStatusMsg(`❌ Error: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMsg(`❌ Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white font-mono text-xl"
        >
          ✕
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-xl">
            📧
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-mono tracking-wide">DIRECT EMAIL ALERTS</h3>
            <p className="text-xs text-emerald-400/80 font-mono">Instant notifications for LOOT 95 events</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed font-mono">
          Get real-time HTML email alerts delivered directly to your inbox whenever LOOT 95 detects a 90–95%+ real discount event.
        </p>

        <form onSubmit={handleTestEmail} className="space-y-4 font-mono">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-email@gmail.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-400 space-y-1">
            <div className="text-slate-300 font-semibold mb-1">⚡ Automatic Email Trigger Rules:</div>
            <div>• Score ≥ 70/100 or Real Discount ≥ 50%</div>
            <div>• Classification: LOOT 95 / EXTREME / PRICE ERROR</div>
            <div>• Includes Direct 1-Click Amazon Buy Link</div>
          </div>

          {statusMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
              {statusMsg}
            </div>
          )}

          <div className="flex space-x-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 px-4 rounded-lg text-xs tracking-wider transition-all disabled:opacity-50"
            >
              {loading ? 'SENDING ALERT...' : '⚡ SEND TEST EMAIL ALERT'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-lg text-xs transition-all"
            >
              CLOSE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
