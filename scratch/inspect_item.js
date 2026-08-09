import fetch from 'node-fetch';

async function inspectItemDetail() {
  const res = await fetch('https://dealsmagnet.com/feed', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  });

  const xml = await res.text();
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  if (itemMatches.length > 0) {
    console.log('--- Full XML Item #1 ---');
    console.log(itemMatches[0]);
  }
}

inspectItemDetail();
