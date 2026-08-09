// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Direct Email Alert Service
// Sends instant HTML email notifications when ultra-rare deals occur
// ═══════════════════════════════════════════════════════════════

import nodemailer from 'nodemailer';
import { DealEvent } from '../../shared/types.js';

// Transporter configuration (from .env)
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || '"LOOT 95 Alerts" <alerts@loot95.com>';
export let ALERT_EMAIL_RECIPIENT = process.env.ALERT_EMAIL_RECIPIENT || 'anshuworkplace@gmail.com';

export function setRecipientEmail(email: string) {
  ALERT_EMAIL_RECIPIENT = email;
}

let transporter: nodemailer.Transporter | null = null;

if (SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  console.log(`[Email Alert Service] SMTP configured with account ${SMTP_USER}`);
} else {
  console.log('[Email Alert Service] SMTP_USER/SMTP_PASS not set. Email previews will be logged to console.');
}

export async function sendLoot95EmailAlert(deal: DealEvent, recipientEmail?: string): Promise<boolean> {
  const targetEmail = recipientEmail || ALERT_EMAIL_RECIPIENT;
  if (!targetEmail) {
    console.log('[Email Alert Service] No target email configured.');
    return false;
  }

  const { product, currentPrice, normalPrice, realDiscountPct, lootScore, classification, aiReasoning } = deal;

  const subject = `🚨 LOOT 95 ALERT [Score: ${lootScore}]: ${product.title.substring(0, 45)} (₹${currentPrice.toLocaleString('en-IN')}) — ${realDiscountPct}% REAL OFF!`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; font-family: monospace; }
    .header { background-color: #064e3b; border-bottom: 2px solid #10b981; padding: 20px; text-align: center; }
    .header h1 { color: #10b981; margin: 0; font-size: 24px; letter-spacing: 2px; text-shadow: 0 0 10px rgba(16,185,129,0.5); }
    .header p { color: #a7f3d0; margin: 5px 0 0 0; font-size: 12px; }
    .content { padding: 24px; }
    .badge-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .badge { background: #10b981; color: #000; font-weight: bold; padding: 4px 10px; border-radius: 4px; font-size: 12px; }
    .score { font-size: 28px; font-weight: 800; color: #10b981; }
    .product-title { font-size: 18px; font-weight: 600; color: #ffffff; margin-bottom: 12px; line-height: 1.4; }
    .price-box { background: #1f2937; border-left: 4px solid #10b981; padding: 16px; margin: 16px 0; border-radius: 6px; }
    .current-price { font-size: 32px; font-weight: 800; color: #10b981; margin: 0; }
    .discount-tag { color: #ef4444; font-weight: bold; margin-left: 10px; font-size: 18px; }
    .price-meta { color: #9ca3af; font-size: 13px; margin-top: 6px; }
    .cta-button { display: block; width: 100%; text-align: center; background: #10b981; color: #000000; font-weight: bold; padding: 16px 0; text-decoration: none; border-radius: 8px; font-size: 16px; margin-top: 24px; box-shadow: 0 0 15px rgba(16,185,129,0.4); }
    .footer { padding: 16px; text-align: center; color: #6b7280; font-size: 11px; border-top: 1px solid #1f2937; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 LOOT 95 DETECTED</h1>
      <p>Ultra-Rare Deal Intelligence Alert</p>
    </div>
    <div class="content">
      <div class="badge-container">
        <span class="badge">${classification}</span>
        <span class="score">SCORE ${lootScore}/100</span>
      </div>

      <div class="product-title">${product.title}</div>

      <div class="price-box">
        <span class="current-price">₹${currentPrice.toLocaleString('en-IN')}</span>
        <span class="discount-tag">${realDiscountPct}% REAL OFF</span>
        <div class="price-meta">
          Normal Selling Price: ₹${normalPrice.toLocaleString('en-IN')} | Displayed MRP: ₹${product.mrp.toLocaleString('en-IN')}
        </div>
      </div>

      <p style="color:#d1d5db; font-size:14px; line-height:1.5;">
        <strong>AI Deal Audit:</strong> ${aiReasoning || 'Verified genuine price drop below 30-day historical median.'}
      </p>

      <a href="${product.url}" class="cta-button" target="_blank">⚡ GRAB DEAL NOW ON AMAZON →</a>
    </div>

    <div class="footer">
      LOOT 95 Engine • Automated 24x7 Price Intelligence • Recipient: ${targetEmail}
    </div>
  </div>
</body>
</html>
  `;

  console.log(`\n📧 [Email Alert Triggered] Target: ${targetEmail} | Deal: "${product.title}" @ ₹${currentPrice} (${realDiscountPct}% OFF)`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: ALERT_EMAIL_FROM,
        to: targetEmail,
        subject,
        html: htmlContent,
      });
      console.log(`✅ [Email Sent Successfully] Email delivered to ${targetEmail}`);
      return true;
    } catch (err: any) {
      console.error(`❌ [Email Delivery Failed]:`, err.message);
      return false;
    }
  } else {
    console.log(`ℹ️ [Email Simulation] Set SMTP_USER and SMTP_PASS in .env to send real inbox emails via Gmail/SendGrid/Resend.`);
    return true;
  }
}
