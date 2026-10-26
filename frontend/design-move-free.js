/* Design Lab — свободное перетаскивание блоков в режиме Design, как в конструкторе.

   В основном редакторе (ИИ пишет готовый HTML в превью) до сих пор можно было
   править текст и тянуть размер, но не двигать блоки. Здесь добавляется именно
   перемещение: у наведённого блока в углу появляется круглая ручка, за неё блок
   перетаскивается. Сдвиг задаётся через transform: translate(...) — ровно как
   «свободный сдвиг» узлов в SF-конструкторе (shiftX/shiftY), поток документа при
   этом не ломается, соседние блоки не прыгают.

   Аккуратность прежде всего — фича «поверх», ничего не ломает:
     • работает ТОЛЬКО в режиме Design (boardMode === 'design');
     • тащим только за ручку, поэтому клик по тексту (каретка, contenteditable)
       и двойной клик для правки текста продолжают работать как раньше;
     • ручка и её стиль не попадают в сохраняемый HTML: перед сериализацией их
       временно снимаем;
     • сдвиг сразу уходит в current.html, в код и в автосохранение. */
(function () {
  'use strict';
  if (window.__dlMoveFree) return;
  window.__dlMoveFree = true;

  var HANDLE_ID = 'dl-move-handle';
  var STYLE_ID = 'dl-move-style';
  /* Что можно двигать: осмысленные блоки, но не html/body (их исключаем ниже). */
  var MOVABLE = 'section,header,footer,article,aside,figure,figcaption,nav,form,ul,ol,li,div,h1,h2,h3,h4,h5,h6,p,img,button,a,blockquote,table,picture,video';

  function inDesign() {
    try { if (typeof boardMode !== 'undefined' && boardMode === 'design') return true; } catch (e) {}
    return window.boardMode === 'design';
  }

  function target(node, doc) {
    if (!node || node.nodeType !== 1 || node.id === HANDLE_ID) return null;
    if (!node.closest) return null;
    var el = node.closest(MOVABLE);
    if (!el || el === doc.body || el === doc.documentElement) return null;
    return el;
  }

  function baseTranslate(el) {
    var m = (el.style.transform || '').match(/translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  }
  function setTranslate(el, x, y) {
    var rest = (el.style.transform || '').replace(/translate\([^)]*\)/, '').trim();
    el.style.transform = ('translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) ' + rest).trim();
  }

  function commit(doc, handle, style) {
    try {
      if (typeof current === 'undefined' || !current) return;
      if (handle && handle.parentNode) handle.parentNode.removeChild(handle);
      if (style && style.parentNode) style.parentNode.removeChild(style);
      current.html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
      if (style) (doc.head || doc.documentElement).appendChild(style);
      if (handle) doc.body.appendChild(handle);
      if (typeof codeSync === 'function') codeSync();
      if (typeof scheduleAutosave === 'function') scheduleAutosave();
    } catch (e) {}
  }

  function attach(doc) {
    if (!doc || !doc.body || doc.__dlMoveFree) return;
    doc.__dlMoveFree = true;
    var win = doc.defaultView;
    if (!win) return;

    var handle = null, style = null, cur = null, drag = null;

    /* Ручку и стиль создаём лениво — только когда впервые навели в Design.
       Так превью SF-конструктора (где режим не Design) не засоряется. */
    function ensure() {
      if (handle) return;
      style = doc.createElement('style'); style.id = STYLE_ID;
      style.textContent = '#' + HANDLE_ID + '{position:fixed;z-index:2147483646;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#7aa2ff;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:grab;display:none;align-items:center;justify-content:center;pointer-events:auto}#' + HANDLE_ID + '.on{display:flex}#' + HANDLE_ID + ':active{cursor:grabbing}[data-dl-moving]{outline:2px solid #7aa2ff!important;outline-offset:2px}';
      (doc.head || doc.documentElement).appendChild(style);
      handle = doc.createElement('div'); handle.id = HANDLE_ID;
      handle.setAttribute('contenteditable', 'false');
      handle.setAttribute('title', '\u041f\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u044c \u0431\u043b\u043e\u043a');
      handle.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>';
      doc.body.appendChild(handle);

      handle.addEventListener('mousedown', function (e) {
        if (!inDesign() || !cur) return;
        e.preventDefault(); e.stopPropagation();
        var b = baseTranslate(cur);
        drag = { el: cur, sx: e.clientX, sy: e.clientY, bx: b.x, by: b.y, moved: false };
        cur.setAttribute('data-dl-moving', '1');
      }, true);
    }

    function place(el) {
      cur = el;
      if (!el || !handle) { if (handle) handle.classList.remove('on'); return; }
      var r = el.getBoundingClientRect();
      handle.style.left = (r.left + 12) + 'px';
      handle.style.top = (r.top + 12) + 'px';
      handle.classList.add('on');
    }

    doc.addEventListener('mousemove', function (e) {
      if (drag || !inDesign()) return;
      if (e.target && e.target.id === HANDLE_ID) return;
      ensure();
      place(target(e.target, doc));
    }, true);

    win.addEventListener('mousemove', function (e) {
      if (!drag) return;
      e.preventDefault();
      var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
      setTranslate(drag.el, drag.bx + dx, drag.by + dy);
      if (handle) {
        var r = drag.el.getBoundingClientRect();
        handle.style.left = (r.left + 12) + 'px';
        handle.style.top = (r.top + 12) + 'px';
      }
    }, true);

    win.addEventListener('mouseup', function () {
      if (!drag) return;
      var el = drag.el, moved = drag.moved; drag = null;
      el.removeAttribute('data-dl-moving');
      if (moved) commit(doc, handle, style);
    }, true);
  }

  function tick() {
    var frame = document.getElementById('pvFrame');
    if (!frame) return;
    if (!frame.__dlMoveLoad) {
      frame.__dlMoveLoad = true;
      frame.addEventListener('load', function () { setTimeout(tick, 60); });
    }
    var doc = null;
    try { doc = frame.contentDocument; } catch (e) { doc = null; }
    if (doc) attach(doc);
  }
  tick();
  setInterval(tick, 700);
  document.addEventListener('DOMContentLoaded', tick);
  window.addEventListener('load', tick);
})();
