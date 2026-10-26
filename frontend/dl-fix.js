/* Design Lab — runtime-слой. Исходный круглый курсор страницы не заменяется. */
(function () {
  'use strict';
  if (window.__dlFixV7) return;
  window.__dlFixV7 = true;

  var root = document.documentElement;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches);
  var coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
  var fine = !!(window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches);
  var cores = navigator.hardwareConcurrency || 8;
  var mem = navigator.deviceMemory || 8;
  var lowFx = (reduce || cores <= 2 || mem <= 2 || (coarse && innerWidth < 700 && cores <= 4)) && !fine;
  if (lowFx) root.classList.add('dl-lowfx');

  var MAG = '.btn-solid,.btn-grad,.btn-line,.plan .pick';
  var SKIP = '#cursorDot,#cursorRing,#cursorGlow,.cursor-trail,.click-ripple';
  function ignored(node) {
    var el = node && node.nodeType === 1 ? node : (node && node.parentElement);
    try { return !!(el && (el.matches(SKIP) || (el.closest && el.closest(SKIP)))); } catch (e) { return false; }
  }
  function cleanTransforms(scope) {
    var all;
    try { all = (scope || document).querySelectorAll('.btn-solid,.btn-grad,.btn-line,.btn-ghost,.plan .pick,.card[data-n],.send,#heroSendBtn,.di-btn,.di-act,.tool-btn,.icon-btn,.hero-icon-btn'); } catch (e) { return; }
    for (var i = 0; i < all.length; i++) if (all[i].style && all[i].style.transform) all[i].style.transform = '';
  }

  /* Останавливаем только magnetic/tilt-эффекты, сам курсор не трогаем. */
  document.addEventListener('mousemove', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest(MAG) || t.closest('.card[data-n]')) e.stopPropagation();
  }, true);
  if (lowFx && !fine) window.addEventListener('mousemove', function (e) { e.stopImmediatePropagation(); }, true);
  if (lowFx) {
    var bg = document.querySelector('.bg-fx');
    if (bg) { bg.style.setProperty('--mx', '0'); bg.style.setProperty('--my', '0'); }
  }

  function lazify(scope) {
    var host = scope || document, imgs, frames;
    try { imgs = host.querySelectorAll('img:not([loading])'); } catch (e) { imgs = []; }
    for (var i = 0; i < imgs.length; i++) { imgs[i].loading = 'lazy'; imgs[i].decoding = 'async'; }
    try { frames = host.querySelectorAll('iframe:not([loading])'); } catch (e) { frames = []; }
    for (var j = 0; j < frames.length; j++) {
      if (frames[j].closest && frames[j].closest('.di-wrap,#diBoard,.emu,#emuStage')) continue;
      frames[j].setAttribute('loading', 'lazy');
    }
  }
  cleanTransforms(); lazify();

  var refreshTimer = 0;
  function refresh() {
    if (refreshTimer) return;
    refreshTimer = setTimeout(function () { refreshTimer = 0; lazify(); cleanTransforms(); }, 220);
  }
  if (window.MutationObserver) new MutationObserver(function (rows) {
    for (var i = 0; i < rows.length; i++) for (var j = 0; j < rows[i].addedNodes.length; j++) {
      if (!ignored(rows[i].addedNodes[j])) { refresh(); return; }
    }
  }).observe(document.body || document.documentElement, { childList: true, subtree: true });

  function normalizeSend() {
    var send = document.getElementById('heroSendBtn');
    if (!send) return;
    send.classList.remove('btn-grad');
    send.classList.add('send', 'hero-send');
    send.setAttribute('aria-label', 'Отправить');
    send.style.transform = '';
  }
  normalizeSend();
  document.addEventListener('DOMContentLoaded', normalizeSend);
  window.addEventListener('load', function () { normalizeSend(); cleanTransforms(); });
  document.addEventListener('mouseleave', cleanTransforms, true);

  var overflowTimer = 0;
  function guardOverflow() {
    if (innerWidth > 900 || !document.body) return;
    var vw = root.clientWidth, all = document.body.querySelectorAll('body *'), fixed = 0;
    for (var i = 0; i < all.length && fixed < 40; i++) {
      var el = all[i];
      if ((el.dataset && el.dataset.dlOfFixed) || ignored(el)) continue;
      var cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.display === 'none') continue;
      var r = el.getBoundingClientRect();
      if (!r.width || (r.right <= vw + 1 && r.left >= -1)) continue;
      el.style.maxWidth = '100%'; el.style.boxSizing = 'border-box';
      if (cs.whiteSpace === 'nowrap' && cs.overflow === 'visible') { el.style.overflow = 'hidden'; el.style.textOverflow = 'ellipsis'; }
      if (el.dataset) el.dataset.dlOfFixed = '1'; fixed++;
    }
  }
  function scheduleOverflow() { if (overflowTimer) clearTimeout(overflowTimer); overflowTimer = setTimeout(guardOverflow, 300); }
  window.addEventListener('load', scheduleOverflow);
  window.addEventListener('resize', scheduleOverflow, { passive: true });
  window.addEventListener('orientationchange', scheduleOverflow, { passive: true });
  window.__dlFixReport = function () { return { lowFx: lowFx, originalCursorPreserved: true, cursorOn: root.classList.contains('cursor-on') }; };
})();
