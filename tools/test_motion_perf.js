/* Замер стоимости анимаций курсора и фона — до и после, по уровням движения.
 *
 * Запуск:
 *   node tools/test_motion_perf.js
 *
 * Сравнивает четыре сценария на одном и том же троттлинге процессора:
 *   было          — страница до правок (сырой index.html из HEAD);
 *   стало · full   — после правок, уровень движения full (картинка та же);
 *   стало · lite   — уровень для слабых ПК и ноутбуков;
 *   стало · min    — reduced-motion / экономия данных.
 * Плюс отдельно «конструктор открыт»: там фон целиком закрыт редактором.
 *
 * Нарочно мерим СЫРОЙ index.html без патч-скриптов. На собранной странице
 * десятки патчей опрашивают DOM по таймерам, и их вклад в загрузку главного
 * потока перекрывает анимации: разницу в анимациях в этом шуме не разглядеть.
 *
 * Что считаем:
 *   idleFps    — кадры в секунду, когда мышь стоит: цена фоновых анимаций.
 *   moveFps    — кадры в секунду при непрерывном движении мыши: плюс курсор.
 *   anims      — сколько CSS-анимаций крутится одновременно.
 *   longTasks  — суммарная длительность задач > 50 мс (главный поток стоял).
 *   rects      — forced layout из обработчиков мыши.
 *   nodes      — узлов DOM создано за прогон (след курсора, ripple).
 *
 * CPU throttling эмулирует слабый ноутбук: на быстрой машине любая
 * неэффективность прячется за запасом производительности.
 */
const { chromium } = require('playwright');

const OLD = process.env.OLD || 'http://127.0.0.1:8897/index.html';
const NEW = process.env.NEW || 'http://127.0.0.1:8898/index.html';
const THROTTLE = Number(process.env.THROTTLE || 4);
const SECONDS = Number(process.env.SECONDS || 3);

const PROBE = `
window.__perf = { rects: 0, longTasks: 0, nodes: 0 };
(function () {
  var rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () { window.__perf.rects++; return rect.apply(this, arguments); };
  var append = Element.prototype.appendChild;
  Element.prototype.appendChild = function (node) {
    if (node && node.nodeType === 1) window.__perf.nodes++;
    return append.apply(this, arguments);
  };
  try {
    new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { window.__perf.longTasks += e.duration; }); })
      .observe({ entryTypes: ['longtask'] });
  } catch (e) {}
})();
window.__countFrames = function (ms) {
  return new Promise(function (done) {
    var n = 0, t0 = performance.now();
    (function loop() {
      n++;
      if (performance.now() - t0 < ms) requestAnimationFrame(loop);
      else done(+(n / ((performance.now() - t0) / 1000)).toFixed(1));
    })();
  });
};
`;

const SCENARIOS = [
  { label: 'было', url: () => OLD, tier: null },
  { label: 'стало · full', url: () => NEW, tier: 'full' },
  { label: 'стало · lite', url: () => NEW, tier: 'lite' },
  { label: 'стало · min', url: () => NEW, tier: 'min' },
  { label: 'было · конструктор открыт', url: () => OLD, tier: null, editor: true },
  { label: 'стало · конструктор открыт', url: () => NEW, tier: 'lite', editor: true },
];

async function run(browser, sc) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(PROBE);
  /* Уровень нужен в двух местах: window.__dlMotionTier читают инлайновые
     скрипты страницы (его ставим до них), а класс на <html> нужен стилям.
     Класс именно ПОСЛЕ goto: addInitScript работает раньше, чем парсер создаст
     настоящий <html>, и поставленный там класс потерялся бы. */
  if (sc.tier) await page.addInitScript(`window.__dlMotionTier='${sc.tier}'`);

  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.goto(sc.url(), { waitUntil: 'load', timeout: 120000 });
  /* Сырой index.html не тянет патч-стили, а уровни движения живут именно в
     dl-motion-perf.css. Подключаем его руками, иначе lite и min ничем не
     отличались бы от full по части фона. */
  if (sc.tier) {
    await page.evaluate((t) => document.documentElement.classList.add('dl-motion-' + t), sc.tier);
    await page.addStyleTag({ path: 'frontend/dl-motion-perf.css' });
  }
  if (sc.editor) await page.evaluate(() => document.getElementById('editor').classList.add('on'));
  await page.waitForTimeout(2500);

  await page.mouse.move(700, 400);
  await page.waitForTimeout(700);
  await page.evaluate('window.__perf.rects=0;window.__perf.nodes=0;window.__perf.longTasks=0');
  const idleFps = await page.evaluate(`window.__countFrames(${SECONDS * 1000})`);
  const idle = await page.evaluate('({...window.__perf})');
  const anims = await page.evaluate('document.getAnimations().length');

  await page.evaluate('window.__perf.rects=0;window.__perf.nodes=0;window.__perf.longTasks=0');
  const moving = page.evaluate(`window.__countFrames(${SECONDS * 1000})`);
  const t0 = Date.now();
  while (Date.now() - t0 < SECONDS * 1000) {
    const p = (Date.now() - t0) / (SECONDS * 1000);
    await page.mouse.move(200 + Math.round(900 * p), 300 + Math.round(240 * Math.sin(p * 9)));
  }
  const moveFps = await moving;
  const move = await page.evaluate('({...window.__perf})');

  if (process.env.SHOTS) {
    await page.mouse.move(640, 360);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${process.env.SHOTS}/${sc.label.replace(/[^\wа-яё]+/gi, '-')}.png` });
  }
  await ctx.close();
  return {
    label: sc.label, idleFps, moveFps, anims,
    idleLong: Math.round(idle.longTasks), moveLong: Math.round(move.longTasks),
    rects: move.rects, nodes: move.nodes,
  };
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const rows = [];
  for (const sc of SCENARIOS) rows.push(await run(browser, sc));
  await browser.close();

  const pad = (v, n) => String(v).padEnd(n);
  const padL = (v, n) => String(v).padStart(n);
  console.log(`\nCPU throttling ${THROTTLE}×, окно ${SECONDS} с, сырой index.html без патч-скриптов\n`);
  console.log(pad('сценарий', 28) + padL('idle fps', 9) + padL('move fps', 9) + padL('анимаций', 10) + padL('longTasks', 11) + padL('layout', 8) + padL('узлов', 7));
  console.log('─'.repeat(82));
  for (const r of rows) {
    console.log(
      pad(r.label, 28) + padL(r.idleFps, 9) + padL(r.moveFps, 9) + padL(r.anims, 10) +
      padL(`${r.idleLong}/${r.moveLong}`, 11) + padL(r.rects, 8) + padL(r.nodes, 7)
    );
  }
  const base = rows[0], lite = rows.find((r) => r.label === 'стало · lite');
  if (base && lite) {
    console.log(`\nidle: ${base.idleFps} → ${lite.idleFps} fps (×${(lite.idleFps / base.idleFps).toFixed(1)})`);
    console.log(`move: ${base.moveFps} → ${lite.moveFps} fps (×${(lite.moveFps / base.moveFps).toFixed(1)})`);
  }
  console.log('\n' + JSON.stringify(rows));
})().catch((e) => { console.error(e); process.exit(1); });
