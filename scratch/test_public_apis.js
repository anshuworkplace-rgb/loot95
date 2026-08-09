import fetch from 'node-fetch';

async function testPublicAPIs() {
  console.log('--- Testing Alternative Public APIs ---');

  // Test 1: OpenWeb / Public JSON endpoints
  const endpoints = [
    { name: 'DesiDime API', url: 'https://www.desidime.com/api/v1/deals/new.json' },
    { name: 'IndiaFreeStuff RSS', url: 'https://www.indiafreestuff.in/feed' },
    { name: 'FreeKaaMaal RSS', url: 'https://www.freekaamaal.com/feed' },
    { name: 'Amazon Deals JSON (Open)', url: 'https://www.amazon.in/gp/goldbox/json' },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/xml, application/xml, */*'
        }
      });
      console.log(`${ep.name} -> Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Sample (first 200 chars): ${text.substring(0, 200).replace(/\s+/g, ' ')}`);
      }
    } catch (e) {
      console.log(`${ep.name} -> Error: ${e.message}`);
    }
  }
}

testPublicAPIs();
