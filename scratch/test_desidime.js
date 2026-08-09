import fetch from 'node-fetch';

async function testDesidimeHtml() {
  const res = await fetch('https://www.desidime.com/deals', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    }
  });

  const html = await res.text();
  console.log('HTML length:', html.length);

  // Extract deal title links
  const links = html.match(/<a[^>]*href="\/deals\/[^"]+"[^>]*>([\s\S]*?)<\/a>/g) || [];
  console.log('Found DesiDime deal links:', links.length);

  for (const l of links.slice(0, 5)) {
    const text = l.replace(/<[^>]+>/g, '').trim();
    const hrefMatch = l.match(/href="([^"]+)"/);
    if (text && text.length > 10) {
      console.log(`- Title: ${text} | Href: ${hrefMatch ? hrefMatch[1] : ''}`);
    }
  }
}

testDesidimeHtml();
