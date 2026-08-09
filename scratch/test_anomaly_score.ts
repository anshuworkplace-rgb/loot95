import { computeDealAnomalyMetrics } from '../server/engine/intelligence.js';
import { Product } from '../shared/types.js';
import { AggregatedPriceBaseline } from '../server/connectors/price_tracker_aggregator.js';

function testUserExampleAnomalyScore() {
  console.log('=== Testing Deal Anomaly Score Engine ===\n');

  const sampleProduct: Product = {
    id: 'test_laptop_1',
    brand: 'Asus',
    model: 'TUF Gaming F15',
    title: 'Asus TUF Gaming F15 Core i5 11th Gen Laptop',
    category: 'Computers',
    subcategory: 'Laptops',
    platform: 'amazon',
    platformProductId: 'B08N5WRWNW',
    url: 'https://www.amazon.in/dp/B08N5WRWNW',
    imageUrl: '',
    mrp: 49999,
    currentPrice: 22499,
    effectivePrice: 22499,
    sellerName: 'Appario Retail',
    sellerRating: 4.8,
    stockStatus: 'in_stock',
    verifiedLive: true,
    rating: 4.6,
    reviewCount: 1540,
    couponRequired: false,
    bankOfferRequired: false,
    specifications: {},
    lastCheckedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleAggregatorBaseline: AggregatedPriceBaseline = {
    productId: 'test_laptop_1',
    asin: 'B08N5WRWNW',
    allTimeLow: 39999,
    typicalLowestPrice: 39999,
    averageSellingPrice: 49999,
    highestPrice: 59999,
    sampleCount: 100,
    pricePoints: [], // Empty to test ratio percentile estimation
    source: 'PriceHistory Aggregator API',
    fetchedAt: new Date().toISOString(),
  };

  const metrics = computeDealAnomalyMetrics(
    sampleProduct,
    22499,
    49999,
    null,
    sampleAggregatorBaseline
  );

  console.log('User Example Target Output:');
  console.log(`Normal price:             ₹${metrics.normalPrice.toLocaleString('en-IN')}`);
  console.log(`Typical lowest price:     ₹${metrics.typicalLowestPrice.toLocaleString('en-IN')}`);
  console.log(`Current price:            ₹${metrics.currentPrice.toLocaleString('en-IN')}`);
  console.log('');
  console.log(`Historical percentile:    ${metrics.historicalPercentile}%`);
  console.log(`Rarity:                   ${metrics.rarityLabel}`);
  console.log(`Price anomaly:            ${metrics.priceAnomalyScore}/100`);
  console.log(`Demand:                   ${metrics.demandLabel}`);
  console.log(`Seller confidence:        ${metrics.sellerConfidenceLabel}`);
  console.log('');
  console.log(`DEAL SCORE:               ${metrics.compositeDealScore.toFixed(1)}/100`);
}

testUserExampleAnomalyScore();
