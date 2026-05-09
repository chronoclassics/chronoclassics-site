// api/ebay-sold.js — Recently sold listings via eBay Finding API
// Uses the same EBAY_APP_ID env var as ebay-listings.js (no OAuth needed here)

const https = require('https');

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET' }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('Parse error: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Ordered longest-first so multi-word brands match before single-word prefixes
const BRANDS = [
  'A. Lange & Söhne', 'Audemars Piguet', 'Patek Philippe', 'TAG Heuer',
  'Jaeger-LeCoultre', 'Vacheron Constantin', 'Girard-Perregaux',
  'F.P. Journe', 'H. Moser', 'Ulysse Nardin',
  'Breitling', 'Panerai', 'Hublot', 'Cartier',
  'Omega', 'Rolex', 'Tudor', 'IWC', 'Longines', 'Seiko', 'Citizen'
];

function extractBrand(title) {
  const t = title.toLowerCase();
  return BRANDS.find(b => t.startsWith(b.toLowerCase())) || title.split(' ')[0];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // 30-minute browser/CDN cache — sold listings don't change by the second
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const APP_ID = process.env.EBAY_APP_ID;
  if (!APP_ID) return res.status(500).json({ error: 'Missing EBAY_APP_ID env var' });

  const limit = Math.min(parseInt((req.query || {}).limit) || 20, 50);

  const qs = [
    'OPERATION-NAME=findCompletedItems',
    'SERVICE-VERSION=1.0.0',
    'SECURITY-APPNAME=' + encodeURIComponent(APP_ID),
    'RESPONSE-DATA-FORMAT=JSON',
    'REST-PAYLOAD',
    'itemFilter(0).name=Seller',
    'itemFilter(0).value=chronoclassics',
    'itemFilter(1).name=SoldItemsOnly',
    'itemFilter(1).value=true',
    'sortOrder=EndTimeSoonest',          // most recently sold first
    'paginationInput.entriesPerPage=' + limit,
  ].join('&');

  try {
    const data = await httpsGet(
      'svcs.ebay.com',
      '/services/search/FindingService/v1?' + qs
    );

    const resp  = data.findCompletedItemsResponse?.[0];
    const items = resp?.searchResult?.[0]?.item || [];

    const listings = items
      .map(item => {
        const title    = item.title?.[0] || '';
        const rawPrice = parseFloat(
          item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.['__value__'] || '0'
        );
        if (!rawPrice) return null;                          // unsold — skip

        const price     = '$' + rawPrice.toLocaleString('en-US', { maximumFractionDigits: 0 });
        const condition = item.condition?.[0]?.conditionDisplayName?.[0] || 'Pre-Owned';
        const url       = item.viewItemURL?.[0] || null;
        const brand     = extractBrand(title);

        return { brand, model: title, condition, price, url };
      })
      .filter(Boolean);

    return res.status(200).json({ listings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
