// ═══════════════════════════════════════════════════════════════
// LOOT 95 — AI Deal Judge (Gemini API Integration)
// Performs automated sanity checks, fake discount detection,
// seller credibility audit, and generates natural explanations.
// ═══════════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import { Product, DealEvent, AIVerdict, AICheck } from '../../shared/types.js';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface AIJudgeOutput {
  verdict: AIVerdict;
  confidencePct: number;
  reasoning: string;
  checks: AICheck[];
}

export async function judgeDeal(deal: DealEvent): Promise<AIJudgeOutput> {
  const { product, currentPrice, normalPrice, realDiscountPct, displayedDiscountPct, scoreComponents } = deal;

  // Rule-based fallback if no GEMINI_API_KEY is provided
  if (!ai) {
    return runRuleBasedJudge(deal);
  }

  try {
    const prompt = `
You are the AI Deal Judge for LOOT 95, an elite deal-hunting intelligence system.
Analyze this pricing event and determine if it is a genuine, ultra-rare deal or a fake/suspicious listing.

Product Details:
- Title: ${product.title}
- Brand: ${product.brand}
- Category: ${product.category} / ${product.subcategory}
- Current Price: ₹${currentPrice.toLocaleString('en-IN')}
- Estimated Normal Market Price: ₹${normalPrice.toLocaleString('en-IN')}
- Displayed MRP: ₹${product.mrp.toLocaleString('en-IN')}
- Real Economic Discount: ${realDiscountPct}%
- Displayed MRP Discount: ${displayedDiscountPct}%
- Seller Name: ${product.sellerName} (Rating: ${product.sellerRating}/5)
- Stock Status: ${product.stockStatus}
- Coupon Required: ${product.couponRequired ? 'Yes' : 'No'}
- Bank Offer Required: ${product.bankOfferRequired ? 'Yes' : 'No'}
- Historical Price Deviation (Z-score component): ${scoreComponents.historicalDeviation}/100
- Price Rarity Score: ${scoreComponents.historicalRarity}/100

Respond strictly with a JSON object in this format:
{
  "verdict": "VERIFIED_LOOT" | "PROBABLE_LOOT" | "PRICE_ANOMALY" | "POSSIBLE_PRICE_ERROR" | "NORMAL_DEAL" | "FALSE_DEAL",
  "confidencePct": number (0-100),
  "reasoning": "Concise 1-2 sentence explanation of the verdict.",
  "checks": [
    { "check": "Genuine Discount", "passed": boolean, "detail": "explanation" },
    { "check": "MRP Authenticity", "passed": boolean, "detail": "explanation" },
    { "check": "Seller Reliability", "passed": boolean, "detail": "explanation" },
    { "check": "Condition Dependencies", "passed": boolean, "detail": "explanation" }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        verdict: parsed.verdict || 'PROBABLE_LOOT',
        confidencePct: parsed.confidencePct || 85,
        reasoning: parsed.reasoning || 'Verified by Gemini AI engine.',
        checks: parsed.checks || [],
      };
    }
  } catch (error) {
    console.error('[AI Deal Judge] Gemini API error, using rule-based judge:', error);
  }

  return runRuleBasedJudge(deal);
}

// Deterministic rule-based judge when API key is unavailable or fails
function runRuleBasedJudge(deal: DealEvent): AIJudgeOutput {
  const { product, currentPrice, normalPrice, realDiscountPct, displayedDiscountPct, scoreComponents } = deal;

  const checks: AICheck[] = [];

  // Check 1: Genuine Discount
  const isGenuine = realDiscountPct >= 50;
  checks.push({
    check: 'Genuine Economic Discount',
    passed: isGenuine,
    detail: isGenuine
      ? `Real price is ${realDiscountPct}% below historical median (₹${normalPrice.toLocaleString('en-IN')}).`
      : `Discount is mostly relative to inflated MRP, not real selling price.`,
  });

  // Check 2: MRP Inflation Check
  const mrpInflationRatio = product.mrp / Math.max(1, normalPrice);
  const mprOk = mrpInflationRatio <= 1.8;
  checks.push({
    check: 'MRP Inflation Verification',
    passed: mprOk,
    detail: mprOk
      ? `MRP (₹${product.mrp.toLocaleString('en-IN')}) is within reasonable ratio of normal market price.`
      : `MRP appears artificially inflated to make discount look larger.`,
  });

  // Check 3: Seller Reliability
  const sellerOk = product.sellerRating >= 3.5;
  checks.push({
    check: 'Seller Reliability Audit',
    passed: sellerOk,
    detail: sellerOk
      ? `Seller "${product.sellerName}" has acceptable rating (${product.sellerRating}/5).`
      : `Seller rating is below standard threshold. Exercise caution.`,
  });

  // Check 4: Condition Dependencies
  const noStringsAttached = !product.couponRequired && !product.bankOfferRequired;
  checks.push({
    check: 'No Conditional Friction',
    passed: noStringsAttached,
    detail: noStringsAttached
      ? `Direct price drop — no coupons or credit card offers required.`
      : `Price depends on conditional offers or coupons.`,
  });

  let verdict: AIVerdict = 'NORMAL_DEAL';
  if (deal.lootScore >= 85 && realDiscountPct >= 75) {
    verdict = 'VERIFIED_LOOT';
  } else if (deal.lootScore >= 70) {
    verdict = 'PROBABLE_LOOT';
  } else if (deal.priceErrorProbability > 70) {
    verdict = 'POSSIBLE_PRICE_ERROR';
  } else if (deal.lootScore >= 50) {
    verdict = 'PRICE_ANOMALY';
  }

  return {
    verdict,
    confidencePct: Math.min(95, Math.round(deal.confidence * 100)),
    reasoning: `Evaluated by LOOT 95 Rule Judge: ${realDiscountPct}% real discount with ${scoreComponents.historicalRarity}/100 historical rarity.`,
    checks,
  };
}
