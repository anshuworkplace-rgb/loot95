import { harvestAllCandidateDeals } from '../server/connectors/multi_source_harvester.js';
import { verifyLiveProduct } from '../server/connectors/live_validator.js';

async function testHarvesterAndValidator() {
  console.log('=== Testing Loot 95 Multi-Source Harvester & Hydro-Validator ===\n');

  // Test 1: Multi-Source Candidate Ingestion
  const candidates = await harvestAllCandidateDeals();
  console.log(`\nHarvested ${candidates.length} candidate deals across all feeds.`);
  if (candidates.length > 0) {
    console.log('Sample Candidate 1:', JSON.stringify(candidates[0], null, 2));
    console.log('Sample Candidate 2:', JSON.stringify(candidates[Math.min(1, candidates.length - 1)], null, 2));
  }

  // Test 2: Live Hydro-Validation on Amazon Product
  console.log('\n--- Testing Live Store Validation on Direct Amazon URL ---');
  const sampleAmazonUrl = 'https://www.amazon.in/dp/B08N5WRWNW';
  const valResult = await verifyLiveProduct(sampleAmazonUrl);
  console.log('Amazon Hydro-Validation Result:', JSON.stringify(valResult, null, 2));

  // Test 3: Live Hydro-Validation on Flipkart Product
  console.log('\n--- Testing Live Store Validation on Flipkart URL ---');
  const sampleFlipkartUrl = 'https://www.flipkart.com/p/itme877478051772';
  const valResultFk = await verifyLiveProduct(sampleFlipkartUrl, 'flipkart');
  console.log('Flipkart Hydro-Validation Result:', JSON.stringify(valResultFk, null, 2));
}

testHarvesterAndValidator().catch(err => console.error('Test error:', err));
