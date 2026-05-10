// api/ebay-sold.js
// Fetches completed listings by scraping the public eBay page,
// falls back to Browse API active listings if eBay blocks the request.

const https = require('https');
const zlib  = require('zlib');

// ── HTTP helpers ─────────────────────────────────────────────────────

function httpsGetRaw(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: 'GET', headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const enc = (res.headers['content-encoding'] || '').toLowerCase();
          if (enc === 'gzip') {
            zlib.gunzip(buf, (err, out) => err ? reject(err) : resolve({ status: res.statusCode, body: out.toString('utf8') }));
          } else if (enc === 'br') {
            zlib.brotliDecompress(buf, (err, out) => err ? reject(err) : resolve({ status: res.statusCode, body: out.toString('utf8') }));
          } else {
            resolve({ status: res.statusCode, body: buf.toString('utf8') });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGetJson(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers }, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Utilities ────────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const BRANDS = [
  'A. Lange & Söhne','Audemars Piguet','Patek Philippe','TAG Heuer',
  'Jaeger-LeCoultre','Vacheron Constantin','Girard-Perregaux',
  'Breitling','Panerai','Hublot','Cartier','Piaget',
  'Omega','Rolex','Tudor','IWC','Longines','Movado','Seiko','Citizen',
];
function extractBrand(title) {
  const t = title.toLowerCase();
  return BRANDS.find(b => t.startsWith(b.toLowerCase())) || title.split(' ')[0];
}
function upgradeImg(url) {
  return (url || '').replace(/s-l\d+(\.\w+)$/, 's-l500$1');
}

// ── Approach 1: Scrape eBay completed-listings page ──────────────────

async function scrapeCompleted(seller) {
  const path = `/sch/i.html?_ssn=${encodeURIComponent(seller)}&LH_Complete=1&LH_Sold=1&_ipg=96&_sop=10`;
  const { status, body } = await httpsGetRaw('www.ebay.com', path, {
    'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, br',
  });

  if (status !== 200 || body.length < 5000) return [];

  const items = [];

  // Try JSON-LD first (most reliable)
  const ldMatch = body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      const elements = ld.itemListElement || [];
      for (const el of elements) {
        const item = el.item || el;
        const name  = item.name || '';
        const price = item.offers?.price || item.offers?.lowPrice;
        const url   = item.url || item['@id'] || '';
        const image = item.image || '';
        if (name && price) {
          items.push({
            brand:     extractBrand(name),
            model:     name,
            condition: 'Pre-Owned',
            price:     '$' + parseFloat(price).toLocaleString('en-US', { maximumFractionDigits: 0 }),
            url,
            image:     upgradeImg(Array.isArray(image) ? image[0] : image),
          });
        }
      }
      if (items.length >= 3) return items;
    } catch (_) {}
  }

  // Fallback: regex parse s-item blocks
  const blocks = body.match(/<li[^>]+s-item[^>]*>[\s\S]*?<\/li>/g) || [];
  for (const block of blocks) {
    const titleM  = block.match(/s-item__title[^>]*>([^<]+)<\/(?:span|h3)>/);
    const priceM  = block.match(/s-item__price[^>]*>\s*\$?([\d,]+\.?\d*)/);
    const hrefM   = block.match(/href="(https:\/\/www\.ebay\.com\/itm\/[^"]+)"/);
    const imgM    = block.match(/src="(https:\/\/i\.ebayimg\.com[^"]+)"/);
    const title   = (titleM?.[1] || '').trim().replace(/^Shop on eBay$/, '');
    const rawP    = parseFloat((priceM?.[1] || '').replace(/,/g, ''));
    if (!title || !rawP || title === 'Shop on eBay') continue;
    items.push({
      brand:     extractBrand(title),
      model:     title,
      condition: 'Pre-Owned',
      price:     '$' + rawP.toLocaleString('en-US', { maximumFractionDigits: 0 }),
      url:       hrefM?.[1] || null,
      image:     upgradeImg(imgM?.[1] || ''),
    });
  }
  return items;
}

// ── Approach 2: Browse API active listings (reliable fallback) ────────

async function getToken(appId, certId) {
  const creds = Buffer.from(`${appId}:${certId}`).toString('base64');
  const body  = 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope';
  return httpsPost('api.ebay.com', '/identity/v1/oauth2/token', {
    'Authorization':  `Basic ${creds}`,
    'Content-Type':   'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
  }, body);
}

async function getBrowseListings(appId, certId) {
  const tok = await getToken(appId, certId);
  if (!tok.access_token) throw new Error('No token');
  const qs = `q=watch&filter=sellers%3A%7Bchronoclassics%7D&limit=50&fieldgroups=EXTENDED`;
  const data = await httpsGetJson('api.ebay.com', `/buy/browse/v1/item_summary/search?${qs}`, {
    'Authorization':            `Bearer ${tok.access_token}`,
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    'Content-Type':             'application/json',
  });
  return (data.itemSummaries || []).map(item => ({
    brand:     extractBrand(item.title || ''),
    model:     item.title || '',
    condition: item.condition || 'Pre-Owned',
    price:     item.price ? '$' + parseFloat(item.price.value).toLocaleString('en-US', { maximumFractionDigits: 0 }) : null,
    url:       item.itemWebUrl || null,
    image:     upgradeImg(item.thumbnailImages?.[0]?.imageUrl || item.image?.imageUrl || ''),
  })).filter(i => i.price);
}

// ── Handler ──────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const APP_ID  = process.env.EBAY_APP_ID;
  const CERT_ID = process.env.EBAY_CERT_ID;

  let pool = [];
  let source = 'none';

  // Try scraping completed listings first
  try {
    pool = await scrapeCompleted('chronoclassics');
    if (pool.length >= 3) source = 'scraped';
  } catch (_) {}

  // Fall back to Browse API if scraping failed
  if (pool.length < 3 && APP_ID && CERT_ID) {
    try {
      pool = await getBrowseListings(APP_ID, CERT_ID);
      if (pool.length) source = 'browse';
    } catch (_) {}
  }

  const listings = shuffle(pool).slice(0, 10);
  return res.status(200).json({ listings, source, total: pool.length });
};
