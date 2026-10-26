/* Сверка браузерного отбора паков с серверным.

   Два движка отбора — на сервере (backend/skill_packs.py) и в браузере
   (frontend/dl-skill-packs.js) — обязаны выбирать одно и то же, иначе одна и та
   же модель получит разные правила в зависимости от того, идёт запрос через
   /api/ai или напрямую через /api/proxy. Этот тест ловит расхождение.

   Ожидаемые ответы готовит Python:
     python3 tools/build_skill_packs.py
     python3 backend/test_skill_packs.py --dump > /tmp/expected.json
     node tools/test_skill_packs_parity.js /tmp/expected.json
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const expectedPath = process.argv[2];
if (!expectedPath) {
  console.error('использование: node tools/test_skill_packs_parity.js <expected.json>');
  process.exit(2);
}

const packsJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend', 'dl-skill-packs.json'), 'utf8'));
const cases = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

/* Минимальное окружение браузера: файл ждёт window.fetch и Promise. */
const sandbox = {
  window: {},
  Promise,
  Object,
  Array,
  JSON,
  RegExp,
  String,
  console,
};
const stubFetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(packsJson) });
sandbox.window.fetch = stubFetch;
sandbox.fetch = stubFetch; /* в браузере голый fetch — это window.fetch */
sandbox.window.DLPacks = undefined;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'frontend', 'dl-skill-packs.js'), 'utf8'), sandbox);

const DLPacks = sandbox.window.DLPacks;

(async () => {
  await DLPacks.load();
  if (!DLPacks.ready()) {
    console.error('dl-skill-packs.json не загрузился в песочнице');
    process.exit(1);
  }
  let pass = 0;
  let fail = 0;
  for (const item of cases) {
    const got = DLPacks.select(item.model, item.mode, item.message, item.images);
    const gotIds = got.packs.map((p) => p.id);
    const same =
      got.profile.tier === item.expect.tier &&
      got.used === item.expect.used &&
      gotIds.join(',') === item.expect.packs.join(',');
    if (same) {
      pass += 1;
    } else {
      fail += 1;
      console.log(`  \u274c ${item.model} / ${item.mode} / "${item.message}"`);
      console.log(`      python: ${item.expect.tier} ${item.expect.used} [${item.expect.packs.join(',')}]`);
      console.log(`      node:   ${got.profile.tier} ${got.used} [${gotIds.join(',')}]`);
    }
  }
  console.log(`\nсверка отбора паков: ${pass} совпало, ${fail} расхождений`);

  /* Вторая часть: публичный API двойника ведёт себя как ожидается. */
  console.log('\nповедение двойника:');
  let ipass = 0;
  let ifail = 0;

  function check(name, condition) {
    if (condition) { ipass += 1; console.log('  \u2705 ' + name); }
    else { ifail += 1; console.log('  \u274c ' + name); }
  }

  const openai = DLPacks.select('claude-opus-5', 'scratch', 'сайт винодельни', false);
  check('в теле OpenAI-формата модель читается', openai.profile.tier === 'frontier');

  const fromUrlDirect = DLPacks.profile
    ? DLPacks.profile('gemini-flash-latest')
    : null;
  check('профиль Gemini найден по имени', fromUrlDirect && fromUrlDirect.vision === true);

  const proxied = DLPacks.forModel('google/gemma-4-31b-it:free', 'сайт кофейни');
  check('слабая модель получает только минимум',
    proxied.packs.join(',') === 'anti-slop,ship-checklist');

  const withImage = DLPacks.select('gemini-3.6-flash', 'scratch', 'сделай так же', true);
  check('картинка включает пак про скриншот',
    withImage.packs.some((p) => p.id === 'screenshot-to-ui'));

  const brief = DLPacks.briefFor('claude-opus-5', 'scratch', 'сайт винодельни', false);
  check('текст паков содержит маркер', brief.indexOf(packsJson.marker) >= 0);
  check('текст паков непустой и осмысленного размера', brief.length > 5000);

  console.log(`\nповедение: ${ipass} ок, ${ifail} ошибок`);
  process.exit(fail + ifail ? 1 : 0);
})();
