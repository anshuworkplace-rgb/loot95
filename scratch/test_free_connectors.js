import fetch from 'node-fetch';

async function testFeeds() {
  console.log('--- Testing Free Public Feeds ---');

  // Test 1: DesiDime RSS
  try {
    const res = await fetch('https://www.desidime.com/rss/deals.xml', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    console.log('DesiDime RSS status:', res.status);
    if (res.ok) {
      const text = await res.text();
      console.log('DesiDime sample:', text.substring(0, 300));
    }
  } catch (e) {
    console.error('DesiDime error:', e.message);
  }

  // Test 2: Direct Amazon Search HTML
  try {
    const res = await fetch('https://www.amazon.in/s?k=deals+of+the+day', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    console.log('Amazon search status:', res.status);
    if (res.ok) {
      const html = await res.text();
      console.log('Amazon HTML length:', html.length);
      const titleMatches = html.match(/class="a-size-medium a-color-base a-text-normal"[^>]*>([^<]+)</g);
      console.log('Found title matches:', titleMatches?.slice(0, 3));
    }
  } catch (e) {
    console.error('Amazon error:', e.message);
  }
}

testFeeds();
