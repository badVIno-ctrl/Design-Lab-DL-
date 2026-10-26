/* В режиме «Дизайн» блокируются действия только внутри #pvFrame.
   Раньше каждые 400 мс сканировалась вся страница предпросмотра. Теперь
   защита обновляется только при загрузке кадра, смене режима или замене iframe. */
(function () {
  'use strict';
  if (window.__dlDesignInertV2) return;
  window.__dlDesignInertV2 = true;
  var SAVED = 'data-dl-inert', ATTRS = ['onclick','onsubmit','ontoggle','onchange','href','target'];
  var timer = 0, boundFrame = null;
  function norm(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function known(v) { v = norm(v); return v === 'design' || v === 'preview' || v === 'code'; }
  function modeButtons() {
    var out = { design: null, preview: null, code: null }, all = document.querySelectorAll('button,a,[role="button"],.seg,.tab,.mode,div,span');
    for (var i = 0; i < all.length; i++) { var e = all[i], t = norm(e.textContent); if (e.childElementCount > 1 || !t || t.length > 14) continue; if (!out.design && (t === 'дизайн' || t === 'design')) out.design = e; if (!out.preview && (t === 'превью' || t === 'предпросмотр' || t === 'preview')) out.preview = e; if (!out.code && (t === 'код' || t === 'code')) out.code = e; }
    return out;
  }
  function paint(e) { if (!e) return ''; var s = getComputedStyle(e); return s.backgroundColor + '|' + s.color + '|' + s.borderColor; }
  function designMode() {
    try { if (known(window.boardMode)) return norm(window.boardMode) === 'design'; if (window.current && known(window.current.sfMode)) return norm(window.current.sfMode) === 'design'; } catch (e) {}
    var b = modeButtons(); if (!b.design) return false; var other = b.preview || b.code; return !!(other && paint(b.design) !== paint(other));
  }
  function frame() { return document.getElementById('pvFrame'); }
  function frameDoc() { var f = frame(); try { return f && f.contentDocument && f.contentDocument.body ? f.contentDocument : null; } catch (e) { return null; } }
  function freeze(d) {
    var list; try { list = d.querySelectorAll('[' + ATTRS.join('],[') + ']'); } catch (e) { return; }
    for (var i = 0; i < list.length; i++) for (var j = 0; j < ATTRS.length; j++) { var n = ATTRS[j], v = list[i].getAttribute(n); if (v !== null) { list[i].setAttribute(SAVED + '-' + n, v); list[i].removeAttribute(n); } }
  }
  function thaw(d) {
    var q = '[' + SAVED + '-' + ATTRS.join('],[' + SAVED + '-') + ']', list; try { list = d.querySelectorAll(q); } catch (e) { return; }
    for (var i = 0; i < list.length; i++) for (var j = 0; j < ATTRS.length; j++) { var n = ATTRS[j], v = list[i].getAttribute(SAVED + '-' + n); if (v !== null) { list[i].setAttribute(n, v); list[i].removeAttribute(SAVED + '-' + n); } }
  }
  function soften(e) { if (!designMode()) return; var t = e.target; if (t && t.closest && t.closest('[contenteditable="true"]')) return; e.preventDefault(); }
  function hard(e) { if (!designMode()) return; e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); else e.stopPropagation(); }
  function guard(d) {
    if (d.__dlInertGuard3) return; d.__dlInertGuard3 = true; var w = d.defaultView;
    ['click','auxclick'].forEach(function (n) { if (w) w.addEventListener(n, soften, true); d.addEventListener(n, soften, true); });
    if (w) w.addEventListener('submit', hard, true); d.addEventListener('submit', hard, true);
  }
  function tick() { var d = frameDoc(); if (!d) return; guard(d); if (designMode()) freeze(d); else thaw(d); }
  function schedule() { if (timer) clearTimeout(timer); timer = setTimeout(function () { timer = 0; bind(); tick(); }, 180); }
  function bind() { var f = frame(); if (!f || f === boundFrame) return; boundFrame = f; f.addEventListener('load', schedule); }
  function frameNode(n) { try { return !!(n && n.nodeType === 1 && (n.id === 'pvFrame' || (n.querySelector && n.querySelector('#pvFrame')))); } catch (e) { return false; } }
  function start() {
    bind(); tick(); document.addEventListener('click', function (e) { var t = e.target && e.target.closest && e.target.closest('button,[role="button"],.seg,.tab,.mode'); if (!t) return; var x = norm(t.textContent); if (x === 'дизайн' || x === 'design' || x === 'превью' || x === 'предпросмотр' || x === 'preview' || x === 'код' || x === 'code') schedule(); }, true);
    if (window.MutationObserver) new MutationObserver(function (rows) { for (var i = 0; i < rows.length; i++) for (var j = 0; j < rows[i].addedNodes.length; j++) if (frameNode(rows[i].addedNodes[j])) { schedule(); return; } }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start(); window.addEventListener('load', schedule);
})();
