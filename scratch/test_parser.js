import fetch from 'node-fetch';

interface ParsedDeal {
  title: string;
  brand: string;
  currentPrice: number;
  mrp: number;
  realDiscountPct: number;
  platform: 'amazon' | 'flipkart' | 'croma';
  storeName: string;
  url: string;
  category: string;
  subcategory: string;
}

export async function fetchFreeDeals(): Promise<ParsedDeal[]> {
  const deals: ParsedDeal[] = [];

  // Feed 1: DealsMagnet RSS
  try {
    const res = await fetch('https://dealsmagnet.com/feed', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      }
    });

    if (res.ok) {
      const xml = await res.text();
      const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

      for (const itemXml of itemMatches) {
        const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
        const descMatch = itemXml.match(/<description>(.*?)<\/description>/);
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);

        if (!titleMatch || !descMatch) continue;

        let title = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
        const desc = descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();

        // Extract store
        const storeMatch = desc.match(/Offer Store:\s*([^.]+)/i);
        const storeName = storeMatch ? storeMatch[1].trim() : 'Amazon';
        const platform = storeName.toLowerCase().includes('flipkart') ? 'flipkart' : 'amazon';

        // Extract Price (offer price)
        const priceMatch = desc.match(/offer price of ₹\s*([0-9,]+)/i) || desc.match(/₹\s*([0-9,]+)/);
        if (!priceMatch) continue;
        const currentPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        if (isNaN(currentPrice) || currentPrice <= 0) continue;

        // Extract MRP
        const mrpMatch = desc.match(/MRP:\s*₹\s*([0-9,]+)/i);
        let mrp = mrpMatch ? parseInt(mrpMatch[1].replace(/,/g, ''), 10) : 0;
        if (!mrp || mrp < currentPrice) {
          mrp = Math.round(currentPrice * 1.3);
        }

        // Extract Discount %
        const discountMatch = desc.match(/([0-9]+)%\s*off/i);
        const realDiscountPct = discountMatch
          ? parseInt(discountMatch[1], 10)
          : Math.round(((mrp - currentPrice) / mrp) * 100);

        const brand = title.split(' ')[0] || 'Generic';
        const rawLink = linkMatch ? linkMatch[1] : '';
        const url = (rawLink && rawLink.startsWith('http'))
          ? rawLink
          : `https://www.amazon.in/s?k=${encodeURIComponent(title)}`;

        deals.push({
          title,
          brand,
          currentPrice,
          mrp,
          realDiscountPct,
          platform,
          storeName: storeName || 'Amazon India',
          url,
          category: 'Electronics',
          subcategory: 'Deals',
        });
      }
    }
  } catch (e: any) {
    console.error('Error fetching DealsMagnet RSS:', e.message);
  }

  return deals;
}

fetchFreeDeals().then(results => {
  console.log(`Successfully parsed ${results.length} deals!`);
  console.log('Sample parsed deal #1:', results[0]);
  console.log('Sample parsed deal #2:', results[1]);
});
