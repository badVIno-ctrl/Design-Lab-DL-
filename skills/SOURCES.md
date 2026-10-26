# Источники дизайн-паков

Правила в `skills/packs/*.md` собраны из тринадцати открытых наборов дизайн-скиллов.
Здесь зафиксировано, откуда что взято: репозиторий, коммит на момент сборки,
лицензия и какие именно файлы использованы.

## Что именно сделано с источниками

Паки — это **сжатый пересказ**, а не копия. Причина техническая: паки идут в
системный промпт модели, а суммарный объём наборов — больше 10 МБ markdown.
В промпт помещается 2–30 КБ в зависимости от модели, поэтому из источников
взяты проверяемые правила и переписаны в императивной форме («радиус
вложенного = внешний минус отступ»), без вводных абзацев, ссылок на внешние
файлы и инструкций для CLI-инструментов, которых у нас нет.

Что сознательно **не** переносилось:

- вызовы сторонних CLI и MCP-серверов (`npx @superdesign/cli`, `dwic`,
  `npx impeccable`, `uipro init`) — у моделей на сайте нет доступа к оболочке;
- обязательная подпись «Created By Deerflow» из `bytedance/deer-flow` — мы не
  ставим чужой брендинг в сайты пользователей;
- разделы про правку файлов в репозитории, чтение `package.json`, поиск
  `.design/*/DESIGN_BRIEF.md`, артефакты PRODUCT.md/DESIGN.md — модель у нас
  возвращает один HTML-документ;
- запрет длинного тире из `badVIno-ctrl/viora-skills` («zero em dashes») — в
  русской типографике тире обязательно, наш пак `type-craft` прямо требует
  «длинное тире —», поэтому правило отброшено как противоречащее языку
  интерфейса;
- механические проверки из того же набора (`scripts/check.mjs`,
  `scripts/contrast.mjs`, `scripts/shot.mjs`), раунды скриншотов и приём
  `--squint`, копирование `assets/tokens.css` и `assets/starter.html`, отчёт
  `DESIGN.md` и объявление пройденных «ворот» в ответе — у модели один проход,
  нет ни оболочки, ни второго взгляда на свой результат;
- материал не про веб-дизайн (игровые скиллы, TTS, публикация в GitHub,
  нативные iOS/Android-гайды, React/Next-оптимизации).

## Таблица источников

| Репозиторий | Коммит | Лицензия | Что взято |
|---|---|---|---|
| [superdesigndev/superdesign-skill](https://github.com/superdesigndev/superdesign-skill) | `dc59c1b1b966` | MIT | Порядок работы с дизайн-системой, извлечение «design DNA» с сайта-референса (`references/WEBSITE.md`), композиция графики (`references/GRAPHIC.md`) |
| [jakubkrehel/skills](https://github.com/jakubkrehel/skills) | `d01493b0a7b9` | MIT | `better-ui` (поверхности, анимации, иконки), `better-typography`, `better-colors`, `better-layout`, `better-accessibility`, `better-writing`, `interface-review` |
| [MengTo/Skills](https://github.com/MengTo/Skills) | `4a0d3b43c663` | MIT | `agent-skills/web-design` — 80+ стилевых рецептов, из них сведены 10 арт-дирекций; `animation-systems`, `beautiful-shadows`, `progressive-blur`; `codex/audit-verify-explain-grade-5`, `iterate-until-verified`; `ui/design-first-ui-prompting` |
| [bytedance/deer-flow](https://github.com/bytedance/deer-flow/tree/main/skills/public/frontend-design) | `2bb230b334b6` | MIT | `skills/public/frontend-design` — список запрещённых «ИИ-эстетик», перечень тональностей, требование к атмосфере фона; `web-design-guidelines` |
| [Owl-Listener/designer-skills](https://github.com/Owl-Listener/designer-skills) | `20e34c4a587e` | MIT | `interaction-design` (Фиттс, Хик, Миллер, Догерти, состояния, формы, обратная связь), `ui-design` (шкала, сетка, цветовая система, тёмная тема, данные), `visual-critique` |
| [julianoczkowski/designer-skills](https://github.com/julianoczkowski/designer-skills) | `c259656c76d9` | Apache-2.0 | `design-tokens` (состав и слои токенов), `design-review`, `grill-me` (самокритика), `information-architecture` |
| [master5d/claude-design-skills](https://github.com/master5d/claude-design-skills) | `5cf7b695d50a` | не указана | `interface-design` — «где прячутся шаблонные решения» и вопросы до кода; `baseline-ui`, `fixing-accessibility`. Файлы **не копировались**: правила пересказаны своими словами, ссылка на источник обязательна |
| [imsaif/design-with-claude](https://github.com/imsaif/design-with-claude) | `9b3afb51c083` | MIT | Промпты инструментов `design-system`, `typography`, `color`, `content-strategist`, `set-project-profile` |
| [staurus86/global-design-skill](https://github.com/staurus86/global-design-skill) | `56707e7598c6` | MIT | `references/anti-slop-system.md` (основа пака запретов), `rules/02–07`, `rules/19`, `patterns/marketing-blocks`, `patterns/admin-ui`, `patterns/states`, `patterns/product-ui`, `references/aesthetic-recipes.md`, `tokens/` |
| [santowilem/skills](https://github.com/santowilem/skills) | `2caf2e1dd0e5` | не указана | `clone-ui` — порядок разбора скриншота перед вёрсткой. Файлы **не копировались**: правила пересказаны своими словами, ссылка на источник обязательна |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `5c5553b1d7f9` | Apache-2.0 | `skill/SKILL.src.md` (режимы поверхности Persuade/Operate/Read/Experience, семантика «доработка сохраняет, редизайн заменяет», проверка короткими заходами), `skill/reference/craft-floor.md` (планка качества: контраст, глубина, браузерные поверхности; отказы от умолчаний категории) |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `a38d04c3d5c2` | MIT | `src/ui-ux-pro-max/data/ux-guidelines.csv` (119 UX-правил, включая WCAG 2.2), `src/ui-ux-pro-max/data/landing.csv` (структуры страниц и стратегии CTA). Сами базы CSV не копируются: своя база палитр/шрифтов уже есть в `frontend/dl-design-kb.json` |
| [badVIno-ctrl/viora-skills](https://github.com/badVIno-ctrl/viora-skills) | `52d7fb51bae2` | MIT объявлена в README и во front-matter `SKILL.md`, файла LICENSE в репозитории нет | `beautiful-ui/SKILL.md` — десять законов ремесла, маршрут ворот G0–G7 (решение → чтение → направление → каркас → сборка → детали → проверка), режимы поверхности LAND/APP/READ/SHOW, подбор гарнитуры по системе письма (латиница/кириллица), раздел собственных провалов: «сливочная бумага + антиква + терракота», «почти чёрный + неон + свечение», страница одинаковых карточек, латинский шрифт поверх кириллического текста, добавление вместо вычёркивания. Файлы **не копировались**: правила пересказаны своими словами |

Три репозитория (`master5d/claude-design-skills`, `santowilem/skills`,
`badVIno-ctrl/viora-skills`) на момент сборки не содержат файла лицензии — в
`viora-skills` MIT указана только в README и во front-matter `SKILL.md`, самого
файла в дереве нет. Поэтому их материал не распространяется в составе этого
репозитория: из них взяты только идеи, изложенные заново, с указанием авторства
выше и в поле `sources` соответствующих паков.

## Как обновить

1. Склонировать нужный репозиторий и посмотреть, что изменилось с указанного коммита.
2. Правки внести в `skills/packs/*.md`, сохраняя императивный стиль и объём пака
   в пределах 1–2.5 тыс. символов — от размера напрямую зависит, попадёт ли пак
   слабой модели.
3. Обновить коммит в таблице выше.
4. Пересобрать файл для браузера и прогнать тесты:

```bash
python3 tools/build_skill_packs.py
python3 backend/test_skill_packs.py
python3 backend/test_skill_packs.py --dump > /tmp/expected.json
node tools/test_skill_packs_parity.js /tmp/expected.json
```
