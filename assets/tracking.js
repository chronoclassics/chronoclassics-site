/* ChronoClassics — retargeting pixels (Meta + Google Ads).
   ────────────────────────────────────────────────────────────────────────
   HOW TO TURN ON:
   1. Meta:  create a pixel at facebook.com/events_manager → paste its ID below.
   2. Google Ads: in Google Ads → Tools → Audience manager → your tag ID
      (looks like "AW-1234567890") → paste it below.
   Leave a value as '' to keep that pixel OFF. Nothing fires until an ID is set,
   so this file is safe to ship empty.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  var META_PIXEL_ID = '';          // e.g. '1234567890123456'
  var GOOGLE_ADS_ID = '';          // e.g. 'AW-1234567890'

  // ── Meta (Facebook/Instagram) Pixel ──
  if (META_PIXEL_ID) {
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  // ── Google Ads (reuses gtag.js already loaded for Analytics) ──
  if (GOOGLE_ADS_ID && typeof window.gtag === 'function') {
    window.gtag('config', GOOGLE_ADS_ID);
  }
})();
