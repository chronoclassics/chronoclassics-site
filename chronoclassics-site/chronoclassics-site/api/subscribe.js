// api/subscribe.js — Newsletter subscription via Mailchimp
// Required env vars (set in Vercel dashboard):
//   MAILCHIMP_API_KEY  e.g. "abc123def456...–us21"
//   MAILCHIMP_LIST_ID  your Audience / List ID

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID;

  if (!apiKey || !listId) {
    console.error('Missing MAILCHIMP_API_KEY or MAILCHIMP_LIST_ID env vars');
    return res.status(500).json({ error: 'Newsletter service is not configured yet.' });
  }

  // Datacenter is the suffix after the last dash in the API key (e.g. "us21")
  const dc = apiKey.split('-').pop();
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'apikey ' + apiKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        status:        'subscribed',
        tags:          ['website-signup'],
      }),
    });

    const data = await response.json();

    // Already subscribed — treat as success so UX stays smooth
    if (!response.ok && data.title === 'Member Exists') {
      return res.status(200).json({ success: true, already: true });
    }

    if (!response.ok) {
      console.error('Mailchimp error:', data);
      return res.status(500).json({ error: data.detail || 'Subscription failed. Please try again.' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Subscribe handler error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
