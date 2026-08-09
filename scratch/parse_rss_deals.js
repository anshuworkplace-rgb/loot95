import fetch from 'node-fetch';

async function parseFeeds() {
  console.log('--- Inspecting Real Deal Items in XML Feeds ---');

  const res = await fetch('https://dealsmagnet.com/feed', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  });

  const xml = await res.text();
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  console.log(`Found ${itemMatches.length} deals in DealsMagnet feed!`);

  for (let i = 0; i < Math.min(5, itemMatches.length); i++) {
    const item = itemMatches[i];
    const titleMatch = item.match(/<title>(.*?)<\/title>/);
    const linkMatch = item.match(/<link>(.*?)<\/link>/);
    const descMatch = item.match(/<description>(.*?)<\/description>/);
    console.log(`\nDeal #${i + 1}:`);
    console.log(' Title:', titleMatch ? titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : 'N/A');
    console.log(' Link:', linkMatch ? linkMatch[1] : 'N/A');
    console.log(' Desc snippet:', descMatch ? descMatch[1].substring(0, 150).replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : 'N/A');
  }
}

parseFeeds();
