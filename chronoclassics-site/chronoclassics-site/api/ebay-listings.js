const https = require('https');

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('Token parse error: ' + d.slice(0,200))); } });
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
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('API parse error: ' + d.slice(0,200))); } });
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
    'Content-Length': Buffer.byteLength(body)
  }, body);
}

async function getListings(token, seller, params) {
  const q        = params.q        || 'watch';
  const sort     = params.sort     || 'newlyListed';
  const limit    = Math.min(parseInt(params.limit) || 24, 50);
  const minPrice = params.minPrice;
  const maxPrice = params.maxPrice;

  let filters = `sellers%3A%7B${encodeURIComponent(seller)}%7D`;
  if (minPrice || maxPrice) {
    const lo = minPrice || '0';
    const hi = maxPrice || '100000';
    filters += `,price%3A%5B${lo}..${hi}%5D,priceCurrency%3AUSD`;
  }

  const fieldgroups = params.fieldgroups || 'EXTENDED';
  const qs = `q=${encodeURIComponent(q)}&filter=${filters}&limit=${limit}&sort=${encodeURIComponent(sort)}&fieldgroups=${encodeURIComponent(fieldgroups)}`;

  return httpsGet('api.ebay.com', `/buy/browse/v1/item_summary/search?${qs}`, {
    'Authorization':            `Bearer ${token}`,
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    'Content-Type':             'application/json'
  });
}

// ── Vercel serverless function handler ──────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control',                'no-cache');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const APP_ID  = process.env.EBAY_APP_ID;
  const CERT_ID = process.env.EBAY_CERT_ID;
  const params  = req.query || {};

  if (!APP_ID || !CERT_ID) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  try {
    const tokenData = await getToken(APP_ID, CERT_ID);
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'Token error', detail: tokenData });
    }
    const listings = await getListings(tokenData.access_token, 'chronoclassics', params);
    return res.status(200).json(listings);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
