// api/ebay-sold.js
// Returns 10 random watches from the chronoclassics eBay store with images.
// Uses the Browse API (same auth as ebay-listings.js).

const https = require('https');

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('Token parse error: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers }, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('API parse error: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getToken(appId, certId) {
  const creds = Buffer.from(`${appId}:${certId}`).toString('base64');
  const body  = 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope';
  return httpsPost('api.ebay.com', '/identity/v1/oauth2/token', {
    'Authorization':  `Basic ${creds}`,
    'Content-Type':   'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  }, body);
}

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const APP_ID  = process.env.EBAY_APP_ID;
  const CERT_ID = process.env.EBAY_CERT_ID;
  if (!APP_ID || !CERT_ID) return res.status(500).json({ error: 'Missing env vars' });

  try {
    const tokenData = await getToken(APP_ID, CERT_ID);
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'Token error', detail: tokenData });
    }

    // Fetch up to 50 listings so we have a good pool to shuffle from
    const filter = `sellers%3A%7Bchronoclassics%7D`;
    const qs = `q=watch&filter=${filter}&limit=50&fieldgroups=EXTENDED`;

    const data = await httpsGet(
      'api.ebay.com',
      `/buy/browse/v1/item_summary/search?${qs}`,
      {
        'Authorization':            `Bearer ${tokenData.access_token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type':             'application/json',
      }
    );

    const items = data.itemSummaries || [];

    const pool = items.map(item => {
      const title    = item.title || '';
      const rawPrice = parseFloat(item.price?.value || '0');
      if (!rawPrice) return null;

      const price     = '$' + rawPrice.toLocaleString('en-US', { maximumFractionDigits: 0 });
      const condition = item.condition || 'Pre-Owned';
      const url       = item.itemWebUrl || null;
      const brand     = extractBrand(title);

      // Use the best available image, upgrade to 400px
      const rawImg = item.thumbnailImages?.[0]?.imageUrl
                  || item.image?.imageUrl
                  || '';
      const image = rawImg.replace(/s-l\d+(\.\w+)$/, 's-l400$1');

      return { brand, model: title, condition, price, url, image };
    }).filter(Boolean);

    const listings = shuffle(pool).slice(0, 10);
    return res.status(200).json({ listings });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
