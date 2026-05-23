// netlify/functions/notify-new-listings.js
// Scheduled daily — fetches eBay listings, detects new ones,
// and broadcasts a newsletter via Resend to all subscribers.
//
// Schedule: configured in netlify.toml
// Manual trigger: POST /.netlify/functions/notify-new-listings
const https = require('https');
const { getStore } = require('@netlify/blobs');

// ── eBay token cache ──────────────────────────────────────────────────────────
let _cachedToken = null;
let _tokenExpiry = 0;

function httpsRequest(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('Parse error: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getEbayToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
  const creds = Buffer.from(`${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`).toString('base64');
  const body  = 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope';
  const data  = await httpsRequest('POST', 'api.ebay.com', '/identity/v1/oauth2/token', {
    'Authorization':  `Basic ${creds}`,
    'Content-Type':   'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body)
  }, body);
  if (data.access_token) {
    _cachedToken = data.access_token;
    _tokenExpiry = Date.now() + ((data.expires_in || 7200) - 60) * 1000;
  }
  return data.access_token;
}

// ── Resend helpers ────────────────────────────────────────────────────────────
function resendRequest(method, path, payload) {
  return new Promise((resolve, reject) => {
    const bodyStr = payload ? JSON.stringify(payload) : '';
    const req = https.request({
      hostname: 'api.resend.com', path, method,
      headers: {
        'Authorization':  `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':   'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Title cleanup (mirrors index.html cleanTitle) ─────────────────────────────
function cleanTitle(raw) {
  return (raw || '')
    .replace(/\s*(?:(?:w\/?\s*)?box\s*(?:&\s*(?:papers?|card)?)?|b\s*&\s*p(?:['']?s)?|&\s*papers?)\s*$/gi, '')
    .replace(/[\s&/]+$/, '')
    .trim()
    .replace(/\b([A-Z]{2,})\b/g, word => {
      const keep = { GMT:'GMT', IWC:'IWC', TAG:'TAG', AP:'AP', NOS:'NOS', GP:'GP' };
      return keep[word] || (word.charAt(0) + word.slice(1).toLowerCase());
    })
    .replace(/\b([a-z])/g, c => c.toUpperCase());
}

// ── Email HTML builder ────────────────────────────────────────────────────────
function buildEmailHtml(items) {
  const count  = items.length;
  const shown  = items.slice(0, 6);

  const cards = shown.map(item => {
    const title = cleanTitle(item.title);
    const price = (item.price && item.price.value)
      ? parseFloat(item.price.value).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      : '';
    const img = (item.image && item.image.imageUrl)
      ? item.image.imageUrl.replace(/s-l\d+(\.\w+)$/, 's-l400$1')
      : '';
    const url = item.itemWebUrl || 'https://chrono-classics.com/#listings';
    const safeTitle = title.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `
      <tr>
        <td style="padding:0 0 16px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#161616;border:1px solid #252525;border-radius:8px;overflow:hidden;">
            <tr>
              ${img ? `<td width="110" style="padding:14px 0 14px 14px;vertical-align:middle;">
                <a href="${url}" target="_blank" style="display:block;">
                  <img src="${img}" width="96" height="96" alt="${safeTitle}"
                       style="display:block;border-radius:6px;width:96px;height:96px;object-fit:cover;" />
                </a>
              </td>` : ''}
              <td style="padding:14px 16px;vertical-align:middle;">
                <p style="margin:0 0 5px 0;font-family:Georgia,'Times New Roman',serif;
                          font-size:15px;font-weight:600;color:#f0e4c4;line-height:1.35;">
                  <a href="${url}" target="_blank" style="color:#f0e4c4;text-decoration:none;">${safeTitle}</a>
                </p>
                ${price ? `<p style="margin:0 0 12px 0;font-family:Arial,sans-serif;
                              font-size:14px;font-weight:700;color:#c9a962;">${price}</p>` : ''}
                <a href="${url}" target="_blank"
                   style="display:inline-block;padding:7px 16px;background:#a68b3a;color:#000;
                          font-family:Arial,sans-serif;font-size:11px;font-weight:700;
                          text-decoration:none;border-radius:3px;letter-spacing:0.8px;">
                  VIEW WATCH →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  const headline = count === 1
    ? 'A New Watch Just Landed'
    : `${count} New Watches Just Landed`;
  const subline = count === 1
    ? 'A fresh piece has been added to our collection. These tend to move quickly.'
    : `${count} fresh pieces have been added to our collection. These tend to move quickly.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
  <tr>
    <td align="center" style="padding:40px 20px 48px;">
      <table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;">

        <!-- Logo -->
        <tr>
          <td style="padding:0 0 28px;text-align:center;border-bottom:1px solid #1e1e1e;">
            <p style="margin:0 0 3px;font-family:Georgia,'Times New Roman',serif;
                      font-size:24px;font-weight:700;color:#f0e4c4;letter-spacing:3px;">
              CHRONOCLASSICS
            </p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;
                      color:#a68b3a;letter-spacing:5px;text-transform:uppercase;">
              Luxury Timepieces
            </p>
          </td>
        </tr>

        <!-- Headline -->
        <tr>
          <td style="padding:28px 0 22px;text-align:center;">
            <p style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;
                      font-size:22px;color:#f0e4c4;line-height:1.3;">
              ${headline}
            </p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;
                      color:#777;line-height:1.7;max-width:420px;margin-left:auto;margin-right:auto;">
              ${subline}
            </p>
          </td>
        </tr>

        <!-- Watch cards -->
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              ${cards}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:10px 0 44px;text-align:center;">
            <a href="https://chrono-classics.com/#listings" target="_blank"
               style="display:inline-block;padding:13px 30px;background:#a68b3a;color:#000;
                      font-family:Arial,sans-serif;font-size:12px;font-weight:700;
                      text-decoration:none;border-radius:3px;letter-spacing:1.2px;">
              BROWSE FULL COLLECTION →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 0 0;border-top:1px solid #161616;text-align:center;">
            <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;color:#444;line-height:1.7;">
              ChronoClassics &nbsp;·&nbsp; (917) 480-1080 &nbsp;·&nbsp;
              <a href="mailto:sales@chrono-classics.com" style="color:#555;text-decoration:none;">
                sales@chrono-classics.com
              </a>
            </p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#383838;">
              You're receiving this because you signed up for watch alerts.&nbsp;
              <a href="{{ unsubscribe_url }}" style="color:#555;text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  const KEY      = process.env.RESEND_API_KEY;
  const APP_ID   = process.env.EBAY_APP_ID;
  const CERT_ID  = process.env.EBAY_CERT_ID;

  if (!KEY || !APP_ID || !CERT_ID) {
    console.error('Missing env vars: RESEND_API_KEY / EBAY_APP_ID / EBAY_CERT_ID');
    return { statusCode: 500, body: 'Missing env vars' };
  }

  try {
    // ── 1. Fetch current eBay listings ──────────────────────────────
    const token = await getEbayToken();
    const ebay  = await httpsRequest('GET', 'api.ebay.com',
      '/buy/browse/v1/item_summary/search?q=watch&filter=sellers%3A%7Bchronoclassics%7D&limit=50&sort=newlyListed&fieldgroups=EXTENDED',
      {
        'Authorization':             `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID':   'EBAY_US',
        'Content-Type':              'application/json'
      }, null
    );

    const currentItems = ebay.itemSummaries || [];
    const currentIds   = new Set(currentItems.map(i => i.itemId));

    // ── 2. Load previously seen IDs ────────────────────────────────
    const store = getStore('notify-state');
    let seenIds = new Set();
    try {
      const raw = await store.get('seen-listing-ids');
      if (raw) seenIds = new Set(JSON.parse(raw));
    } catch (e) {
      console.log('First run — no previous state found.');
    }

    // ── 3. Detect new listings ─────────────────────────────────────
    const newItems = currentItems.filter(i => !seenIds.has(i.itemId));
    console.log(`Total: ${currentItems.length} | Previously seen: ${seenIds.size} | New: ${newItems.length}`);

    // ── 4. Always update seen IDs ──────────────────────────────────
    await store.set('seen-listing-ids', JSON.stringify([...currentIds]));

    if (newItems.length === 0) {
      return { statusCode: 200, body: 'No new listings. Nothing sent.' };
    }

    // ── 5. Get Resend audience ID ──────────────────────────────────
    const audienceRes = await resendRequest('GET', '/audiences', null);
    const audiences   = (audienceRes.body && audienceRes.body.data) || [];
    if (!audiences.length) {
      return { statusCode: 500, body: 'No Resend audience found' };
    }
    const audienceId = audiences[0].id;

    // ── 6. Create broadcast ────────────────────────────────────────
    const subject = newItems.length === 1
      ? '🕐 New watch just listed — ChronoClassics'
      : `🕐 ${newItems.length} new watches just listed — ChronoClassics`;

    const broadcastRes = await resendRequest('POST', '/broadcasts', {
      audience_id: audienceId,
      from:        'ChronoClassics <sales@chrono-classics.com>',
      reply_to:    'sales@chrono-classics.com',
      subject,
      html:        buildEmailHtml(newItems)
    });

    if (!broadcastRes.body || !broadcastRes.body.id) {
      console.error('Broadcast creation failed:', broadcastRes.status, broadcastRes.body);
      return { statusCode: 500, body: 'Failed to create broadcast' };
    }

    // ── 7. Send broadcast ──────────────────────────────────────────
    const sendRes = await resendRequest('POST', `/broadcasts/${broadcastRes.body.id}/send`, {});
    console.log('Broadcast sent:', sendRes.body);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newListings: newItems.length, broadcastId: broadcastRes.body.id })
    };

  } catch (err) {
    console.error('notify-new-listings error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
