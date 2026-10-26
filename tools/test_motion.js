/* Проверки движка указателя и уровней движения.
 * Запуск: node tools/test_motion.js    (ожидает бэкенд на 127.0.0.1:8899)
 *
 * Про forced layout. Считать getBoundingClientRect «всего» бессмысленно: на
 * странице живут патчи, которые опрашивают геометрию по таймерам, и их вклад
 * в разы больше нашего. Поэтому мерим ПРИРОСТ: сколько вызовов добавляет
 * движение мыши сверх того же по длительности простоя. До объединения
 * обработчиков каждое движение звало getBoundingClientRect дважды (наклон
 * карточки и магнит кнопки), и прирост был кратным; теперь он должен быть
 * около нуля.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8899/index.html';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`  ${pass ? '\u2713' : '\u2717'} ${name}${detail ? ' — ' + detail : ''}`);
}

const RECT_PROBE = `
window.__rects = 0;
(function () {
  var r = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () { window.__rects++; return r.apply(this, arguments); };
})();
`;

/* Уровень закрепляем вручную: иначе замер FPS внутри headless-контейнера
   опустит страницу до min, и проверять будет нечего. */
async function open(browser, opts, tier) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 } }, opts));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.addInitScript(RECT_PROBE);
  if (tier) await page.addInitScript(`try{localStorage.setItem('dl_motion','${tier}')}catch(e){}`);
  await page.goto(BASE, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}

/* Настоящая мышь через CDP в контейнере выдаёт лишь десяток событий в секунду —
   для счёта forced layout этого мало. Поэтому рассылаем события сами, прямо со
   страницы, и оба типа: старый код слушал mousemove, новый — pointermove.
   Цель — элемент внутри карточки: раньше именно над ней наклон и магнит звали
   getBoundingClientRect на каждое движение. */
async function sweepOverCard(page, n) {
  return page.evaluate((count) => {
    const card = document.querySelector('.card[data-n]');
    const target = card || document.body;
    card && card.scrollIntoView({ block: 'center' });
    const b = target.getBoundingClientRect();
    window.__rects = 0;
    for (let i = 0; i < count; i++) {
      const x = b.left + 10 + (i * 3) % Math.max(20, b.width - 20);
      const y = b.top + 10 + (i * 5) % Math.max(20, b.height - 20);
      for (const type of ['pointermove', 'mousemove']) {
        const Ctor = type === 'pointermove' ? PointerEvent : MouseEvent;
        target.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: 'mouse' }));
      }
    }
    return window.__rects;
  }, n);
}

/* ─── 0. Ни один патч не отключён случайным упоминанием в index.html ───
   _build_index() подключает патч только если его имени файла ещё нет в
   index.html. Написать «dl-fix» с расширением .js в комментарии — значит молча
   отключить этот патч на всей странице. Ловушка неочевидная и уже срабатывала,
   поэтому проверяем механически: каждый файл из _PATCH_SCRIPTS и _PATCH_STYLES
   должен реально прийти на страницу. */
async function checkPatchesWired(page) {
  const fs = require('fs');
  const main = fs.readFileSync('backend/main.py', 'utf8');
  const list = (tuple) => {
    const m = main.match(new RegExp(tuple + '\\s*=\\s*\\(([\\s\\S]*?)\\n\\)'));
    return m ? [...m[1].matchAll(/"([\w.-]+\.(?:js|css))"/g)].map((x) => x[1]) : [];
  };
  const want = [...list('_PATCH_SCRIPTS'), ...list('_PATCH_STYLES')];
  const html = await page.content();
  const missing = want.filter((n) => !html.includes(n));
  console.log('\n\u2500\u2500 сборка страницы');
  check(`все ${want.length} патчей подключены`, want.length > 0 && missing.length === 0,
    missing.length ? 'не подключены: ' + missing.join(', ') : `${want.length} шт.`);
  const raw = fs.readFileSync('frontend/index.html', 'utf8');
  const shadowed = want.filter((n) => raw.includes(n));
  check('в index.html нет имён патч-файлов', shadowed.length === 0, shadowed.join(', ') || 'чисто');
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  /* ─── 1. Уровень full: движок собран целиком ─── */
  {
    const { ctx, page, errors } = await open(browser, {}, 'full');
    await checkPatchesWired(page);
    console.log('\n\u2500\u2500 движок указателя (уровень full)');
    check('без ошибок JS', errors.length === 0, errors.join(' | '));

    const state = await page.evaluate(() => window.__dlMotionState && window.__dlMotionState());
    check('уровень full, 4 слоя параллакса, пул следа', !!state && state.tier === 'full' && state.layers === 4, JSON.stringify(state));
    check('есть ручное управление window.dlMotion', await page.evaluate(() => !!window.dlMotion));

    await page.mouse.move(400, 400);
    await page.waitForTimeout(400);
    const ring = await page.evaluate(() => getComputedStyle(document.getElementById('cursorRing')).transform);
    check('кольцо курсора следует за мышью', ring && ring !== 'none', ring);

    /* Синхронная рассылка 400 движений: между ними таймеры патчей не успевают
       вклиниться, поэтому счётчик показывает вклад ровно наших обработчиков. */
    const MOVES = 400;
    const rects = await sweepOverCard(page, MOVES);
    check(
      'движение мыши не вызывает forced layout (< 0.05 на событие)',
      rects / MOVES < 0.05,
      `${rects} вызовов getBoundingClientRect на ${MOVES} движений над карточкой`
    );

    const par = await page.evaluate(() => document.querySelector('.bg-fx .grid').style.transform);
    check('параллакс фона пишет transform', /translate3d/.test(par), par);

    /* Наклон и магнит из движка убраны намеренно: dl-fix.js их всё равно
       глушит и стирает style.transform. Проверяем, что мы их не считаем. */
    const noTilt = await page.evaluate(() => {
      const c = document.querySelector('.card[data-n]');
      return c ? c.style.transform : '(нет карточек)';
    });
    check('наклон карточек не считается', noTilt === '' || noTilt === '(нет карточек)', JSON.stringify(noTilt));

    const trails = await page.evaluate(() => document.querySelectorAll('.cursor-trail').length);
    check('след курсора — пул, не более 10 узлов', trails > 0 && trails <= 10, String(trails));
    await ctx.close();
  }

  /* ─── 2. Уровень lite: косметика снята, кольцо и параллакс живы ─── */
  {
    const { ctx, page, errors } = await open(browser, {}, 'lite');
    console.log('\n\u2500\u2500 уровень lite');
    check('без ошибок JS', errors.length === 0, errors.join(' | '));
    const s = await page.evaluate(() => ({
      state: window.__dlMotionState(),
      stars: document.querySelectorAll('#stars .st').length,
      auroraBlend: getComputedStyle(document.querySelector('.bg-fx .a1')).mixBlendMode,
      chargeFilter: getComputedStyle(document.querySelector('.bg-fx .charge')).filter,
      noise: getComputedStyle(document.querySelector('.bg-fx .noise')).display,
      auroraAnim: getComputedStyle(document.querySelector('.bg-fx .a1')).animationName,
      starShadow: getComputedStyle(document.querySelector('#stars .st')).boxShadow,
      navBlur: getComputedStyle(document.querySelector('.nav')).backdropFilter,
    }));
    check('свечения и следа нет', s.state.glow === false && s.state.trail === 0, JSON.stringify(s.state));
    check('параллакс остался, но 2 слоя вместо 4', s.state.layers === 2, String(s.state.layers));
    check('звёзд 14 вместо 38', s.stars === 14, String(s.stars));
    check('mix-blend-mode у aurora снят', s.auroraBlend === 'normal', s.auroraBlend);
    check('drop-shadow у SVG-«тока» снят', s.chargeFilter === 'none', s.chargeFilter);
    check('слой шума скрыт', s.noise === 'none', s.noise);
    check('траектории aurora без scale', /Flat/.test(s.auroraAnim), s.auroraAnim);
    check('свечение звёзд снято', s.starShadow === 'none', s.starShadow);
    check('backdrop-filter шапки уменьшен', s.navBlur === 'blur(8px)', s.navBlur);
    await ctx.close();
  }

  /* ─── 3. reduced-motion → уровень min, фон замирает ─── */
  {
    const { ctx, page, errors } = await open(browser, { reducedMotion: 'reduce' });
    console.log('\n\u2500\u2500 prefers-reduced-motion: reduce');
    check('без ошибок JS', errors.length === 0, errors.join(' | '));
    const min = await page.evaluate(() => ({
      tier: window.__dlMotionTier,
      stars: document.querySelectorAll('#stars .st').length,
      glow: !!document.getElementById('cursorGlow'),
      anims: document.getAnimations().length,
    }));
    check('уровень min', min.tier === 'min', min.tier);
    check('звёзд не создано', min.stars === 0, String(min.stars));
    check('свечение курсора убрано', !min.glow);
    check('живых CSS-анимаций мало (< 40)', min.anims < 40, String(min.anims));

    /* Кольцо на min стоит ровно под мышью: кадры не нужны. */
    await page.mouse.move(500, 300);
    await page.waitForTimeout(200);
    const at = await page.evaluate(() => document.getElementById('cursorRing').style.transform);
    check('кольцо на min не отстаёт от мыши', /translate\(500px,\s*300px\)/.test(at), at);
    await ctx.close();
  }

  /* ─── 4. Ручной выбор сильнее автоматики ─── */
  {
    const { ctx, page } = await open(browser, { reducedMotion: 'reduce' }, 'full');
    console.log('\n\u2500\u2500 ручной выбор');
    const forced = await page.evaluate(() => ({
      tier: window.__dlMotionTier,
      auto: document.documentElement.getAttribute('data-motion-auto'),
    }));
    check('localStorage перебивает reduced-motion', forced.tier === 'full', forced.tier);
    check('замер такой уровень не понижает (auto снят)', forced.auto === null, String(forced.auto));
    await ctx.close();
  }

  /* ─── 5. Открытый конструктор гасит фон ─── */
  {
    const { ctx, page } = await open(browser, {}, 'full');
    console.log('\n\u2500\u2500 фон под конструктором и в скрытой вкладке');
    const hidden = await page.evaluate(() => {
      document.getElementById('editor').classList.add('on');
      return getComputedStyle(document.querySelector('.bg-fx')).display;
    });
    check('.bg-fx скрыт, когда .editor.on', hidden === 'none', hidden);

    const held = await page.evaluate(() => {
      document.getElementById('editor').classList.remove('on');
      document.documentElement.classList.add('dl-motion-hold');
      return getComputedStyle(document.querySelector('.bg-fx .a1')).animationPlayState;
    });
    check('фон на паузе в скрытой вкладке', held === 'paused', held);
    await ctx.close();
  }

  await browser.close();
  const bad = results.filter((r) => !r.pass);
  console.log(`\n${results.length - bad.length}/${results.length} проверок пройдено`);
  if (bad.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
