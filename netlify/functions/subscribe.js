// netlify/functions/subscribe.js
// Adds a subscriber email to the Resend audience.
// Called by the newsletter form at POST /api/subscribe.
const https = require('https');

function resendGet(path, key) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com', path, method: 'GET',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch (e) { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function resendPost(path, key, payload) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.resend.com', path, method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
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
    req.write(bodyStr);
    req.end();
  });
}

const CORS = {
  'Access-Control-Allow-Origin': 'https://chrono-classics.com',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const KEY = process.env.RESEND_API_KEY;
  if (!KEY) {
    console.error('RESEND_API_KEY not set');
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  let email;
  try {
    email = (JSON.parse(event.body || '{}').email || '').trim().toLowerCase();
  } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid email address' }) };
  }

  try {
    // Fetch the first (and only) audience
    const audienceRes = await resendGet('/audiences', KEY);
    const audiences = (audienceRes.body && audienceRes.body.data) || [];
    if (!audiences.length) {
      console.error('No Resend audiences found');
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'No audience configured' }) };
    }
    const audienceId = audiences[0].id;

    // Create contact (idempotent — Resend handles duplicates gracefully)
    const res = await resendPost(`/audiences/${audienceId}/contacts`, KEY, {
      email,
      unsubscribed: false
    });

    if (res.status === 200 || res.status === 201) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
    }

    // Resend returns 409 for existing contacts — still a success for us
    if (res.status === 409) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
    }

    console.error('Resend contact error:', res.status, res.body);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Subscription failed' }) };

  } catch (err) {
    console.error('subscribe error:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
