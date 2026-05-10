// api/ebay-sold.js
// Fetches completed listings for chronoclassics via eBay Finding API,
// shuffles them, and returns 10 at random with images.

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

// Fisher-Yates shuffle
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const BRANDS = [
  'A. Lange & Söhne', 'Audemars Piguet', 'Patek Philippe', 'TAG Heuer',
  'Jaeger-LeCoultre', 'Vacheron Constantin', 'Girard-Perregaux',
  'Breitling', 'Panerai', 'Hublot', 'Cartier', 'Piaget',
  'Omega', 'Rolex', 'Tudor', 'IWC', 'Longines', 'Movado', 'Seiko', 'Citizen',
];

function extractBrand(title) {
  const t = title.toLowerCase();
  return BRANDS.find(b => t.startsWith(b.toLowerCase())) || title.split(' ')[0];
}

// Upgrade the thumbnail URL to a larger size
function upgradeImage(url) {
  if (!url) return '';
  return url.replace(/s-l\d+(\.\w+)$/, 's-l400$1');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Short cache — randomisation means every client gets their own fresh shuffle
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const APP_ID = process.env.EBAY_APP_ID;
  if (!APP_ID) return res.status(500).json({ error: 'Missing EBAY_APP_ID' });

  // Fetch up to 100 completed listings then pick 10 at random
  const qs = [
    'OPERATION-NAME=findCompletedItems',
    'SERVICE-VERSION=1.0.0',
    'SECURITY-APPNAME=' + encodeURIComponent(APP_ID),
    'RESPONSE-DATA-FORMAT=JSON',
    'REST-PAYLOAD',
    'keywords=watch',
    'itemFilter(0).name=Seller',
    'itemFilter(0).value=chronoclassics',
    // No SoldItemsOnly — matches LH_Complete=1 on the public eBay page
    'outputSelector=PictureURLLarge',
    'paginationInput.entriesPerPage=100',
  ].join('&');

  try {
    const data = await httpsGet(
      'svcs.ebay.com',
      '/services/search/FindingService/v1?' + qs
    );

    const resp = data.findCompletedItemsResponse?.[0];
    const ack  = resp?.ack?.[0];

    if (ack === 'Failure') {
      const msg = resp?.errorMessage?.[0]?.error?.[0]?.message?.[0] || 'eBay API error';
      return res.status(502).json({ error: msg });
    }

    const items = resp?.searchResult?.[0]?.item || [];

    const pool = items
      .map(item => {
        const title    = item.title?.[0] || '';
        const rawPrice = parseFloat(
          item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.['__value__'] || '0'
        );
        if (!rawPrice) return null;   // skip listings with no price

        const price     = '$' + rawPrice.toLocaleString('en-US', { maximumFractionDigits: 0 });
        const condition = item.condition?.[0]?.conditionDisplayName?.[0] || 'Pre-Owned';
        const url       = item.viewItemURL?.[0] || null;
        const brand     = extractBrand(title);
        const image     = upgradeImage(
          item.pictureURLLarge?.[0] || item.galleryURL?.[0] || ''
        );

        return { brand, model: title, condition, price, url, image };
      })
      .filter(Boolean);

    const listings = shuffle(pool).slice(0, 10);

    return res.status(200).json({ listings, total: pool.length });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
