/* Register the ChronoClassics service worker (PWA install + offline support).
   Silent on failure — the site works identically without it. */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () { /* no-op */ });
    });
  }
})();
