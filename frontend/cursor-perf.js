/* Возвращает исходный круглый курсор страницы. Отдельный курсор для iframe
   создаёт iframe-cursor-bridge.js. */
(function () {
  'use strict';
  if (window.__dlCursorRestoreOriginal) return;
  window.__dlCursorRestoreOriginal = true;
  function restore() {
    var nativeCss = document.getElementById('dl-cursor-native-css');
    if (nativeCss && nativeCss.parentNode) nativeCss.parentNode.removeChild(nativeCss);
    var oldPerf = document.getElementById('dl-cursor-perf-css');
    if (oldPerf && oldPerf.parentNode) oldPerf.parentNode.removeChild(oldPerf);
    document.documentElement.classList.add('cursor-on');
  }
  restore();
  window.addEventListener('load', restore);
  setTimeout(restore, 350);
  window.__dlCursorPerfState = function () {
    return { originalCursor: true, dot: !!document.getElementById('cursorDot'), ring: !!document.getElementById('cursorRing') };
  };
})();
