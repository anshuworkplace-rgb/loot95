// ═══════════════════════════════════════════════════════════════
// LOOT 95 — Multi-Source Deal Ingestion Harvester
// Fetches deal candidates from multiple independent feeds:
// DesiDime, FreeKaaMaal, Amazon Deal Search, DealsMagnet & Public RSS.
// Normalizes raw feeds into standard CandidateDeal objects.
// ═══════════════════════════════════════════════════════════════

import { Platform } from '../../shared/types.js';
import { extractAmazonAsin, extractFlipkartFsid } from './live_validator.js';

export interface CandidateDeal {
  sourceName: string;
  rawTitle: string;
  cleanTitle: string;
  dealUrl: string;
  targetUrl: string;
  storeName: string;
  platform: Platform;
  claimedPrice: number | null;
  claimedMrp: number | null;
  asin?: string;
  fsid?: string;
  description?: string;
  imageUrl?: string;
  publishedAt: string;
}

const JUNK_KEYWORDS = [
  'garbage bag', 'trash bag', 'dustbin cover', 'floor mat', 'bath mat',
  'doormat', 'silicone mat', 'skate scooter', 'kids scooter', 'microfiber cloth',
  'mop refill', 'cleaning cloth', 'soap dish', 'plastic toy', 'cable clip',
  'socks', 'underwear', 'briefs', 'panties', 'sanitary pad'
];

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function safeIsoDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString();
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Harvester 1: DesiDime RSS Feed Parser
 */
async function harvestDesiDimeDeals(): Promise<CandidateDeal[]> {
  const deals: CandidateDeal[] = [];
  try {
    const res = await fetch('https://www.desidime.com/deals', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const html = await res.text();
      const linkMatches = html.match(/<a[^>]*href="\/deals\/[^"]+"[^>]*>([\s\S]*?)<\/a>/g) || [];

      for (const l of linkMatches) {
        const titleText = l.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
        const hrefMatch = l.match(/href="([^"]+)"/);

        if (!titleText || titleText.length < 10 || !hrefMatch) continue;

        const cleanTitle = decodeHtmlEntities(titleText);
        const lowerTitle = cleanTitle.toLowerCase();
        if (JUNK_KEYWORDS.some(kw => lowerTitle.includes(kw))) continue;

        const priceMatch = cleanTitle.match(/₹\s*([0-9,]+)/) || cleanTitle.match(/(?:at|for|@)\s*(?:Rs\.?|₹)\s*([0-9,]+)/i);
        const claimedPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null;

        let platform: Platform = 'amazon';
        let storeName = 'Amazon';
        if (lowerTitle.includes('flipkart')) {
          platform = 'flipkart';
          storeName = 'Flipkart';
        } else if (lowerTitle.includes('croma')) {
          platform = 'croma';
          storeName = 'Croma';
        } else if (lowerTitle.includes('myntra')) {
          platform = 'myntra';
          storeName = 'Myntra';
        }

        const fullUrl = `https://www.desidime.com${hrefMatch[1]}`;
        const asin = extractAmazonAsin(cleanTitle);
        const fsid = extractFlipkartFsid(cleanTitle);

        deals.push({
          sourceName: 'DesiDime',
          rawTitle: titleText,
          cleanTitle,
          dealUrl: fullUrl,
          targetUrl: fullUrl,
          storeName,
          platform,
          claimedPrice,
          claimedMrp: claimedPrice ? Math.round(claimedPrice * 1.35) : null,
          asin: asin || undefined,
          fsid: fsid || undefined,
          description: cleanTitle,
          publishedAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn('[Harvester] DesiDime ingestion skipped:', (err as Error).message);
  }
  return deals;
}

/**
 * Harvester 2: FreeKaaMaal Feed Parser
 */
async function harvestFreeKaaMaalDeals(): Promise<CandidateDeal[]> {
  const deals: CandidateDeal[] = [];
  try {
    const res = await fetch('https://www.freekaamaal.com/feed', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return deals;

    const xml = await res.text();
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

    for (const itemXml of itemMatches) {
      const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
      const descMatch = itemXml.match(/<description>(.*?)<\/description>/);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

      if (!titleMatch || !linkMatch) continue;

      const rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      const cleanTitle = decodeHtmlEntities(rawTitle);

      const lowerTitle = cleanTitle.toLowerCase();
      if (JUNK_KEYWORDS.some(kw => lowerTitle.includes(kw))) continue;

      const desc = descMatch ? decodeHtmlEntities(descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')) : '';
      const rawLink = linkMatch[1].trim();

      const priceMatch = cleanTitle.match(/(?:Rs\.?|₹)\s*([0-9,]+)/i) || desc.match(/(?:Rs\.?|₹)\s*([0-9,]+)/i);
      const claimedPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null;

      let platform: Platform = 'amazon';
      let storeName = 'Amazon';
      if (lowerTitle.includes('flipkart') || desc.toLowerCase().includes('flipkart')) {
        platform = 'flipkart';
        storeName = 'Flipkart';
      }

      const asin = extractAmazonAsin(rawLink) || extractAmazonAsin(desc);
      const fsid = extractFlipkartFsid(rawLink) || extractFlipkartFsid(desc);

      deals.push({
        sourceName: 'FreeKaaMaal',
        rawTitle,
        cleanTitle,
        dealUrl: rawLink,
        targetUrl: rawLink,
        storeName,
        platform,
        claimedPrice,
        claimedMrp: claimedPrice ? Math.round(claimedPrice * 1.35) : null,
        asin: asin || undefined,
        fsid: fsid || undefined,
        description: desc.slice(0, 200),
        publishedAt: safeIsoDate(pubDateMatch?.[1]),
      });
    }
  } catch (err) {
    console.warn('[Harvester] FreeKaaMaal ingestion skipped:', (err as Error).message);
  }
  return deals;
}

/**
 * Harvester 3: DealsMagnet RSS Feed (Retained as 1 of N feeds)
 */
async function harvestDealsMagnetDeals(): Promise<CandidateDeal[]> {
  const deals: CandidateDeal[] = [];
  try {
    const res = await fetch('https://dealsmagnet.com/feed', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return deals;

    const xml = await res.text();
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

    for (const itemXml of itemMatches) {
      const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
      const descMatch = itemXml.match(/<description>(.*?)<\/description>/);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);

      if (!titleMatch || !descMatch) continue;

      const rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
      const cleanTitle = decodeHtmlEntities(rawTitle);

      const lowerTitle = cleanTitle.toLowerCase();
      if (JUNK_KEYWORDS.some(kw => lowerTitle.includes(kw))) continue;

      const desc = decodeHtmlEntities(descMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim());
      const storeMatch = desc.match(/Offer Store:\s*([^.]+)/i);
      const storeName = storeMatch ? storeMatch[1].trim() : 'Amazon';
      const platform: Platform = storeName.toLowerCase().includes('flipkart') ? 'flipkart' : 'amazon';

      const priceMatch = desc.match(/offer price of ₹\s*([0-9,]+)/i) || desc.match(/₹\s*([0-9,]+)/);
      const claimedPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null;

      const mrpMatch = desc.match(/MRP:\s*₹\s*([0-9,]+)/i);
      const claimedMrp = mrpMatch ? parseInt(mrpMatch[1].replace(/,/g, ''), 10) : null;

      const rawLink = linkMatch ? linkMatch[1] : '';
      const asin = extractAmazonAsin(rawLink) || extractAmazonAsin(desc);
      const fsid = extractFlipkartFsid(rawLink) || extractFlipkartFsid(desc);

      deals.push({
        sourceName: 'DealsMagnet',
        rawTitle,
        cleanTitle,
        dealUrl: rawLink,
        targetUrl: rawLink,
        storeName,
        platform,
        claimedPrice,
        claimedMrp,
        asin: asin || undefined,
        fsid: fsid || undefined,
        description: desc.slice(0, 200),
        publishedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Harvester] DealsMagnet ingestion skipped:', (err as Error).message);
  }
  return deals;
}

/**
 * Harvester 4: Amazon Search & Trending Keywords Ingestion
 */
async function harvestAmazonTrendingDeals(): Promise<CandidateDeal[]> {
  const deals: CandidateDeal[] = [];
  const searchKeywords = ['laptop deals', 'smartphone deals', 'headphones offer', 'smartwatch deals', 'ssd sale'];
  
  for (const kw of searchKeywords.slice(0, 2)) {
    try {
      const url = `https://completion.amazon.in/api/2/suggestions?mid=A21TJRUUN4KGV&alias=aps&prefix=${encodeURIComponent(kw)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const suggestions = data?.suggestions || [];

      for (const sug of suggestions.slice(0, 3)) {
        const value = sug?.value;
        if (!value) continue;

        const cleanTitle = `Amazon Special: ${value.toUpperCase()}`;
        const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(value)}`;

        deals.push({
          sourceName: 'AmazonDirectStream',
          rawTitle: value,
          cleanTitle,
          dealUrl: searchUrl,
          targetUrl: searchUrl,
          storeName: 'Amazon',
          platform: 'amazon',
          claimedPrice: null,
          claimedMrp: null,
          publishedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Ignore individual search failures
    }
  }
  return deals;
}

/**
 * Unified Multi-Source Harvester: Ingests from all parallel sources,
 * de-duplicates identical titles/ASINs, and returns raw candidate list.
 */
export async function harvestAllCandidateDeals(): Promise<CandidateDeal[]> {
  console.log('[Harvester] Ingesting candidates from parallel multi-stream networks...');
  const startTime = Date.now();

  const [desiDime, freeKaaMaal, dealsMagnet, amazonTrending] = await Promise.all([
    harvestDesiDimeDeals(),
    harvestFreeKaaMaalDeals(),
    harvestDealsMagnetDeals(),
    harvestAmazonTrendingDeals(),
  ]);

  const allCandidates = [
    ...desiDime,
    ...freeKaaMaal,
    ...dealsMagnet,
    ...amazonTrending,
  ];

  console.log(`[Harvester] Raw candidates fetched: ${allCandidates.length} (DesiDime: ${desiDime.length}, FreeKaaMaal: ${freeKaaMaal.length}, DealsMagnet: ${dealsMagnet.length}, Amazon: ${amazonTrending.length})`);

  // De-duplicate candidates by ASIN, FSID, or title hash
  const seenKeys = new Set<string>();
  const deduplicated: CandidateDeal[] = [];

  for (const c of allCandidates) {
    const key = c.asin
      ? `asin_${c.asin}`
      : c.fsid
        ? `fsid_${c.fsid}`
        : `title_${c.cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)}`;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicated.push(c);
    }
  }

  console.log(`[Harvester] Ingestion complete in ${Date.now() - startTime}ms. Deduplicated candidates: ${deduplicated.length}`);
  return deduplicated;
}
