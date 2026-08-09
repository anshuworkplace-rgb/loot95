import fetch from 'node-fetch';
import https from 'https';

const agent = new https.Agent({
  rejectUnauthorized: false
});

async function testMoreSources() {
  console.log('--- Testing High Yield Deal Feeds ---');

  const sources = [
    { name: 'FreeKaaMaal Feed', url: 'https://www.freekaamaal.com/feed' },
    { name: 'DealsMagnet Feed', url: 'https://dealsmagnet.com/feed' },
    { name: 'DesiDime Frontpage', url: 'https://www.desidime.com/deals' },
    { name: 'Flipkart Search Completion API', url: 'https://1.com.flipkart.android/4/action/suggest?q=deals' },
    { name: 'Amazon India AutoComplete API', url: 'https://completion.amazon.in/api/2/suggestions?mid=A21TJRUUN4KGV&alias=aps&prefix=laptop+deals' },
  ];

  for (const s of sources) {
    try {
      const res = await fetch(s.url, {
        agent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      });
      console.log(`${s.name} -> Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Sample (first 300 chars): ${text.substring(0, 300).replace(/\s+/g, ' ')}`);
      }
    } catch (e) {
      console.log(`${s.name} -> Error: ${e.message}`);
    }
  }
}

testMoreSources();
