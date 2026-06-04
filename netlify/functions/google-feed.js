// netlify/functions/google-feed.js
// Generates a Google Merchant Center product feed (RSS 2.0) from the live
// eBay inventory, so ChronoClassics watches can appear in Google Shopping.
// Reachable at /google-feed.xml (see netlify.toml redirect).

const https = require('https');

let _cachedToken = null;
let _tokenExpiry = 0;

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('Token parse error')); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('API parse error')); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getToken(appId, certId) {
  if (_cachedToken && Date.now() < _tokenExpiry) return { access_token: _cachedToken };
  const creds = Buffer.from(`${appId}:${certId}`).toString('base64');
  const body = 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope';
  const tokenData = await httpsPost('api.ebay.com', '/identity/v1/oauth2/token', {
    'Authorization': `Basic ${creds}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  }, body);
  if (tokenData.access_token) {
    _cachedToken = tokenData.access_token;
    _tokenExpiry = Date.now() + ((tokenData.expires_in || 7200) - 60) * 1000;
  }
  return tokenData;
}

function getListings(token, seller) {
  const filters = `sellers%3A%7B${encodeURIComponent(seller)}%7D`;
  const qs = `q=watch&filter=${filters}&limit=200&offset=0&sort=newlyListed&fieldgroups=EXTENDED`;
  return httpsGet('api.ebay.com', `/buy/browse/v1/item_summary/search?${qs}`, {
    'Authorization': `Bearer ${token}`,
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    'Content-Type': 'application/json',
  });
}

// Longest-first so multi-word brands match before single-word prefixes
const BRANDS = [
  'A. Lange & Söhne', 'Audemars Piguet', 'Patek Philippe', 'TAG Heuer',
  'Jaeger-LeCoultre', 'Vacheron Constantin', 'Girard-Perregaux',
  'Breitling', 'Panerai', 'Hublot', 'Cartier', 'Chopard', 'Piaget',
  'Omega', 'Rolex', 'Tudor', 'IWC', 'Longines', 'Seiko', 'Citizen',
];
function extractBrand(title) {
  const t = (title || '').toLowerCase();
  return BRANDS.find((b) => t.includes(b.toLowerCase())) || 'Luxury Watch';
}

function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

exports.handler = async function () {
  const APP_ID = process.env.EBAY_APP_ID;
  const CERT_ID = process.env.EBAY_CERT_ID;

  const headers = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
  };

  let items = [];
  try {
    if (APP_ID && CERT_ID) {
      const tokenData = await getToken(APP_ID, CERT_ID);
      if (tokenData.access_token) {
        const data = await getListings(tokenData.access_token, 'chronoclassics');
        items = (data && data.itemSummaries) || [];
      }
    }
  } catch (err) {
    items = []; // emit a valid (empty) feed rather than erroring
  }

  const entries = items.map((item) => {
    const id = item.itemId || item.legacyItemId || '';
    const title = (item.title || 'Luxury Watch').slice(0, 150);
    const link = item.itemWebUrl || 'https://chrono-classics.com/';
    const img = (item.image && item.image.imageUrl)
      ? item.image.imageUrl.replace(/s-l\d+(\.\w+)$/, 's-l800$1') : '';
    const priceVal = item.price && item.price.value ? parseFloat(item.price.value).toFixed(2) : '';
    const currency = (item.price && item.price.currency) || 'USD';
    const brand = extractBrand(item.title);
    if (!id || !priceVal || !img) return ''; // skip incomplete items

    return [
      '    <item>',
      `      <g:id>${xmlEscape(id)}</g:id>`,
      `      <title>${xmlEscape(title)}</title>`,
      `      <description>${xmlEscape(brand + ' — ' + title + '. Authenticated pre-owned luxury timepiece from ChronoClassics.')}</description>`,
      `      <link>${xmlEscape(link)}</link>`,
      `      <g:image_link>${xmlEscape(img)}</g:image_link>`,
      `      <g:price>${priceVal} ${xmlEscape(currency)}</g:price>`,
      '      <g:availability>in_stock</g:availability>',
      '      <g:condition>used</g:condition>',
      `      <g:brand>${xmlEscape(brand)}</g:brand>`,
      '      <g:google_product_category>Apparel &amp; Accessories &gt; Jewelry &gt; Watches</g:google_product_category>',
      '      <g:identifier_exists>no</g:identifier_exists>',
      '    </item>',
    ].join('\n');
  }).filter(Boolean);

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n' +
    '  <channel>\n' +
    '    <title>ChronoClassics — Pre-Owned Luxury Watches</title>\n' +
    '    <link>https://chrono-classics.com/</link>\n' +
    '    <description>Authenticated pre-owned luxury timepieces — Rolex, Cartier, Omega and more.</description>\n' +
    entries.join('\n') + (entries.length ? '\n' : '') +
    '  </channel>\n' +
    '</rss>\n';

  return { statusCode: 200, headers, body: xml };
};
