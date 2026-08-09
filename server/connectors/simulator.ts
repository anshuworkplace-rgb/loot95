// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Electronics Simulator
// Generates realistic price events for Indian electronics market
// Uses real brand/model names with realistic price ranges
// CLEARLY LABELED: All data from this connector is SIMULATED
// ═══════════════════════════════════════════════════════════════

import { v4 as uuid } from 'uuid';
import { Product, PriceEvent, PriceHistoryPoint, Platform } from '../../shared/types.js';
import { store } from '../store.js';
import { processPriceEvent } from '../engine/pipeline.js';

// ─── Real Electronics Product Catalog (Indian Market) ─────────
// Based on real products, realistic price ranges, realistic behavior

interface ProductTemplate {
  brand: string;
  model: string;
  title: string;
  category: string;
  subcategory: string;
  mrp: number;
  normalLow: number;   // Typical lowest selling price
  normalHigh: number;   // Typical highest selling price
  imageUrl: string;
  priceStability: number; // 0-1, how stable the price normally is
  discountFrequency: number; // 0-1, how often it goes on discount
}

const ELECTRONICS_CATALOG: ProductTemplate[] = [
  // ─── Headphones & Audio ────────────────────────
  {
    brand: 'Sony', model: 'WH-1000XM5', title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    category: 'Electronics', subcategory: 'Headphones',
    mrp: 34990, normalLow: 24990, normalHigh: 30990,
    imageUrl: '', priceStability: 0.7, discountFrequency: 0.3,
  },
  {
    brand: 'Apple', model: 'AirPods Pro 2', title: 'Apple AirPods Pro (2nd Generation) with USB-C',
    category: 'Electronics', subcategory: 'Earbuds',
    mrp: 24900, normalLow: 19490, normalHigh: 24900,
    imageUrl: '', priceStability: 0.85, discountFrequency: 0.15,
  },
  {
    brand: 'Samsung', model: 'Galaxy Buds3 Pro', title: 'Samsung Galaxy Buds3 Pro Wireless Earbuds',
    category: 'Electronics', subcategory: 'Earbuds',
    mrp: 17999, normalLow: 13999, normalHigh: 16999,
    imageUrl: '', priceStability: 0.6, discountFrequency: 0.4,
  },
  {
    brand: 'JBL', model: 'Tune 770NC', title: 'JBL Tune 770NC Wireless Over-Ear Headphones',
    category: 'Electronics', subcategory: 'Headphones',
    mrp: 7999, normalLow: 4499, normalHigh: 6999,
    imageUrl: '', priceStability: 0.5, discountFrequency: 0.5,
  },
  {
    brand: 'boAt', model: 'Airdopes 511 ANC', title: 'boAt Airdopes 511 ANC True Wireless Earbuds',
    category: 'Electronics', subcategory: 'Earbuds',
    mrp: 3990, normalLow: 1499, normalHigh: 2999,
    imageUrl: '', priceStability: 0.3, discountFrequency: 0.7,
  },

  // ─── Smartphones ──────────────────────────────
  {
    brand: 'Apple', model: 'iPhone 16', title: 'Apple iPhone 16 (128GB) — Black',
    category: 'Electronics', subcategory: 'Smartphones',
    mrp: 79900, normalLow: 66999, normalHigh: 79900,
    imageUrl: '', priceStability: 0.9, discountFrequency: 0.1,
  },
  {
    brand: 'Samsung', model: 'Galaxy S25 Ultra', title: 'Samsung Galaxy S25 Ultra 5G (256GB)',
    category: 'Electronics', subcategory: 'Smartphones',
    mrp: 134999, normalLow: 109999, normalHigh: 129999,
    imageUrl: '', priceStability: 0.75, discountFrequency: 0.2,
  },
  {
    brand: 'OnePlus', model: '13', title: 'OnePlus 13 5G (256GB) — Midnight Ocean',
    category: 'Electronics', subcategory: 'Smartphones',
    mrp: 69999, normalLow: 57999, normalHigh: 67999,
    imageUrl: '', priceStability: 0.6, discountFrequency: 0.3,
  },
  {
    brand: 'Google', model: 'Pixel 9 Pro', title: 'Google Pixel 9 Pro (256GB) — Obsidian',
    category: 'Electronics', subcategory: 'Smartphones',
    mrp: 109999, normalLow: 89999, normalHigh: 104999,
    imageUrl: '', priceStability: 0.8, discountFrequency: 0.15,
  },
  {
    brand: 'Nothing', model: 'Phone (3)', title: 'Nothing Phone (3) (256GB) — Dark Grey',
    category: 'Electronics', subcategory: 'Smartphones',
    mrp: 39999, normalLow: 34999, normalHigh: 39999,
    imageUrl: '', priceStability: 0.7, discountFrequency: 0.2,
  },

  // ─── Laptops ──────────────────────────────────
  {
    brand: 'Apple', model: 'MacBook Air M3', title: 'Apple MacBook Air 13" M3 Chip (8GB/256GB)',
    category: 'Electronics', subcategory: 'Laptops',
    mrp: 114900, normalLow: 94990, normalHigh: 114900,
    imageUrl: '', priceStability: 0.9, discountFrequency: 0.1,
  },
  {
    brand: 'Lenovo', model: 'ThinkPad E16', title: 'Lenovo ThinkPad E16 Gen 2 Intel Core i7',
    category: 'Electronics', subcategory: 'Laptops',
    mrp: 89990, normalLow: 62999, normalHigh: 79999,
    imageUrl: '', priceStability: 0.5, discountFrequency: 0.4,
  },
  {
    brand: 'HP', model: 'Victus 16', title: 'HP Victus 16 Gaming Laptop AMD Ryzen 7 RTX 4060',
    category: 'Electronics', subcategory: 'Laptops',
    mrp: 94990, normalLow: 67990, normalHigh: 84990,
    imageUrl: '', priceStability: 0.55, discountFrequency: 0.35,
  },

  // ─── Tablets ──────────────────────────────────
  {
    brand: 'Apple', model: 'iPad 10th Gen', title: 'Apple iPad (10th Gen) Wi-Fi 64GB — Blue',
    category: 'Electronics', subcategory: 'Tablets',
    mrp: 37900, normalLow: 30999, normalHigh: 36900,
    imageUrl: '', priceStability: 0.8, discountFrequency: 0.2,
  },
  {
    brand: 'Samsung', model: 'Galaxy Tab S9 FE', title: 'Samsung Galaxy Tab S9 FE 10.9" (128GB)',
    category: 'Electronics', subcategory: 'Tablets',
    mrp: 44999, normalLow: 29999, normalHigh: 39999,
    imageUrl: '', priceStability: 0.55, discountFrequency: 0.35,
  },

  // ─── TVs ──────────────────────────────────────
  {
    brand: 'Samsung', model: 'Crystal 4K 55"', title: 'Samsung 55" Crystal 4K UHD Smart TV',
    category: 'Electronics', subcategory: 'TVs',
    mrp: 74900, normalLow: 39990, normalHigh: 54990,
    imageUrl: '', priceStability: 0.4, discountFrequency: 0.5,
  },
  {
    brand: 'LG', model: 'OLED evo C4 55"', title: 'LG OLED evo C4 55" 4K Smart TV',
    category: 'Electronics', subcategory: 'TVs',
    mrp: 159990, normalLow: 99990, normalHigh: 139990,
    imageUrl: '', priceStability: 0.5, discountFrequency: 0.3,
  },
  {
    brand: 'Sony', model: 'Bravia 7 55"', title: 'Sony BRAVIA 7 55" 4K HDR Mini LED TV',
    category: 'Electronics', subcategory: 'TVs',
    mrp: 149990, normalLow: 119990, normalHigh: 149990,
    imageUrl: '', priceStability: 0.7, discountFrequency: 0.2,
  },

  // ─── Cameras ──────────────────────────────────
  {
    brand: 'Canon', model: 'EOS R50', title: 'Canon EOS R50 Mirrorless Camera with RF-S 18-45mm',
    category: 'Electronics', subcategory: 'Cameras',
    mrp: 72995, normalLow: 54999, normalHigh: 67999,
    imageUrl: '', priceStability: 0.7, discountFrequency: 0.2,
  },
  {
    brand: 'GoPro', model: 'HERO13 Black', title: 'GoPro HERO13 Black Action Camera',
    category: 'Electronics', subcategory: 'Cameras',
    mrp: 41500, normalLow: 34999, normalHigh: 41500,
    imageUrl: '', priceStability: 0.8, discountFrequency: 0.15,
  },

  // ─── Smartwatches ─────────────────────────────
  {
    brand: 'Apple', model: 'Watch Series 10', title: 'Apple Watch Series 10 GPS 42mm',
    category: 'Electronics', subcategory: 'Smartwatches',
    mrp: 46900, normalLow: 39990, normalHigh: 46900,
    imageUrl: '', priceStability: 0.85, discountFrequency: 0.1,
  },
  {
    brand: 'Samsung', model: 'Galaxy Watch7', title: 'Samsung Galaxy Watch7 44mm Bluetooth',
    category: 'Electronics', subcategory: 'Smartwatches',
    mrp: 31999, normalLow: 22999, normalHigh: 29999,
    imageUrl: '', priceStability: 0.6, discountFrequency: 0.3,
  },

  // ─── Gaming ───────────────────────────────────
  {
    brand: 'Sony', model: 'PS5 Slim', title: 'Sony PlayStation 5 Slim Console (Disc Edition)',
    category: 'Electronics', subcategory: 'Gaming',
    mrp: 54990, normalLow: 47990, normalHigh: 54990,
    imageUrl: '', priceStability: 0.85, discountFrequency: 0.1,
  },
  {
    brand: 'Nintendo', model: 'Switch OLED', title: 'Nintendo Switch OLED Model — White',
    category: 'Electronics', subcategory: 'Gaming',
    mrp: 29999, normalLow: 26999, normalHigh: 29999,
    imageUrl: '', priceStability: 0.9, discountFrequency: 0.05,
  },

  // ─── Home Appliances ──────────────────────────
  {
    brand: 'Dyson', model: 'V12 Detect Slim', title: 'Dyson V12 Detect Slim Cordless Vacuum',
    category: 'Electronics', subcategory: 'Appliances',
    mrp: 52900, normalLow: 39990, normalHigh: 49990,
    imageUrl: '', priceStability: 0.75, discountFrequency: 0.2,
  },
  {
    brand: 'iRobot', model: 'Roomba i5+', title: 'iRobot Roomba i5+ Self-Emptying Robot Vacuum',
    category: 'Electronics', subcategory: 'Appliances',
    mrp: 49900, normalLow: 29990, normalHigh: 44990,
    imageUrl: '', priceStability: 0.5, discountFrequency: 0.3,
  },
];

// ─── Simulator State ──────────────────────────────────────────

const productPriceState = new Map<string, {
  currentPrice: number;
  history: number[];
  lastUpdate: number;
  trend: 'stable' | 'dropping' | 'rising';
  trendStrength: number;
}>();

let initialized = false;

// ─── Initialize Products + Build History ──────────────────────

export function initializeSimulator(): void {
  if (initialized) return;

  console.log('[Simulator] Initializing electronics catalog with realistic price history...');

  for (const template of ELECTRONICS_CATALOG) {
    const productId = `sim_${template.brand.toLowerCase()}_${template.model.toLowerCase().replace(/\s+/g, '_')}`;

    // Create product
    const product: Product = {
      id: productId,
      brand: template.brand,
      model: template.model,
      title: `[SIM] ${template.title}`,
      category: template.category,
      subcategory: template.subcategory,
      platform: 'simulator',
      platformProductId: productId,
      url: `https://www.amazon.in/s?k=${encodeURIComponent(template.brand + ' ' + template.model)}`,
      imageUrl: template.imageUrl,
      mrp: template.mrp,
      currentPrice: template.normalHigh,
      effectivePrice: template.normalHigh,
      sellerName: 'Simulated Seller',
      sellerRating: 3.5 + Math.random() * 1.5,
      stockStatus: 'in_stock',
      rating: 3.5 + Math.random() * 1.5,
      reviewCount: Math.floor(100 + Math.random() * 10000),
      couponRequired: false,
      bankOfferRequired: false,
      specifications: {},
      lastCheckedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.addProduct(product);

    // Generate 30 days of realistic price history
    const historyDays = 30;
    const pointsPerDay = 4; // 4 checks per day
    const totalPoints = historyDays * pointsPerDay;
    const priceRange = template.normalHigh - template.normalLow;
    const prices: number[] = [];

    let currentHistPrice = template.normalLow + Math.random() * priceRange;

    for (let i = 0; i < totalPoints; i++) {
      const ts = new Date(Date.now() - (totalPoints - i) * 6 * 60 * 60 * 1000);

      // Simulate realistic price movement
      const volatility = (1 - template.priceStability) * 0.05;
      const drift = (Math.random() - 0.5) * 2 * volatility * currentHistPrice;
      currentHistPrice = Math.max(
        template.normalLow * 0.9,
        Math.min(template.normalHigh * 1.05, currentHistPrice + drift)
      );

      // Occasionally add small sale events
      if (Math.random() < template.discountFrequency * 0.02) {
        currentHistPrice = template.normalLow * (0.85 + Math.random() * 0.15);
      }

      // Snap back to normal range
      if (Math.random() < 0.1 && currentHistPrice < template.normalLow) {
        currentHistPrice = template.normalLow + Math.random() * priceRange * 0.3;
      }

      const roundedPrice = Math.round(currentHistPrice / 10) * 10 - 1; // e.g., 24989

      prices.push(roundedPrice);
      store.addPricePoint(productId, {
        timestamp: ts.toISOString(),
        price: roundedPrice,
        effectivePrice: roundedPrice,
      });
    }

    // Set initial price state
    productPriceState.set(productId, {
      currentPrice: prices[prices.length - 1],
      history: prices,
      lastUpdate: Date.now(),
      trend: 'stable',
      trendStrength: 0,
    });
  }

  // Mark connector as online
  store.setConnectorStatus({
    platform: 'simulator',
    status: 'ONLINE',
    lastSuccessAt: new Date().toISOString(),
    lastErrorAt: null,
    errorMessage: null,
    eventsProcessed: 0,
    avgLatencyMs: 0,
  });

  console.log(`[Simulator] Initialized ${ELECTRONICS_CATALOG.length} products with ${30 * 4} price points each`);
  initialized = true;
}

// ─── Generate Next Price Event ────────────────────────────────

export async function generatePriceEvent(): Promise<void> {
  // Pick a random product
  const templates = ELECTRONICS_CATALOG;
  const template = templates[Math.floor(Math.random() * templates.length)];
  const productId = `sim_${template.brand.toLowerCase()}_${template.model.toLowerCase().replace(/\s+/g, '_')}`;

  const product = store.getProduct(productId);
  if (!product) return;

  const state = productPriceState.get(productId);
  if (!state) return;

  const previousPrice = state.currentPrice;
  let newPrice: number;

  // ─── Price Generation Logic ─────────────────────────────────
  const roll = Math.random();

  if (roll < 0.005) {
    // 0.5% chance: EXTREME LOOT EVENT (90-95% off normal)
    newPrice = Math.round(template.normalLow * (0.05 + Math.random() * 0.1));
    console.log(`[Simulator] 🚨 EXTREME EVENT: ${template.brand} ${template.model} → ₹${newPrice}`);
  } else if (roll < 0.02) {
    // 1.5% chance: Major price drop (60-85% off normal)
    newPrice = Math.round(template.normalLow * (0.15 + Math.random() * 0.25));
    console.log(`[Simulator] 🔥 MAJOR DROP: ${template.brand} ${template.model} → ₹${newPrice}`);
  } else if (roll < 0.06) {
    // 4% chance: Significant discount (30-50% off normal)
    newPrice = Math.round(template.normalLow * (0.5 + Math.random() * 0.2));
  } else if (roll < 0.15) {
    // 9% chance: Moderate discount (10-25% off normal)
    newPrice = Math.round(template.normalLow * (0.75 + Math.random() * 0.15));
  } else {
    // 85% chance: Normal price fluctuation within range
    const priceRange = template.normalHigh - template.normalLow;
    const volatility = (1 - template.priceStability) * 0.03;
    const drift = (Math.random() - 0.5) * 2 * volatility * state.currentPrice;
    newPrice = Math.round(
      Math.max(template.normalLow * 0.95,
        Math.min(template.normalHigh * 1.02, state.currentPrice + drift))
    );
  }

  // Round to realistic price points (ending in 9, 99, etc.)
  newPrice = Math.round(newPrice / 10) * 10 - 1;
  if (newPrice < 99) newPrice = 99;

  // Update state
  state.currentPrice = newPrice;
  state.history.push(newPrice);
  if (state.history.length > 500) state.history.shift();
  state.lastUpdate = Date.now();

  // Update product in store
  store.updateProductPrice(productId, newPrice, newPrice);

  // Add to price history
  const now = new Date().toISOString();
  store.addPricePoint(productId, {
    timestamp: now,
    price: newPrice,
    effectivePrice: newPrice,
  });

  // Create price event
  const priceEvent: PriceEvent = {
    id: uuid(),
    productId,
    price: newPrice,
    mrp: template.mrp,
    effectivePrice: newPrice,
    previousPrice,
    priceChange: newPrice - previousPrice,
    priceChangePct: previousPrice ? ((newPrice - previousPrice) / previousPrice) * 100 : 0,
    sourceTimestamp: now,
    ingestedAt: now,
    platform: 'simulator',
  };

  // Process through the intelligence pipeline
  await processPriceEvent(product, priceEvent);
}

// ─── Run Continuous Simulation ────────────────────────────────

let simulationInterval: ReturnType<typeof setInterval> | null = null;

export function startSimulation(intervalMs: number = 3000): void {
  if (simulationInterval) return;

  initializeSimulator();

  console.log(`[Simulator] Starting continuous simulation (interval: ${intervalMs}ms)`);

  // Generate events at the specified interval
  simulationInterval = setInterval(async () => {
    try {
      // Generate 1-3 events per cycle
      const eventCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < eventCount; i++) {
        await generatePriceEvent();
      }
    } catch (error) {
      console.error('[Simulator] Error generating event:', error);
    }
  }, intervalMs);
}

export function stopSimulation(): void {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log('[Simulator] Stopped');
  }
}
