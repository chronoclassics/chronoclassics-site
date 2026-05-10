// api/ebay-sold.js — Recently sold listings
// Uses the same Browse API + OAuth as api/ebay-listings.js
// (EBAY_APP_ID + EBAY_CERT_ID env vars, already set in Vercel)

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=1800');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const APP_ID  = process.env.EBAY_APP_ID;
  const CERT_ID = process.env.EBAY_CERT_ID;

  if (!APP_ID || !CERT_ID) {
    return res.status(500).json({ error: 'Missing EBAY_APP_ID or EBAY_CERT_ID env var' });
  }

  const limit = Math.min(parseInt((req.query || {}).limit) || 20, 50);

  try {
    // Finding API — findCompletedItems with SoldItemsOnly
    // Only needs APP_ID (no OAuth)
    const qs = [
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

    const raw = await httpsGet(
      'svcs.ebay.com',
      '/services/search/FindingService/v1?' + qs
    );

    // Return full raw response so we can inspect it
    return res.status(200).json({ _raw: raw });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
