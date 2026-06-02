/* ChronoClassics — reading progress bar for long-form blog articles.
   Fills a thin gold bar across the top as the reader scrolls the page.
   Only runs where #readingProgress exists (blog article pages). */
(function () {
  'use strict';
  var bar = document.getElementById('readingProgress');
  if (!bar) return;

  var ticking = false;
  function update() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var p = max > 0 ? window.scrollY / max : 0;
    if (p < 0) p = 0; else if (p > 1) p = 1;
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    ticking = false;
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();
