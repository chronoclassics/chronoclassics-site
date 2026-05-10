// api/ebay-sold.js — Completed (sold) listings via eBay Finding API
const https = require('https');

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET' }, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('Parse error: ' + d.slice(0, 300))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const BRANDS = [
  'A. Lange & Söhne', 'Audemars Piguet', 'Patek Philippe', 'TAG Heuer',
  'Jaeger-LeCoultre', 'Vacheron Constantin', 'Girard-Perregaux',
  'Breitling', 'Panerai', 'Hublot', 'Cartier',
  'Omega', 'Rolex', 'Tudor', 'IWC', 'Longines', 'Movado', 'Seiko', 'Citizen',
];

function extractBrand(title) {
  const t = title.toLowerCase();
  return BRANDS.find(b => t.startsWith(b.toLowerCase())) || title.split(' ')[0];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');          // no caching while debugging

  if (req.method === 'OPTIONS') return res.status(200).end();

  const APP_ID = process.env.EBAY_APP_ID;
  if (!APP_ID) return res.status(500).json({ error: 'Missing EBAY_APP_ID' });

  const limit = Math.min(parseInt((req.query || {}).limit) || 20, 50);

  // eBay Finding API — findCompletedItems with SoldItemsOnly filter
  const params = [
    'OPERATION-NAME=findCompletedItems',
    'SERVICE-VERSION=1.0.0',
    'SECURITY-APPNAME=' + encodeURIComponent(APP_ID),
    'RESPONSE-DATA-FORMAT=JSON',
    'REST-PAYLOAD',
    'keywords=watch',
    'itemFilter(0).name=Seller',
    'itemFilter(0).value=chronoclassics',
    'itemFilter(1).name=SoldItemsOnly',
    'itemFilter(1).value=true',
    'sortOrder=EndTimeSoonest',
    'paginationInput.entriesPerPage=' + limit,
  ].join('&');

  try {
    const data = await httpsGet(
      'svcs.ebay.com',
      '/services/search/FindingService/v1?' + params
    );

    // Surface eBay errors so we can see them
    const resp = data.findCompletedItemsResponse?.[0];
    const ack  = resp?.ack?.[0];
    if (ack === 'Failure' || ack === 'PartialSuccess') {
      const msg = resp?.errorMessage?.[0]?.error?.[0]?.message?.[0] || 'Unknown eBay error';
      return res.status(502).json({ error: msg, ack, raw: resp });
    }

    const items = resp?.searchResult?.[0]?.item || [];

    const listings = items.map(item => {
      const title    = item.title?.[0] || '';
      const rawPrice = parseFloat(
        item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.['__value__'] || '0'
      );
      if (!rawPrice) return null;

      const price     = '$' + rawPrice.toLocaleString('en-US', { maximumFractionDigits: 0 });
      const condition = item.condition?.[0]?.conditionDisplayName?.[0] || 'Pre-Owned';
      const url       = item.viewItemURL?.[0] || null;
      const brand     = extractBrand(title);

      return { brand, model: title, condition, price, url };
    }).filter(Boolean);

    const total = parseInt(resp?.paginationOutput?.[0]?.totalEntries?.[0] || '0');

    return res.status(200).json({ listings, total });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
