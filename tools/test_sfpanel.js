/* Панель конструктора открывается и НЕ закрывается сама.
 *
 * Запуск: node tools/test_sfpanel.js        (бэкенд на 127.0.0.1:8899)
 *         RUNS=6 node tools/test_sfpanel.js
 *
 * Суть бага, который тут проверяется. design-autoarm.js нажимает штатную
 * кнопку панели блоков за пользователя, чтобы запустить движок редактора. В
 * нём есть защита «нажимать только если панель закрыта», но она не работала:
 *
 *   1. shown() требовал el.offsetParent !== null, а у #sfPanel стоит
 *      position:fixed — у таких элементов offsetParent ВСЕГДА null;
 *   2. panel() возвращал <body>, потому что широкий селектор
 *      [class*="sf-panel"] подходит под класс sf-panel-on, который висит на
 *      body при открытой панели, и в порядке документа body идёт раньше.
 *
 * В итоге приложение открывало панель, а через полсекунды скрипт нажимал
 * тоггл и закрывал её. Поэтому проверки ниже смотрят и на конечное состояние,
 * и на сам предикат shown() во всех трёх состояниях панели.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8899/index.html';
const RUNS = Number(process.env.RUNS || 4);
const WAIT = Number(process.env.WAIT || 6500);

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`  ${pass ? '\u2713' : '\u2717'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function openCanvas(page) {
  await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { if (typeof openScratch === 'function') openScratch(); });
  await page.waitForTimeout(WAIT);
}

function state() {
  const el = document.getElementById('sfPanel');
  const cs = el ? getComputedStyle(el) : null;
  return {
    panelOn: document.body.classList.contains('sf-panel-on'),
    sfMode: !!(window.current && window.current.sfMode),
    exists: !!el,
    hidden: el ? el.classList.contains('sf-hidden') : null,
    opacity: cs ? Number(cs.opacity) : null,
    pointer: cs ? cs.pointerEvents : null,
    arm: window.__dlAutoArmState ? window.__dlAutoArmState() : null,
  };
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  /* ─── 1. Панель остаётся открытой, и это повторяемо ─── */
  console.log(`\n\u2500\u2500 панель не закрывается сама (${RUNS} прогонов)`);
  let open = 0;
  const errors = [];
  let last = null;
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    await openCanvas(page);
    last = await page.evaluate(state);
    if (last.panelOn) open++;
    else console.log(`     run${i}: панели нет — ${JSON.stringify(last)}`);
    await ctx.close();
  }
  check(`панель открыта во всех ${RUNS} прогонах`, open === RUNS, `${open} из ${RUNS}`);
  check('без ошибок JS', errors.length === 0, errors.join(' | '));
  check('режим конструктора включён', !!(last && last.sfMode));
  check('панель не помечена классом sf-hidden', last && last.hidden === false, String(last && last.hidden));
  check('панель полностью видна (opacity 1)', last && last.opacity === 1, String(last && last.opacity));

  /* ─── 2. Предикат shown() отвечает верно во всех трёх состояниях ─── */
  console.log('\n\u2500\u2500 предикат «панель открыта» по состояниям');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await openCanvas(page);

  const armed = await page.evaluate(() => window.__dlAutoArmState());
  check('автовзвод видит именно панель, а не <body>', armed.panel === 'sfPanel', String(armed.panel));
  check('открытая панель считается открытой', armed.panelShown === true, JSON.stringify(armed));

  /* Закрыта: sf-hidden уводит панель за край и гасит, display остаётся flex. */
  const closed = await page.evaluate(() => {
    const el = document.getElementById('sfPanel');
    el.classList.add('sf-hidden');
    el.style.transition = 'none';
    return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const cs = getComputedStyle(el);
      done({ shown: window.__dlAutoArmState().panelShown, display: cs.display, opacity: Number(cs.opacity), pointer: cs.pointerEvents });
    })));
  });
  check('закрытая панель считается закрытой', closed.shown === false, JSON.stringify(closed));
  check('закрытая панель осталась display:flex (ловушка для проверки по display)', closed.display === 'flex', closed.display);

  /* Выезжает: pointer-events уже включён, а opacity ещё нулевая. */
  const opening = await page.evaluate(() => {
    const el = document.getElementById('sfPanel');
    el.style.transition = 'none';
    el.classList.remove('sf-hidden');
    el.style.opacity = '0';           /* как в первом кадре анимации */
    return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const cs = getComputedStyle(el);
      done({ shown: window.__dlAutoArmState().panelShown, opacity: Number(cs.opacity), pointer: cs.pointerEvents });
    })));
  });
  check('выезжающая панель считается открытой', opening.shown === true, JSON.stringify(opening));

  /* ─── 3. Прямая задача автовзвода: закрытую панель он всё ещё открывает ───
     Иначе «исправление» свелось бы к тому, что скрипт просто ничего не делает.
     Ручное закрытие уважается до следующей загрузки сайта в кадре, поэтому
     сначала закрываем панель, потом имитируем загрузку кадра. */
  console.log('\n\u2500\u2500 автовзвод по-прежнему открывает закрытую панель');
  const reopened = await page.evaluate(() => {
    const el = document.getElementById('sfPanel');
    el.style.transition = 'none';
    el.style.opacity = '';
    el.classList.add('sf-hidden');
    document.body.classList.remove('sf-panel-on');
    const frame = document.getElementById('pvFrame');
    if (frame) frame.dispatchEvent(new Event('load'));
    return new Promise((done) => setTimeout(() => done({
      panelOn: document.body.classList.contains('sf-panel-on'),
      hidden: el.classList.contains('sf-hidden'),
      arm: window.__dlAutoArmState(),
    }), 2500));
  });
  check('панель открыта заново после загрузки кадра', reopened.panelOn === true && reopened.hidden === false, JSON.stringify(reopened));
  await ctx.close();

  await browser.close();
  const bad = results.filter((r) => !r.pass);
  console.log(`\n${results.length - bad.length}/${results.length} проверок пройдено`);
  if (bad.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
