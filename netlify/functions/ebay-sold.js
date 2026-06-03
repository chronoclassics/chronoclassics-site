// netlify/functions/ebay-sold.js
// Returns recently-sold completed eBay listings for the chronoclassics seller.
// Uses the eBay Finding API (no OAuth — App ID only via EBAY_APP_ID env var).
// Falls back to static curated listings if the API is unavailable / rate-limited.

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

// Static curated sold listings — shown when eBay API is unavailable / rate-limited
const STATIC_LISTINGS = [
  {
    brand: 'Rolex',
    model: 'Cosmograph Daytona · Ref. 116523 Gold & Steel',
    condition: 'Excellent — Verified Authentic',
    price: '$18,495',
    url: 'https://www.ebay.com/itm/800037944526',
    image: 'https://i.ebayimg.com/images/g/HQUAAeSw6YZqC4NR/s-l500.jpg',
  },
  {
    brand: 'Rolex',
    model: 'ROLEX COSMOGRAPH DAYTONA 116520 White Dial 40mm · Full Set B&P',
    condition: 'Pre-Owned',
    price: '$22,000',
    url: 'https://www.ebay.com/itm/389788130722',
    image: 'https://i.ebayimg.com/images/g/uycAAeSwnQ1pnU6l/s-l500.jpg',
  },
  {
    brand: 'Rolex',
    model: 'ROLEX SEA-DWELLER 126600 43mm Red Letters Black Ceramic Steel · Box & Tags',
    condition: 'Pre-Owned',
    price: '$11,500',
    url: 'https://www.ebay.com/itm/389867848673',
    image: 'https://i.ebayimg.com/images/g/b3kAAeSw1rlp1-aZ/s-l500.jpg',
  },
  {
    brand: 'Rolex',
    model: 'ROLEX MILGAUSS 116400GV Oyster Perpetual 40mm Green Crystal · Box',
    condition: 'Pre-Owned',
    price: '$9,600',
    url: 'https://www.ebay.com/itm/389704125510',
    image: 'https://i.ebayimg.com/images/g/0jwAAeSwodJpgSd-/s-l500.jpg',
  },
  {
    brand: 'Cartier',
    model: 'CARTIER BALLON BLEU 36MM 18K Gold Factory Diamonds Automatic WE900651 · B&P',
    condition: 'Pre-Owned',
    price: '$12,000',
    url: 'https://www.ebay.com/itm/388917630376',
    image: 'https://i.ebayimg.com/images/g/vkIAAeSwyqlo5TZf/s-l500.jpg',
  },
  {
    brand: 'Cartier',
    model: 'CARTIER BALLON BLEU 42mm WSBB0025 Automatic Blue Dial Crocodile Strap · B&P',
    condition: 'Pre-Owned',
    price: '$4,400',
    url: 'https://www.ebay.com/itm/389895410827',
    image: 'https://i.ebayimg.com/images/g/s2IAAeSwamJp4Cxa/s-l500.jpg',
  },
  {
    brand: 'Cartier',
    model: 'CARTIER PANTHERE 27mm 2024 Stainless Steel Ladies Watch Ref. WSPN0007 · B&P',
    condition: 'Pre-Owned',
    price: '$5,000',
    url: 'https://www.ebay.com/itm/389872394381',
    image: 'https://i.ebayimg.com/images/g/8AEAAeSw-Bhp2S5E/s-l500.jpg',
  },
  {
    brand: 'Jaeger-LeCoultre',
    model: 'JAEGER-LECOULTRE Master Ultra Thin Reserve de Marche Automatic Q1378420 · B&P',
    condition: 'Pre-Owned',
    price: '$5,500',
    url: 'https://www.ebay.com/itm/389199086804',
    image: 'https://i.ebayimg.com/images/g/V6cAAeSwo5ZpDC5W/s-l500.jpg',
  },
  {
    brand: 'Breitling',
    model: 'BREITLING OLD NAVITIMER D13322 Chronograph 18k Gold & Steel · Full Set',
    condition: 'Pre-Owned',
    price: '$4,695',
    url: 'https://www.ebay.com/itm/389887075896',
    image: 'https://i.ebayimg.com/images/g/rtkAAeSwajBp3YlI/s-l500.jpg',
  },
  {
    brand: 'Omega',
    model: 'OMEGA SPEEDMASTER Torino Olympic Games Collection 3836.70.36 MOP Dial · B&P',
    condition: 'Pre-Owned',
    price: '$3,100',
    url: 'https://www.ebay.com/itm/389317662175',
    image: 'https://i.ebayimg.com/images/g/k8gAAeSwFhRpLeeZ/s-l500.jpg',
  },
  {
    brand: 'Chopard',
    model: 'CHOPARD CASMIR Mother of Pearl 18K Gold & Steel Ladies Quartz Watch · Box',
    condition: 'Pre-Owned',
    price: '$3,500',
    url: 'https://www.ebay.com/itm/388820699714',
    image: 'https://i.ebayimg.com/images/g/cKgAAeSwe7pomRw9/s-l500.jpg',
  },
];

exports.handler = async function (event) {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control':                'public, max-age=3600, s-maxage=3600',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  const APP_ID = process.env.EBAY_APP_ID;
  const params = event.queryStringParameters || {};
  const limit  = Math.min(parseInt(params.limit) || 20, 50);

  // Try eBay Finding API if we have a key
  if (APP_ID) {
    try {
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

      const data  = await httpsGet('svcs.ebay.com', '/services/search/FindingService/v1?' + qs);
      const resp  = data.findCompletedItemsResponse?.[0];
      const ack   = resp?.ack?.[0];

      if (resp && ack === 'Success') {
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

        if (listings.length > 0) {
          return {
            statusCode: 200,
            headers: { ...cors, 'Content-Type': 'application/json' },
            body: JSON.stringify({ listings, source: 'live' }),
          };
        }
      }
    } catch (err) {
      // Fall through to static data
    }
  }

  // Fallback: return curated static listings
  const listings = STATIC_LISTINGS.slice(0, limit);
  return {
    statusCode: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify({ listings, source: 'static' }),
  };
};
