// netlify/functions/ebay-sold.js
// Returns recently-sold completed eBay listings for the chronoclassics seller.
// Uses the eBay Finding API (no OAuth — App ID only via EBAY_APP_ID env var).

const https = require('https');

function httpsGet(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET' }, res => {
      let d = '';
      res.on('data', c => (d += c));
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
  'Breitling', 'Panerai', 'Hublot', 'Cartier',
  'Omega', 'Rolex', 'Tudor', 'IWC', 'Longines', 'Seiko', 'Citizen',
];

function extractBrand(title) {
  const t = title.toLowerCase();
  return BRANDS.find(b => t.startsWith(b.toLowerCase())) || title.split(' ')[0];
}

exports.handler = async function (event) {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control':                'public, max-age=300, s-maxage=300',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  const APP_ID = process.env.EBAY_APP_ID;
  if (!APP_ID) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Missing EBAY_APP_ID env var' }),
    };
  }

  const params = event.queryStringParameters || {};
  const limit  = Math.min(parseInt(params.limit) || 20, 50);

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
    'sortOrder=EndTimeSoonest',
    'paginationInput.entriesPerPage=' + limit,
  ].join('&');

  try {
    const data  = await httpsGet('svcs.ebay.com', '/services/search/FindingService/v1?' + qs);
    const topKeys = Object.keys(data);
    const resp  = data.findCompletedItemsResponse?.[0];
    const ack   = resp?.ack?.[0];
    if (!resp || ack !== 'Success') {
      return { statusCode: 200, headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ listings: [], debug: { topKeys, ack, rawResp: JSON.stringify(data).slice(0, 500) } }) };
    }
    const items = resp?.searchResult?.[0]?.item || [];

    const listings = items
      .map(item => {
        const title    = item.title?.[0] || '';
        const rawPrice = parseFloat(
          item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.['__value__'] || '0'
        );
        if (!rawPrice) return null;   // unsold — skip

        const price     = '$' + rawPrice.toLocaleString('en-US', { maximumFractionDigits: 0 });
        const condition = item.condition?.[0]?.conditionDisplayName?.[0] || 'Pre-Owned';
        const url       = item.viewItemURL?.[0] || null;
        const image     = item.pictureURLLarge?.[0] || item.galleryURL?.[0] || null;
        const brand     = extractBrand(title);

        return { brand, model: title, condition, price, url, image };
      })
      .filter(Boolean);

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
