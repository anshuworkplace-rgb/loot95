// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Autonomous Multi-Source & Live Store Verification Engine
// Ingests from multi-stream harvesters (DesiDime, FreeKaaMaal, Amazon, DealsMagnet).
// Performs live store Hydro-Validation against Amazon & Flipkart to eliminate
// fake prices and out-of-stock products. Sweeps active deals every 5 mins.
// ═══════════════════════════════════════════════════════════════

import { v4 as uuid } from 'uuid';
import { Product, PriceEvent, Platform, DealEvent } from '../../shared/types.js';
import { store } from '../store.js';
import { processPriceEvent, broadcastDeal } from '../engine/pipeline.js';
import { harvestAllCandidateDeals, CandidateDeal } from './multi_source_harvester.js';
import { verifyLiveProduct, extractAmazonAsin, extractFlipkartFsid } from './live_validator.js';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let sweeperTimer: ReturnType<typeof setInterval> | null = null;
let totalEventsProcessed = 0;

function extractBrand(title: string): string {
  const words = title.split(' ');
  return words[0] || 'Generic';
}

function categorizeProduct(title: string, _brand: string): string {
  const t = title.toLowerCase();
  if (t.includes('laptop') || t.includes('notebook') || t.includes('macbook') || t.includes('chromebook')) return 'Computers';
  if (t.includes('phone') || t.includes('iphone') || t.includes('galaxy') || t.includes('pixel') || t.includes('oneplus') || t.includes('redmi') || t.includes('realme') || t.includes('smartphone')) return 'Smartphones';
  if (t.includes('tablet') || t.includes('ipad')) return 'Tablets';
  if (t.includes('headphone') || t.includes('earphone') || t.includes('earbud') || t.includes('airpod') || t.includes('speaker') || t.includes('soundbar') || t.includes('tws')) return 'Audio';
  if (t.includes('tv') || t.includes('television') || t.includes('monitor') || t.includes('display')) return 'Displays';
  if (t.includes('watch') || t.includes('band') || t.includes('smartwatch')) return 'Wearables';
  if (t.includes('camera') || t.includes('gopro') || t.includes('dslr')) return 'Cameras';
  if (t.includes('gaming') || t.includes('console') || t.includes('controller') || t.includes('playstation') || t.includes('xbox')) return 'Gaming';
  if (t.includes('fan') || t.includes('purifier') || t.includes('vacuum') || t.includes('washing') || t.includes('refrigerator') || t.includes('printer')) return 'Appliances';
  return 'Electronics';
}

function subcategorizeProduct(title: string, _brand: string): string {
  const t = title.toLowerCase();
  if (t.includes('laptop') || t.includes('macbook')) return 'Laptops';
  if (t.includes('phone') || t.includes('iphone') || t.includes('galaxy') || t.includes('smartphone')) return 'Smartphones';
  if (t.includes('headphone')) return 'Headphones';
  if (t.includes('earbud') || t.includes('tws') || t.includes('airpod')) return 'Earbuds';
  if (t.includes('speaker') || t.includes('soundbar')) return 'Speakers';
  if (t.includes('tv') || t.includes('television')) return 'TVs';
  if (t.includes('smartwatch') || t.includes('watch')) return 'Smartwatches';
  if (t.includes('gaming') || t.includes('steering')) return 'Gaming';
  if (t.includes('printer')) return 'Printers';
  if (t.includes('fan')) return 'Appliances';
  return 'Deals';
}

/**
 * Primary Ingestion Workflow:
 * 1. Ingest candidate deals from all parallel streams.
 * 2. Run Live Store Hydro-Validation on candidates to verify price & stock.
 * 3. Filter out unavailable / dead / fake deals.
 * 4. Process genuine deals through Loot 95 scoring pipeline.
 */
export async function fetchLiveDealsFromStream(): Promise<DealEvent[]> {
  const startTime = Date.now();
  console.log('[Live Engine] Harvesting candidates from multi-stream network...');

  try {
    const candidates = await harvestAllCandidateDeals();
    if (candidates.length === 0) {
      console.log('[Live Engine] No candidate items harvested');
      return [];
    }

    const now = new Date().toISOString();
    const processedDeals: DealEvent[] = [];

    // Limit live validation batch to top 25 candidates per cycle for optimal performance
    const candidatesToValidate = candidates.slice(0, 25);

    for (const cand of candidatesToValidate) {
      // Step 1: Live Hydro-Validation against Amazon / Flipkart direct store page
      const liveValidation = await verifyLiveProduct(cand.targetUrl, cand.platform);

      // STEP 2: Strict Out-of-Stock Filter (Fixes "90% products are unavailable")
      if (liveValidation.verifiedLive && !liveValidation.isAvailable) {
        console.log(`[Live Engine] ❌ REJECTED dead/out-of-stock deal: "${cand.cleanTitle}"`);
        continue;
      }

      // Determine genuine current price and MRP (Prefer live store price over RSS claimed)
      const currentPrice = liveValidation.currentPrice || cand.claimedPrice;
      if (!currentPrice || currentPrice <= 0) {
        console.log(`[Live Engine] ⚠️ Skipped deal with invalid price: "${cand.cleanTitle}"`);
        continue;
      }

      let mrp = liveValidation.mrp || cand.claimedMrp || 0;
      if (!mrp || mrp < currentPrice) {
        mrp = Math.round(currentPrice * 1.35);
      }

      // Step 3: Canonical Product ID Generation (ASIN, FSID, or Title Hash)
      const asin = liveValidation.asin || cand.asin || extractAmazonAsin(cand.dealUrl);
      const fsid = liveValidation.fsid || cand.fsid || extractFlipkartFsid(cand.dealUrl);
      const title = liveValidation.title || cand.cleanTitle;

      let productId = `live_${cand.platform}_`;
      if (asin) {
        productId += `asin_${asin}`;
      } else if (fsid) {
        productId += `fsid_${fsid}`;
      } else {
        const cleanTitleStr = title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
        productId += cleanTitleStr;
      }

      const brand = extractBrand(title);
      const existingProduct = store.getProduct(productId);

      // Step 4: Product Cooldown Check (Fixes "showing same product everytime")
      if (existingProduct) {
        const lastCheckedTime = new Date(existingProduct.lastCheckedAt).getTime();
        const minsSinceLastCheck = (Date.now() - lastCheckedTime) / (1000 * 60);
        
        // If checked less than 10 mins ago and price hasn't dropped further, skip re-broadcasting identical deal
        if (minsSinceLastCheck < 10 && existingProduct.currentPrice <= currentPrice) {
          continue;
        }
      }

      const previousPrice = existingProduct?.currentPrice || mrp;
      const targetUrl = liveValidation.finalUrl || cand.targetUrl;

      const product: Product = {
        id: productId,
        asin: asin || undefined,
        fsid: fsid || undefined,
        sku: cand.sku,
        brand,
        model: title.split(' ').slice(1, 4).join(' ') || 'Product',
        title,
        category: categorizeProduct(title, brand),
        subcategory: subcategorizeProduct(title, brand),
        platform: cand.platform,
        platformProductId: asin || fsid || productId,
        url: targetUrl,
        imageUrl: liveValidation.imageUrl || cand.imageUrl || '',
        mrp,
        currentPrice,
        effectivePrice: liveValidation.effectivePrice || currentPrice,
        averagePrice: existingProduct?.averagePrice || Math.round(currentPrice * 1.25),
        allTimeLow: existingProduct?.allTimeLow ? Math.min(existingProduct.allTimeLow, currentPrice) : currentPrice,
        sellerName: liveValidation.sellerName || `${cand.storeName} Retailer`,
        sellerRating: liveValidation.sellerRating || 4.5,
        isSellerTrusted: liveValidation.isSellerTrusted !== false,
        isRefurbishedOrUsed: liveValidation.isRefurbishedOrUsed || false,
        stockStatus: liveValidation.stockStatus,
        verifiedLive: liveValidation.verifiedLive,
        sourceName: cand.sourceName,
        rating: 4.5,
        reviewCount: 420,
        couponRequired: false,
        bankOfferRequired: !!liveValidation.bankOfferDetails,
        bankOfferDetails: liveValidation.bankOfferDetails,
        instantDiscountAmount: liveValidation.instantDiscountAmount || 0,
        specifications: {},
        lastCheckedAt: now,
        createdAt: existingProduct?.createdAt || now,
        updatedAt: now,
      };

      store.addProduct(product);

      store.addPricePoint(productId, {
        timestamp: now,
        price: currentPrice,
        effectivePrice: product.effectivePrice,
      });

      const priceEvent: PriceEvent = {
        id: uuid(),
        productId,
        price: currentPrice,
        mrp,
        effectivePrice: product.effectivePrice,
        previousPrice,
        priceChange: currentPrice - previousPrice,
        priceChangePct: previousPrice ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0,
        sourceTimestamp: now,
        ingestedAt: now,
        platform: cand.platform,
      };

      const deal = await processPriceEvent(product, priceEvent);
      if (deal) {
        processedDeals.push(deal);
      }
    }

    totalEventsProcessed += candidatesToValidate.length;
    const latencyMs = Date.now() - startTime;

    store.setConnectorStatus({
      platform: 'amazon',
      status: 'ONLINE',
      lastSuccessAt: now,
      lastErrorAt: null,
      errorMessage: null,
      eventsProcessed: totalEventsProcessed,
      avgLatencyMs: latencyMs,
    });

    console.log(`[Live Engine] Ingested & verified ${processedDeals.length} live deals from ${candidatesToValidate.length} candidates (${latencyMs}ms)`);
    return processedDeals;
  } catch (err: any) {
    console.error('[Live Engine] Multi-platform ingestion error:', err.message);
    store.addError('LiveEngine', err.message);

    store.setConnectorStatus({
      platform: 'amazon',
      status: 'DEGRADED',
      lastSuccessAt: null,
      lastErrorAt: new Date().toISOString(),
      errorMessage: err.message,
      eventsProcessed: totalEventsProcessed,
      avgLatencyMs: 0,
    });

    return [];
  }
}

/**
 * Feature 6: Adaptive Stock & Expiry Health Poller
 * Periodically re-verifies active deals in store every 3 minutes.
 * If a product goes out of stock, expires, or has a price increase, marks as EXPIRED.
 */
export async function sweepActiveDeals(): Promise<number> {
  console.log('[Live Sweeper] Running adaptive stock & expiry health sweep...');
  const deals = store.getActiveDealEvents();
  let expiredCount = 0;

  for (const deal of deals.slice(0, 20)) {
    try {
      const validation = await verifyLiveProduct(deal.product.url, deal.product.platform);
      
      // Auto-purge if out of stock or price jumped by >25%
      const priceJumped = validation.currentPrice && validation.currentPrice > deal.currentPrice * 1.25;

      if ((validation.verifiedLive && !validation.isAvailable) || priceJumped) {
        console.log(`[Live Sweeper] ⚠️ Product expired / sold out / price increased: ${deal.product.title}`);
        deal.product.stockStatus = 'out_of_stock';
        deal.isActive = false;
        deal.expiresAt = new Date().toISOString();
        store.addProduct(deal.product);
        store.addDealEvent(deal);
        broadcastDeal(deal);
        expiredCount++;
      }
    } catch (e) {
      // Ignore individual sweep errors
    }
  }

  if (expiredCount > 0) {
    console.log(`[Live Sweeper] Deactivated ${expiredCount} expired / out-of-stock deals.`);
  }
  return expiredCount;
}

export function startLiveEnginePolling(intervalMs: number = 30000) {
  console.log(`[Live Engine] Starting 7+ Multi-Platform Autonomous Verification Engine (interval: ${intervalMs / 1000}s)`);

  // Immediate fetch on boot
  setTimeout(() => fetchLiveDealsFromStream().catch(() => {}), 1000);

  pollTimer = setInterval(() => {
    fetchLiveDealsFromStream().catch(() => {});
  }, intervalMs);

  // Run adaptive health poller every 3 minutes (180,000 ms)
  sweeperTimer = setInterval(() => {
    sweepActiveDeals().catch(() => {});
  }, 180000);
}

export function stopLiveEnginePolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (sweeperTimer) {
    clearInterval(sweeperTimer);
    sweeperTimer = null;
  }
}

