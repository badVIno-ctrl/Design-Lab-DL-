/* Design Lab — редактирование блоков включается сразу при входе в режим дизайна.

   Движок редактора (подсветка, рамки, перетаскивание) стартует в момент первого
   открытия панели с блоками, поэтому скрипт нажимает штатную кнопку за пользователя.

   Важно: нажатие ровно ОДНО и только если панель закрыта. Прошлая версия
   открывала и тут же закрывала панель, а проверка режима могла дёргаться — получалось
   мигание. Теперь панель просто остаётся открытой, а закрыть её можно вручную:
   повторно скрипт её не откроет до следующей загрузки сайта в кадре. */
(function () {
  'use strict';
  if (window.__dlDesignAutoArm) return;
  window.__dlDesignAutoArm = true;

  var PANEL = '#sfPanel,[id*="sfPanel"],[class*="sf-panel"],[id*="blocksPanel"],[class*="blocks-panel"]';
  var TOGGLE_SEL = [
    '#sfBtn', '#blocksBtn', '#addBlockBtn', '#sfToggle',
    '[onclick*="sfPanel"]', '[onclick*="toggleSf"]', '[onclick*="openSf"]',
    '[onclick*="blocksPanel"]', '[onclick*="toggleBlocks"]',
    '[data-panel="blocks"]', '[data-dl-blocks]'
  ].join(',');
  var TOGGLE_TEXT = /^(\+?\s*)?(блоки|блок|добавить блок|элементы|компоненты|blocks|elements|components)$/i;

  /* Одна попытка на загрузку сайта в кадре — без автоповторов. */
  var done = false;

  function inDesign() {
    try { if (typeof boardMode !== 'undefined' && boardMode === 'design') return true; } catch (e) {}
    if (window.boardMode === 'design') return true;
    var btn = document.getElementById('modeDesignBtn');
    if (btn) {
      var cls = ' ' + (btn.className || '') + ' ';
      if (/\s(on|active|sel|selected|is-active)\s/.test(cls)) return true;
      if (btn.getAttribute('aria-pressed') === 'true') return true;
    }
    return false;
  }
  /* Открыта ли панель. Здесь было две ошибки, и каждая по отдельности делала
     ответ всегда отрицательным — поэтому защита «нажимать только если панель
     закрыта» не работала никогда.

     Первая: проверка `el.offsetParent !== null`. У #sfPanel стоит
     position:fixed, а у фиксированных элементов offsetParent по спецификации
     ВСЕГДА null — открыта панель или нет. То же и у <body>.

     Вторая: закрытая панель здесь не исчезает из потока. Класс sf-hidden
     уводит её за край через transform и гасит до opacity:0, но display
     остаётся flex, а размеры — прежними 302x730. Значит, смотреть надо не на
     display, а на прозрачность вместе с pointer-events.

     Почему именно это сочетание, а не одна прозрачность: пока панель
     ВЫЕЗЖАЕТ, opacity анимируется от нуля, и в первом кадре она ещё равна
     нулю. А pointer-events переключается сразу, без перехода. Поэтому
     «закрыта» — это только когда выполнено и то, и другое.

     Ошибаться здесь лучше в сторону «открыта»: тогда скрипт просто ничего не
     сделает, и панель откроет само приложение. Обратная ошибка приводила к
     тому, что скрипт закрывал уже открытую панель. */
  function shown(el) {
    if (!el || !el.isConnected) return false;
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (!cs) return false;
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (Number(cs.opacity) === 0 && cs.pointerEvents === 'none') return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 40 && rect.height > 40;
  }
  function panel() {
    /* Сначала точное совпадение: селектор ниже намеренно широкий, и среди его
       вариантов есть [class*="sf-panel"], под который подходит сам <body> —
       когда панель открыта, на нём висит класс sf-panel-on. В порядке
       документа body идёт раньше панели, поэтому querySelectorAll возвращал
       его первым, и дальше проверялась видимость не того элемента. */
    var direct = document.getElementById('sfPanel');
    if (direct) return direct;
    var list = document.querySelectorAll(PANEL);
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.id === 'pvFrame') continue;
      if (el === document.body || el === document.documentElement) continue;
      return el;
    }
    return null;
  }
  function text(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function toggle() {
    var direct = document.querySelector(TOGGLE_SEL);
    if (direct) return direct;
    var list = document.querySelectorAll('button,a,[role="button"],.btn,[class*="btn"]');
    for (var i = 0; i < list.length; i++) {
      if (TOGGLE_TEXT.test(text(list[i]))) return list[i];
    }
    return null;
  }
  function arm() {
    if (done || !inDesign()) return;
    var box = panel();
    if (box && shown(box)) { done = true; return; }
    var button = toggle();
    if (!button) return;
    done = true;
    try {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (e) {
      try { button.click(); } catch (e2) {}
    }
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    /* Ручное закрытие панели уважаем: больше не открываем её сами. */
    if (target.closest('#modeDesignBtn')) {
      setTimeout(arm, 150);
      setTimeout(arm, 700);
    }
  }, true);

  var frame = null;
  function watchFrame() {
    var el = document.getElementById('pvFrame');
    if (!el || el === frame) return;
    frame = el;
    el.addEventListener('load', function () {
      done = false;
      setTimeout(arm, 350);
      setTimeout(arm, 1200);
    });
  }

  setInterval(function () { watchFrame(); arm(); }, 1000);
  watchFrame();
  setTimeout(arm, 400);
  document.addEventListener('DOMContentLoaded', function () { setTimeout(arm, 400); });
  window.addEventListener('load', function () { setTimeout(arm, 400); });

  /* Состояние наружу — для отладки и автотестов. Главное здесь panelShown:
     именно этот ответ раньше всегда был отрицательным и ломал защиту. */
  window.__dlAutoArmState = function () {
    var box = panel();
    return {
      done: done,
      inDesign: inDesign(),
      panel: box ? (box.id || box.tagName.toLowerCase()) : null,
      panelShown: shown(box),
      toggle: (function () { var t = toggle(); return t ? (t.id || t.tagName.toLowerCase()) : null; })()
    };
  };
})();
