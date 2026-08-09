import { fetchLiveDealsFromStream } from '../server/connectors/live_engine.js';
import { store } from '../server/store.js';

async function testFullEngine() {
  console.log('=== Testing End-to-End Loot 95 Ingestion & Hydro-Validation Engine ===\n');

  const deals = await fetchLiveDealsFromStream();

  console.log(`\nEngine Ingestion Complete!`);
  console.log(`- Deals Processed & Created: ${deals.length}`);
  console.log(`- Total Products Monitored in Store: ${store.getAllProducts().length}`);
  console.log(`- Active Deals in Store: ${store.getActiveDealEvents().length}`);

  if (deals.length > 0) {
    console.log('\nTop Processed Deal Sample:');
    const topDeal = deals[0];
    console.log(`- Title: ${topDeal.product.title}`);
    console.log(`- Source: ${topDeal.product.sourceName}`);
    console.log(`- Platform: ${topDeal.product.platform}`);
    console.log(`- Current Price: ₹${topDeal.currentPrice}`);
    console.log(`- Normal Price / MRP: ₹${topDeal.normalPrice}`);
    console.log(`- Real Discount: ${topDeal.realDiscountPct}%`);
    console.log(`- Loot Score: ${topDeal.lootScore} (${topDeal.classification})`);
    console.log(`- Stock Status: ${topDeal.product.stockStatus}`);
    console.log(`- Verified Live: ${topDeal.product.verifiedLive}`);
  }
}

testFullEngine().catch(err => console.error('Engine test error:', err));
