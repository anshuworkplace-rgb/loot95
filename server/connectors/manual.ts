// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Manual Deal Submission & URL Ingestion Connector
// Allows user to paste custom Amazon/Flipkart URLs or product data
// and instantly evaluate them through the intelligence pipeline.
// ═══════════════════════════════════════════════════════════════

import { v4 as uuid } from 'uuid';
import { Product, PriceEvent, Platform } from '../../shared/types.js';
import { store } from '../store.js';
import { processPriceEvent } from '../engine/pipeline.js';

export interface ManualSubmissionPayload {
  title: string;
  brand: string;
  category?: string;
  subcategory?: string;
  platform?: Platform;
  url: string;
  mrp: number;
  currentPrice: number;
  sellerName?: string;
  sellerRating?: number;
  couponRequired?: boolean;
  bankOfferRequired?: boolean;
}

export async function submitManualDeal(payload: ManualSubmissionPayload) {
  const platform: Platform = payload.platform || (payload.url.includes('flipkart') ? 'flipkart' : 'amazon');
  const productId = `manual_${platform}_${uuid().substring(0, 8)}`;
  const now = new Date().toISOString();

  // Create product record
  const product: Product = {
    id: productId,
    brand: payload.brand || 'Generic',
    model: payload.title.substring(0, 30),
    title: payload.title,
    category: payload.category || 'Electronics',
    subcategory: payload.subcategory || 'General',
    platform,
    platformProductId: productId,
    url: payload.url,
    imageUrl: '',
    mrp: payload.mrp,
    currentPrice: payload.currentPrice,
    effectivePrice: payload.currentPrice,
    sellerName: payload.sellerName || 'Direct Marketplace Seller',
    sellerRating: payload.sellerRating || 4.2,
    stockStatus: 'in_stock',
    rating: 4.3,
    reviewCount: 150,
    couponRequired: payload.couponRequired || false,
    bankOfferRequired: payload.bankOfferRequired || false,
    specifications: {},
    lastCheckedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  store.addProduct(product);

  // Add initial price point
  store.addPricePoint(productId, {
    timestamp: now,
    price: payload.currentPrice,
    effectivePrice: payload.currentPrice,
  });

  // Build simulated baseline history if none exists to allow rarity comparison
  const simulatedMedian = payload.mrp * 0.85;
  for (let i = 15; i >= 1; i--) {
    const historicalTs = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString();
    const variation = (Math.random() - 0.5) * 0.05 * simulatedMedian;
    const histPrice = Math.round((simulatedMedian + variation) / 10) * 10 - 1;
    store.addPricePoint(productId, {
      timestamp: historicalTs,
      price: histPrice,
      effectivePrice: histPrice,
    });
  }

  // Create price event
  const priceEvent: PriceEvent = {
    id: uuid(),
    productId,
    price: payload.currentPrice,
    mrp: payload.mrp,
    effectivePrice: payload.currentPrice,
    previousPrice: simulatedMedian,
    priceChange: payload.currentPrice - simulatedMedian,
    priceChangePct: ((payload.currentPrice - simulatedMedian) / simulatedMedian) * 100,
    sourceTimestamp: now,
    ingestedAt: now,
    platform,
  };

  // Run through pipeline
  const deal = await processPriceEvent(product, priceEvent);
  return deal;
}
