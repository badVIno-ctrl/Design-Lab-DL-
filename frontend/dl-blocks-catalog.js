/* ============================================================================
   Design Lab — каталог элементов сайта.

   ЧТО БЫЛО: в панели «Блоки» жила одна секция «Базовые» и двенадцать
   примитивов доски — frame, paragraph, button, image, nav, header, footer,
   hscroll, burger, search, animation, htmlraw. Собрать из них можно всё,
   но руками: тариф, отзыв, поле формы, карточку товара приходилось
   складывать заново каждый раз. Модель по той же причине лепила секцию
   одним абзацем — двигать внутри было нечего.

   ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:

   1. КАТАЛОГ. Готовые элементы (около 130) в тринадцати категориях:
      текст, кнопки, метки, секции, карточки, навигация, формы, медиа,
      данные, магазин, состояния, маркетинг, продвинутые.
      КАЖДЫЙ собран ИЗ ТЕХ ЖЕ примитивов доски. Это принципиально:
      вставленный «тариф» — это обычный frame с paragraph и button внутри,
      поэтому его можно двигать, растягивать, перекрашивать, править текст
      и разбирать по кускам. Никаких чёрных ящиков.

   2. ПАНЕЛЬ. В «Блоки» добавляется своя секция с поиском и категориями.
      Панель ищется тем же способом, что и в preview-mode-clean.js —
      по табам «Блоки/Слои/Свойства» и секции «Базовые», а не по классам:
      разметка живёт в index.html, классы там угадывать нельзя.

   3. ИИ. Список элементов подмешивается в системный промпт доски вместе
      с правилом дробления: заголовок, подзаголовок и описание — три разных
      узла, а не один абзац. Именно из-за этого сгенерированную страницу
      раньше нельзя было нормально править: блок был один на всю секцию.

   ПОЧЕМУ НЕ НОВЫЕ type: рендер доски лежит внутри index.html (703 КБ) и
   незнакомый type он просто не нарисует. Поэтому сложные элементы — это
   композиции из примитивов, а по-настоящему интерактивные (видео, карта,
   встроенная форма) — htmlraw.

   Диагностика: dlBlocksCatalog() — сколько элементов, найдена ли панель,
   найдена ли схема, каким способом вставляем.
   ========================================================================= */
(function () {
  'use strict';
  if (window.DLBlocks) return;

  /* Цвета берём из темы доски, с запасным значением на случай, если
     переменная в теме не объявлена — иначе элемент вставится бесцветным. */
  var C = {
    bg: 'var(--sf-bg, #ffffff)',
    surf: 'var(--sf-surface, rgba(128,128,128,.10))',
    muted: 'var(--sf-muted, rgba(120,120,120,.95))',
    accent: 'var(--sf-accent, #2f6fed)',
    line: 'var(--sf-border, rgba(128,128,128,.28))'
  };

  /* ------------------------------------------------ конструкторы узлов */

  function F(props, kids) {
    var p = props || {};
    if (p.padding === undefined) p.padding = 0;
    return { type: 'frame', props: p, children: kids || [] };
  }
  function col(gap, kids, extra) {
    var p = { direction: 'column', gap: gap };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return F(p, kids);
  }
  function row(gap, kids, extra) {
    var p = { direction: 'row', gap: gap, alignItems: 'center' };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return F(p, kids);
  }
  function P(text, size, weight, color, extra) {
    var p = { text: text, fontSize: size || 16 };
    if (weight) p.fontWeight = weight;
    if (color) p.color = color;
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return { type: 'paragraph', props: p };
  }
  function B(label, variant, href) {
    var p = { label: label };
    if (variant) p.variant = variant;
    if (href) p.href = href;
    return { type: 'button', props: p };
  }
  function IMG(alt, h) {
    return { type: 'image', props: { alt: alt || 'Изображение', src: '', width: '100%', height: h || 220, borderRadius: 12 } };
  }
  function RAW(html, h) {
    /* Имя свойства у htmlraw в разных сборках отличается — кладём оба,
       лишнее движок просто игнорирует. */
    return { type: 'htmlraw', props: { html: html, code: html, height: h || 320 } };
  }
  function ANIM(kids, delay) {
    return { type: 'animation', props: { variant: 'slide-up', trigger: 'onScroll', duration: 420, delay: delay || 0 }, children: kids };
  }

  /* Часто повторяющиеся сборки. */
  function card(kids, extra) {
    var p = { direction: 'column', gap: 12, backgroundColor: C.surf, borderRadius: 14, padding: 24, width: '100%' };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return F(p, kids);
  }
  function chip(text) {
    return F({ backgroundColor: C.surf, borderRadius: 999, padding: '6px 12px' }, [P(text, 13, 600)]);
  }
  function pill(text, on) {
    return F({ backgroundColor: on ? C.accent : C.surf, borderRadius: 999, padding: '8px 16px' },
      [P(text, 14, 600, on ? 'var(--sf-onAccent, #fff)' : null)]);
  }
  function box(kids, extra) {
    var p = { backgroundColor: C.surf, borderRadius: 10, padding: '14px 16px', width: '100%' };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return F(p, kids);
  }
  function field(label, ph) {
    return col(8, [P(label, 14, 600), box([P(ph, 15, null, C.muted)])], { width: '100%' });
  }
  function line() {
    return F({ width: '100%', height: 1, backgroundColor: C.line, padding: 0 }, []);
  }
  function band(anchor, kids, surface, pad) {
    var outer = { padding: '0 24px', alignItems: 'center', width: '100%' };
    if (anchor) outer.anchor = anchor;
    if (surface) outer.backgroundColor = C.surf;
    return F(outer, [F({ maxWidth: '1100px', width: '100%', padding: pad || '88px 0', gap: 24, direction: 'column' }, kids)]);
  }
  function cols(n, kids) {
    return F({ direction: 'row', gap: 16, wrap: true, width: '100%', padding: 0, dlCols: n }, kids);
  }
  function dot(color) {
    return F({ width: 10, height: 10, borderRadius: 999, backgroundColor: color || C.accent, padding: 0 }, []);
  }
  function sq(size, radius) {
    return F({ width: size, height: size, borderRadius: radius === undefined ? 10 : radius, backgroundColor: C.surf, padding: 0 }, []);
  }

  /* ------------------------------------------------------------ каталог */

  var CATS = [
    ['text', 'Текст'],
    ['action', 'Кнопки'],
    ['mark', 'Метки'],
    ['layout', 'Секции'],
    ['card', 'Карточки'],
    ['nav', 'Навигация'],
    ['form', 'Формы'],
    ['media', 'Медиа'],
    ['data', 'Данные'],
    ['shop', 'Магазин'],
    ['state', 'Состояния'],
    ['market', 'Маркетинг'],
    ['adv', 'Продвинутые']
  ];

  var ITEMS = [];
  function I(id, cat, name, tags, make) {
    ITEMS.push({ id: id, cat: cat, name: name, tags: (tags || '') + ' ' + name, make: make });
  }

  /* --- текст --- */
  I('h1', 'text', 'Заголовок H1', 'heading title', function () { return P('Заголовок страницы', 56, 600, null, { lineHeight: 1.1, maxWidth: '760px' }); });
  I('h2', 'text', 'Заголовок H2', 'heading', function () { return P('Заголовок секции', 40, 600, null, { lineHeight: 1.15 }); });
  I('h3', 'text', 'Заголовок H3', 'heading', function () { return P('Подзаголовок', 28, 600); });
  I('h4', 'text', 'Заголовок H4', 'heading', function () { return P('Небольшой заголовок', 22, 600); });
  I('eyebrow', 'text', 'Надзаголовок', 'eyebrow overline', function () { return P('О компании', 13, 600, C.accent, { letterSpacing: '0.08em' }); });
  I('lead', 'text', 'Лид-абзац', 'lead subtitle', function () { return P('Одна мысль, которая объясняет, зачем человеку остаться на странице.', 20, null, C.muted, { maxWidth: '640px' }); });
  I('para', 'text', 'Абзац', 'text paragraph', function () { return P('Обычный текст. Заменяй на свой — блок тянется по ширине родителя.', 16, null, null, { maxWidth: '680px' }); });
  I('caption', 'text', 'Подпись', 'caption small', function () { return P('Подпись к изображению или таблице', 13, null, C.muted); });
  I('quote', 'text', 'Цитата', 'quote blockquote', function () {
    return row(16, [F({ width: 3, height: 64, backgroundColor: C.accent, padding: 0 }, []), P('Работа, которую не стыдно показать через год.', 20, null, null, { maxWidth: '560px' })], { alignItems: 'flex-start' });
  });
  I('list', 'text', 'Список', 'ul bullets', function () {
    return col(10, ['Первый пункт списка', 'Второй пункт списка', 'Третий пункт списка'].map(function (t) {
      return row(10, [dot(C.accent), P(t, 16)], { alignItems: 'flex-start' });
    }));
  });
  I('olist', 'text', 'Нумерованный список', 'ol numbers', function () {
    return col(10, ['Оставь заявку', 'Согласуем задачу', 'Забирай результат'].map(function (t, i) {
      return row(10, [P(String(i + 1) + '.', 16, 700, C.accent), P(t, 16)], { alignItems: 'flex-start' });
    }));
  });
  I('link', 'text', 'Ссылка', 'link a', function () { return P('Читать подробнее', 16, 600, C.accent, { href: '#about' }); });
  I('code', 'text', 'Блок кода', 'code pre', function () {
    return box([P('npm install design-lab', 14, null, C.muted)], { borderRadius: 12, padding: 18 });
  });
  I('kbd', 'text', 'Клавиша', 'kbd shortcut', function () { return row(6, [chip('Ctrl'), P('+', 13, 600, C.muted), chip('K')]); });
  I('anchor', 'text', 'Якорь', 'anchor id', function () { return F({ anchor: 'section', width: '100%', height: 1, padding: 0 }, []); });

  /* --- кнопки --- */
  I('btn', 'action', 'Кнопка', 'button cta', function () { return B('Оставить заявку'); });
  I('btnGhost', 'action', 'Кнопка-контур', 'outline secondary', function () { return B('Подробнее', 'outline'); });
  I('btnPair', 'action', 'Две кнопки', 'cta pair', function () { return row(12, [B('Начать'), B('Узнать цену', 'outline')]); });
  I('btnIcon', 'action', 'Кнопка с иконкой', 'icon', function () { return B('↗  Открыть'); });
  I('iconBtn', 'action', 'Иконка-кнопка', 'icon square', function () { return B('✕', 'outline'); });
  I('btnBadge', 'action', 'Кнопка с бейджем', 'badge count', function () { return row(8, [B('Корзина', 'outline'), chip('3')]); });
  I('btnGroup', 'action', 'Группа кнопок', 'segmented group', function () {
    return F({ direction: 'row', gap: 4, backgroundColor: C.surf, borderRadius: 999, padding: 4 }, [pill('День', true), pill('Неделя'), pill('Месяц')]);
  });
  I('btnUp', 'action', 'Наверх', 'top scroll', function () { return B('↑  Наверх', 'outline', '#hero'); });
  I('btnDl', 'action', 'Скачать', 'download', function () { return B('↓  Скачать PDF'); });
  I('btnShare', 'action', 'Поделиться', 'share', function () { return B('Поделиться', 'outline'); });
  I('btnFav', 'action', 'В избранное', 'bookmark save', function () { return B('☆  В избранное', 'outline'); });
  I('btnLike', 'action', 'Лайк', 'like heart', function () { return row(8, [B('♥  128', 'outline'), B('♡', 'outline')]); });
  I('btnPrevNext', 'action', 'Назад и вперёд', 'prev next', function () { return row(10, [B('←  Назад', 'outline'), B('Вперёд  →', 'outline')]); });
  I('btnTg', 'action', 'Кнопка Telegram', 'telegram contact', function () { return B('Написать в Telegram', null, 'https://t.me/'); });

  /* --- метки --- */
  I('badge', 'mark', 'Бейдж', 'badge label', function () { return chip('Новинка'); });
  I('tagRow', 'mark', 'Ряд тегов', 'tags chips', function () { return row(8, [chip('Дизайн'), chip('Вёрстка'), chip('Поддержка')], { wrap: true }); });
  I('counter', 'mark', 'Счётчик', 'counter number', function () { return row(8, [P('1 248', 32, 700, C.accent), P('заказов', 14, null, C.muted)], { alignItems: 'flex-end' }); });
  I('status', 'mark', 'Статус', 'status dot online', function () { return row(8, [dot('#2ea86b'), P('Онлайн', 14, 600)]); });
  I('stars', 'mark', 'Рейтинг', 'rating stars', function () { return row(8, [P('★★★★★', 18, null, C.accent), P('4.9 · 212 отзывов', 14, null, C.muted)]); });
  I('avatar', 'mark', 'Аватар', 'avatar user', function () { return F({ width: 48, height: 48, borderRadius: 999, backgroundColor: C.surf, alignItems: 'center', justifyContent: 'center', padding: 0 }, [P('АК', 16, 700)]); });
  I('avatars', 'mark', 'Группа аватаров', 'avatars team', function () {
    return row(-8, ['АК', 'МД', 'ИВ', '+9'].map(function (t) {
      return F({ width: 40, height: 40, borderRadius: 999, backgroundColor: C.surf, alignItems: 'center', justifyContent: 'center', padding: 0 }, [P(t, 13, 700)]);
    }));
  });
  I('logo', 'mark', 'Логотип', 'logo brand', function () { return row(10, [sq(32, 8), P('Название', 20, 700)]); });
  I('divider', 'mark', 'Разделитель', 'divider hr line', function () { return line(); });
  I('spacer', 'mark', 'Отступ', 'spacer gap', function () { return F({ width: '100%', height: 48, padding: 0 }, []); });
  I('icon', 'mark', 'Иконка', 'icon square', function () { return sq(44, 12); });

  /* --- секции --- */
  I('container', 'layout', 'Контейнер 1100', 'container wrap', function () { return F({ maxWidth: '1100px', width: '100%', padding: '0 24px', gap: 24, direction: 'column' }, [P('Контент внутри контейнера', 16)]); });
  I('section', 'layout', 'Секция', 'section band', function () { return band('section', [P('Заголовок секции', 40, 600), P('Короткое описание секции.', 18, null, C.muted)]); });
  I('sectionSurf', 'layout', 'Секция с фоном', 'section surface', function () { return band('features', [P('Секция на подложке', 40, 600), P('Фон берётся из темы проекта.', 18, null, C.muted)], true); });
  I('hero', 'layout', 'Экран Hero', 'hero first screen', function () {
    return band('hero', [
      ANIM([P('Заголовок, ради которого остаются', 60, 600, null, { lineHeight: 1.08, maxWidth: '820px' })]),
      P('Подзаголовок в одну-две строки: что это, для кого и почему сейчас.', 20, null, C.muted, { maxWidth: '620px' }),
      row(12, [B('Начать'), B('Как это работает', 'outline', '#about')])
    ], false, '120px 0');
  });
  I('heroSplit', 'layout', 'Hero с картинкой', 'hero split image', function () {
    return band('hero', [row(40, [
      col(20, [P('Заголовок слева', 48, 600, null, { lineHeight: 1.1 }), P('Описание в два предложения. Справа — картинка или скриншот.', 18, null, C.muted), row(12, [B('Оставить заявку'), B('Цены', 'outline')])], { width: '52%' }),
      F({ width: '44%', padding: 0 }, [IMG('Скриншот продукта', 320)])
    ], { wrap: true, alignItems: 'center' })], false, '100px 0');
  });
  I('heroForm', 'layout', 'Hero с формой', 'hero form lead', function () {
    return band('hero', [row(40, [
      col(16, [P('Оставь заявку — ответим за час', 44, 600, null, { lineHeight: 1.12 }), P('Без спама и звонков без предупреждения.', 18, null, C.muted)], { width: '52%' }),
      card([field('Имя', 'Как к тебе обращаться'), field('Контакт', 'Телефон или Telegram'), B('Отправить')], { width: '40%' })
    ], { wrap: true, alignItems: 'flex-start' })], false, '100px 0');
  });
  I('cols2', 'layout', 'Две колонки', 'columns grid 2', function () { return cols(2, [card([P('Колонка 1', 20, 600), P('Текст колонки.', 16, null, C.muted)], { width: '48%' }), card([P('Колонка 2', 20, 600), P('Текст колонки.', 16, null, C.muted)], { width: '48%' })]); });
  I('cols3', 'layout', 'Три колонки', 'columns grid 3', function () {
    return cols(3, [1, 2, 3].map(function (i) { return card([P('Пункт ' + i, 20, 600), P('Короткое пояснение.', 15, null, C.muted)], { width: '31%' }); }));
  });
  I('cols4', 'layout', 'Четыре колонки', 'columns grid 4', function () {
    return cols(4, [1, 2, 3, 4].map(function (i) { return card([P('0' + i, 26, 700, C.accent), P('Подпись', 14, null, C.muted)], { width: '23%' }); }));
  });
  I('bento', 'layout', 'Бенто-сетка', 'bento grid', function () {
    return col(16, [
      row(16, [card([P('Большая плитка', 24, 600), P('Главное преимущество.', 15, null, C.muted)], { width: '62%' }), card([P('Плитка', 20, 600)], { width: '34%' })], { wrap: true, alignItems: 'stretch' }),
      row(16, [card([P('Плитка', 20, 600)], { width: '34%' }), card([P('Плитка', 20, 600)], { width: '30%' }), card([P('Плитка', 20, 600)], { width: '30%' })], { wrap: true, alignItems: 'stretch' })
    ], { width: '100%' });
  });
  I('split', 'layout', 'Сплит 50 на 50', 'split half', function () {
    return row(0, [F({ width: '50%', backgroundColor: C.surf, padding: 48 }, [P('Левая половина', 28, 600)]), F({ width: '50%', padding: 48 }, [P('Правая половина', 28, 600)])], { wrap: true, alignItems: 'stretch' });
  });
  I('sidebar', 'layout', 'Сайдбар и контент', 'sidebar layout', function () {
    return row(24, [
      col(10, [P('Разделы', 13, 600, C.muted), P('Первый', 16), P('Второй', 16), P('Третий', 16)], { width: '22%', backgroundColor: C.surf, borderRadius: 14, padding: 20 }),
      col(16, [P('Заголовок раздела', 30, 600), P('Основной текст страницы.', 16, null, C.muted)], { width: '72%' })
    ], { wrap: true, alignItems: 'flex-start' });
  });
  I('header', 'layout', 'Шапка', 'header navbar top', function () {
    return { type: 'header', props: { sticky: true, padding: '16px 32px' }, children: [row(10, [sq(28, 8), P('Название', 19, 700)]), { type: 'nav', props: { links: [{ label: 'О нас', href: '#about' }, { label: 'Цены', href: '#pricing' }, { label: 'Контакты', href: '#contacts' }] } }, B('Связаться', 'outline')] };
  });
  I('footer', 'layout', 'Футер', 'footer bottom', function () {
    return { type: 'footer', props: { padding: '28px 32px' }, children: [P('© 2026 Название', 14, null, C.muted), { type: 'nav', props: { links: [{ label: 'Наверх', href: '#hero' }, { label: 'Контакты', href: '#contacts' }] } }] };
  });
  I('footer3', 'layout', 'Футер в три колонки', 'footer columns', function () {
    return { type: 'footer', props: { padding: '48px 32px' }, children: [row(40, [
      col(10, [P('Название', 19, 700), P('Короткое описание компании.', 14, null, C.muted)], { width: '34%' }),
      col(8, [P('Разделы', 13, 600, C.muted), P('О нас', 15), P('Цены', 15), P('Блог', 15)], { width: '20%' }),
      col(8, [P('Контакты', 13, 600, C.muted), P('hello@site.ru', 15), P('+7 900 000-00-00', 15)], { width: '24%' })
    ], { wrap: true, alignItems: 'flex-start' })] };
  });
  I('cta', 'layout', 'CTA-полоса', 'cta call action', function () {
    return band('cta', [P('Готовы начать?', 36, 600), P('Ответим в течение часа в рабочее время.', 18, null, C.muted, { maxWidth: '560px' }), row(12, [B('Оставить заявку'), B('Написать в Telegram', 'outline', 'https://t.me/')])], true, '72px 0');
  });

  /* --- карточки --- */
  I('card', 'card', 'Карточка', 'card box', function () { return card([P('Заголовок карточки', 20, 600), P('Пояснение в одну-две строки.', 15, null, C.muted)]); });
  I('cardIcon', 'card', 'Карточка с иконкой', 'card icon feature', function () { return card([sq(44, 12), P('Преимущество', 20, 600), P('Что это даёт клиенту.', 15, null, C.muted)]); });
  I('cardImg', 'card', 'Карточка с картинкой', 'card image', function () { return card([IMG('Обложка', 180), P('Заголовок', 20, 600), P('Описание карточки.', 15, null, C.muted)], { padding: 16 }); });
  I('kpi', 'card', 'Карточка-цифра', 'kpi metric stat', function () { return card([P('98%', 40, 700, C.accent), P('клиентов возвращаются', 15, null, C.muted)]); });
  I('cardPrice', 'card', 'Карточка тарифа', 'price plan tariff', function () {
    return card([chip('Популярный'), P('Про', 24, 600), row(6, [P('990', 40, 700), P('₽ / мес', 15, null, C.muted)], { alignItems: 'flex-end' }), line(),
      col(8, ['Без лимита генераций', 'Все модели', 'История проектов'].map(function (t) { return row(8, [P('✓', 14, 700, C.accent), P(t, 15)]); })), B('Оформить')]);
  });
  I('cardRev', 'card', 'Карточка отзыва', 'review testimonial', function () {
    return card([P('★★★★★', 15, null, C.accent), P('Сделали за три дня то, что мы полгода не могли согласовать.', 17), row(10, [sq(36, 999), col(2, [P('Мария Д.', 14, 600), P('Основатель, «Полка»', 13, null, C.muted)])])]);
  });
  I('cardTeam', 'card', 'Карточка сотрудника', 'team person', function () { return card([IMG('Фото', 200), P('Иван Крылов', 18, 600), P('Ведущий дизайнер', 14, null, C.muted)], { padding: 16 }); });
  I('cardPost', 'card', 'Карточка статьи', 'blog article post', function () { return card([IMG('Обложка', 160), chip('Дизайн'), P('Как выбрать типографику для лендинга', 19, 600), P('7 минут чтения', 13, null, C.muted)], { padding: 16 }); });
  I('cardCase', 'card', 'Карточка кейса', 'case portfolio', function () { return card([IMG('Кейс', 200), P('Магазин «Полка»', 20, 600), P('Запуск за 3 дня, +40% к конверсии.', 15, null, C.muted), P('Смотреть кейс →', 15, 600, C.accent)], { padding: 16 }); });
  I('cardGlass', 'card', 'Стеклянная карточка', 'glass blur', function () { return card([P('Стеклянный блок', 20, 600), P('Полупрозрачная подложка поверх фона.', 15, null, C.muted)], { backgroundColor: 'rgba(255,255,255,.10)', backdropFilter: 'blur(14px)' }); });
  I('cardLink', 'card', 'Карточка-ссылка', 'link card', function () { return card([row(12, [col(6, [P('Документация', 18, 600), P('Как подключить за 10 минут', 14, null, C.muted)], { width: '86%' }), P('→', 22, 700, C.accent)], { justifyContent: 'space-between' })]); });
  I('cardProd', 'card', 'Карточка товара', 'product shop', function () {
    return card([IMG('Товар', 220), P('Кофе Гедео, 250 г', 17, 600), row(8, [P('890 ₽', 19, 700), P('1 190 ₽', 14, null, C.muted)], { alignItems: 'flex-end' }), B('В корзину')], { padding: 16 });
  });

  /* --- навигация --- */
  I('navbar', 'nav', 'Меню', 'nav menu links', function () { return { type: 'nav', props: { links: [{ label: 'Главная', href: '/' }, { label: 'О нас', href: '#about' }, { label: 'Цены', href: '#pricing' }, { label: 'Контакты', href: '#contacts' }] } }; });
  I('burger', 'nav', 'Бургер-меню', 'burger mobile menu', function () { return { type: 'burger', props: { links: [{ label: 'Главная', href: '/' }, { label: 'О нас', href: '#about' }, { label: 'Контакты', href: '#contacts' }] } }; });
  I('crumbs', 'nav', 'Хлебные крошки', 'breadcrumbs path', function () { return row(8, [P('Главная', 14, null, C.muted), P('/', 14, null, C.muted), P('Каталог', 14, null, C.muted), P('/', 14, null, C.muted), P('Кофе', 14, 600)]); });
  I('tabs', 'nav', 'Табы', 'tabs switch', function () { return row(4, [pill('Описание', true), pill('Состав'), pill('Доставка')], { backgroundColor: C.surf, borderRadius: 999, padding: 4 }); });
  I('pager', 'nav', 'Пагинация', 'pagination pages', function () { return row(8, [B('←', 'outline'), pill('1', true), pill('2'), pill('3'), P('…', 15, null, C.muted), pill('12'), B('→', 'outline')]); });
  I('stepper', 'nav', 'Шаги', 'stepper wizard', function () {
    return row(16, [['1', 'Заявка'], ['2', 'Согласование'], ['3', 'Запуск']].map(function (s, i) {
      return row(10, [F({ width: 28, height: 28, borderRadius: 999, backgroundColor: i === 0 ? C.accent : C.surf, alignItems: 'center', justifyContent: 'center', padding: 0 }, [P(s[0], 13, 700, i === 0 ? 'var(--sf-onAccent, #fff)' : null)]), P(s[1], 15, 600)]);
    }), { wrap: true });
  });
  I('toc', 'nav', 'Оглавление', 'toc contents', function () { return col(10, [P('Содержание', 13, 600, C.muted), P('1. Введение', 15, null, C.accent), P('2. Как это работает', 15), P('3. Цены', 15)], { backgroundColor: C.surf, borderRadius: 14, padding: 20, width: '260px' }); });
  I('anchors', 'nav', 'Якорное меню', 'anchors sticky', function () { return row(10, [pill('О нас', true), pill('Услуги'), pill('Цены'), pill('Контакты')], { wrap: true }); });
  I('bottomnav', 'nav', 'Нижняя навигация', 'mobile bottom tabbar', function () {
    return row(0, [['Главная', 1], ['Каталог', 0], ['Корзина', 0], ['Профиль', 0]].map(function (t) {
      return col(6, [sq(22, 6), P(t[0], 12, 600, t[1] ? C.accent : C.muted)], { alignItems: 'center', width: '25%' });
    }), { backgroundColor: C.surf, padding: '12px 0', width: '100%', justifyContent: 'space-between' });
  });
  I('search', 'nav', 'Поиск по сайту', 'search find', function () { return { type: 'search', props: { placeholder: 'Поиск по сайту' } }; });

  /* --- формы --- */
  I('input', 'form', 'Поле ввода', 'input text', function () { return box([P('Введите текст', 15, null, C.muted)]); });
  I('inputLabel', 'form', 'Поле с подписью', 'input label', function () { return field('Имя', 'Как к тебе обращаться'); });
  I('email', 'form', 'Почта', 'email mail', function () { return field('Почта', 'you@mail.ru'); });
  I('pass', 'form', 'Пароль', 'password', function () { return col(8, [P('Пароль', 14, 600), box([row(0, [P('••••••••', 15, null, C.muted), P('показать', 13, 600, C.accent)], { justifyContent: 'space-between' })])], { width: '100%' }); });
  I('phone', 'form', 'Телефон', 'phone tel', function () { return field('Телефон', '+7 900 000-00-00'); });
  I('area', 'form', 'Многострочное поле', 'textarea', function () { return col(8, [P('Сообщение', 14, 600), box([P('Расскажи о задаче…', 15, null, C.muted)], { height: 120 })], { width: '100%' }); });
  I('select', 'form', 'Выпадающий список', 'select dropdown', function () { return col(8, [P('Услуга', 14, 600), box([row(0, [P('Выбери из списка', 15, null, C.muted), P('▾', 14, 700, C.muted)], { justifyContent: 'space-between' })])], { width: '100%' }); });
  I('check', 'form', 'Чекбокс', 'checkbox', function () { return row(10, [F({ width: 20, height: 20, borderRadius: 6, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', padding: 0 }, [P('✓', 12, 700, 'var(--sf-onAccent, #fff)')]), P('Согласен с условиями', 15)]); });
  I('radio', 'form', 'Радиокнопки', 'radio choice', function () {
    return col(10, [['Наличными', 1], ['Картой', 0], ['Переводом', 0]].map(function (t) {
      return row(10, [F({ width: 18, height: 18, borderRadius: 999, backgroundColor: t[1] ? C.accent : C.surf, padding: 0 }, []), P(t[0], 15)]);
    }));
  });
  I('switch', 'form', 'Переключатель', 'switch toggle', function () {
    return row(12, [F({ width: 46, height: 26, borderRadius: 999, backgroundColor: C.accent, padding: 3, justifyContent: 'flex-end' }, [F({ width: 20, height: 20, borderRadius: 999, backgroundColor: '#fff', padding: 0 }, [])]), P('Присылать новости', 15)]);
  });
  I('slider', 'form', 'Слайдер', 'slider range', function () {
    return col(10, [row(0, [P('Бюджет', 14, 600), P('от 50 000 ₽', 14, null, C.muted)], { justifyContent: 'space-between' }),
      F({ width: '100%', height: 6, borderRadius: 999, backgroundColor: C.surf, padding: 0 }, [F({ width: '45%', height: 6, borderRadius: 999, backgroundColor: C.accent, padding: 0 }, [])])], { width: '100%' });
  });
  I('date', 'form', 'Дата', 'date picker calendar', function () { return field('Дата', '12.09.2026'); });
  I('otp', 'form', 'Код из СМС', 'otp pin code', function () { return row(10, [1, 2, 3, 4].map(function () { return F({ width: 52, height: 60, borderRadius: 12, backgroundColor: C.surf, alignItems: 'center', justifyContent: 'center', padding: 0 }, [P('0', 24, 700)]); })); });
  I('upload', 'form', 'Загрузка файла', 'upload file dropzone', function () {
    return col(10, [sq(40, 10), P('Перетащи файл или нажми', 16, 600), P('PNG, JPG или PDF до 10 МБ', 13, null, C.muted)], { alignItems: 'center', backgroundColor: C.surf, borderRadius: 14, padding: 36, width: '100%' });
  });
  I('formContact', 'form', 'Форма связи', 'form contact lead', function () {
    return card([P('Оставить заявку', 24, 600), row(16, [field('Имя', 'Иван'), field('Телефон', '+7 900 000-00-00')], { wrap: true, alignItems: 'flex-start' }), field('Задача', 'Пара слов о проекте'), row(12, [B('Отправить'), P('Ответим за час', 13, null, C.muted)])]);
  });
  I('subscribe', 'form', 'Подписка', 'newsletter subscribe', function () {
    return row(10, [box([P('you@mail.ru', 15, null, C.muted)], { width: '60%' }), B('Подписаться')], { wrap: true });
  });
  I('login', 'form', 'Форма входа', 'login auth signin', function () {
    return card([P('Вход', 26, 600), field('Логин', 'Твой логин'), field('Пароль', '••••••••'), B('Войти'), P('Нет аккаунта? Создать', 14, 600, C.accent)], { width: '380px' });
  });

  /* --- медиа --- */
  I('img', 'media', 'Картинка', 'image photo', function () { return IMG('Изображение', 320); });
  I('imgCap', 'media', 'Картинка с подписью', 'image caption', function () { return col(10, [IMG('Изображение', 300), P('Подпись к изображению', 13, null, C.muted)], { width: '100%' }); });
  I('gallery', 'media', 'Галерея', 'gallery grid photos', function () { return cols(3, [1, 2, 3].map(function () { return F({ width: '31%', padding: 0 }, [IMG('Фото', 200)]); })); });
  I('masonry', 'media', 'Мозаика', 'masonry gallery', function () {
    return row(16, [col(16, [IMG('Фото', 220), IMG('Фото', 140)], { width: '31%' }), col(16, [IMG('Фото', 140), IMG('Фото', 220)], { width: '31%' }), col(16, [IMG('Фото', 180), IMG('Фото', 180)], { width: '31%' })], { wrap: true, alignItems: 'flex-start' });
  });
  I('carousel', 'media', 'Карусель', 'carousel slider hscroll', function () {
    return { type: 'hscroll', props: { gap: 16, padding: 0 }, children: [1, 2, 3, 4].map(function (i) { return card([IMG('Слайд ' + i, 160), P('Слайд ' + i, 17, 600)], { width: '280px', padding: 12 }); }) };
  });
  I('logos', 'media', 'Логотипы клиентов', 'logos clients partners', function () {
    return row(28, [1, 2, 3, 4, 5].map(function () { return F({ width: 120, height: 44, borderRadius: 8, backgroundColor: C.surf, padding: 0 }, []); }), { wrap: true, justifyContent: 'center' });
  });
  I('videoCover', 'media', 'Обложка видео', 'video cover play', function () {
    return F({ width: '100%', height: 360, borderRadius: 16, backgroundColor: C.surf, alignItems: 'center', justifyContent: 'center', padding: 0 }, [F({ width: 72, height: 72, borderRadius: 999, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', padding: 0 }, [P('▶', 24, 700, 'var(--sf-onAccent, #fff)')])]);
  });
  I('beforeAfter', 'media', 'До и после', 'before after compare', function () {
    return row(16, [col(8, [IMG('До', 240), P('До', 14, 600, C.muted)], { width: '48%' }), col(8, [IMG('После', 240), P('После', 14, 600, C.accent)], { width: '48%' })], { wrap: true, alignItems: 'flex-start' });
  });

  /* --- данные --- */
  I('table', 'data', 'Таблица', 'table grid rows', function () {
    var head = row(0, [P('Услуга', 13, 700, C.muted, { width: '50%' }), P('Срок', 13, 700, C.muted, { width: '25%' }), P('Цена', 13, 700, C.muted, { width: '25%' })], { width: '100%' });
    var rows = [['Лендинг', '3 дня', '45 000 ₽'], ['Магазин', '7 дней', '90 000 ₽'], ['Поддержка', 'месяц', '15 000 ₽']].map(function (r) {
      return col(0, [row(0, [P(r[0], 15, null, null, { width: '50%' }), P(r[1], 15, null, C.muted, { width: '25%' }), P(r[2], 15, 600, null, { width: '25%' })], { width: '100%' }), line()], { width: '100%', gap: 12 });
    });
    return col(12, [head, line()].concat(rows), { width: '100%' });
  });
  I('priceRow', 'data', 'Строка прайса', 'price row menu', function () {
    return col(0, [row(0, [col(4, [P('Капучино', 17, 600), P('на альтернативном молоке +40 ₽', 13, null, C.muted)]), P('220 ₽', 17, 700)], { justifyContent: 'space-between', width: '100%' }), line()], { gap: 12, width: '100%' });
  });
  I('timeline', 'data', 'Таймлайн', 'timeline history', function () {
    return col(0, [['2024', 'Открыли студию'], ['2025', 'Сделали 40 проектов'], ['2026', 'Запустили конструктор']].map(function (t) {
      return row(16, [col(0, [dot(C.accent), F({ width: 2, height: 44, backgroundColor: C.line, padding: 0 }, [])], { alignItems: 'center' }), col(4, [P(t[0], 14, 700, C.accent), P(t[1], 16)])], { alignItems: 'flex-start' });
    }), { width: '100%' });
  });
  I('progress', 'data', 'Прогресс', 'progress bar', function () {
    return col(8, [row(0, [P('Готовность', 14, 600), P('72%', 14, 600, C.accent)], { justifyContent: 'space-between' }), F({ width: '100%', height: 8, borderRadius: 999, backgroundColor: C.surf, padding: 0 }, [F({ width: '72%', height: 8, borderRadius: 999, backgroundColor: C.accent, padding: 0 }, [])])], { width: '100%' });
  });
  I('stats4', 'data', 'Числа в ряд', 'stats metrics numbers', function () {
    return row(16, [['1 248', 'заказов'], ['98%', 'довольны'], ['3 дня', 'средний срок'], ['24/7', 'поддержка']].map(function (s) {
      return col(6, [P(s[0], 34, 700, C.accent), P(s[1], 14, null, C.muted)], { width: '23%' });
    }), { wrap: true });
  });
  I('chartBars', 'data', 'График-столбцы', 'chart bars graph', function () {
    var hs = [40, 72, 55, 90, 64, 110];
    return col(12, [row(10, hs.map(function (h) { return F({ width: 34, height: h, borderRadius: 8, backgroundColor: C.accent, padding: 0 }, []); }), { alignItems: 'flex-end' }), row(10, ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map(function (d) { return P(d, 12, null, C.muted, { width: 34 }); }))], { width: '100%' });
  });
  I('kanban', 'data', 'Канбан', 'kanban board tasks', function () {
    return row(16, [['В работе', 2], ['На проверке', 1], ['Готово', 3]].map(function (c) {
      var kids = [P(c[0], 14, 700, C.muted)];
      for (var i = 0; i < c[1]; i++) kids.push(card([P('Задача ' + (i + 1), 15, 600)], { padding: 14, backgroundColor: C.bg }));
      return col(12, kids, { width: '31%', backgroundColor: C.surf, borderRadius: 14, padding: 14 });
    }), { wrap: true, alignItems: 'flex-start' });
  });
  I('calendar', 'data', 'Календарь', 'calendar dates', function () {
    var cells = [];
    for (var d = 1; d <= 28; d++) cells.push(F({ width: 40, height: 40, borderRadius: 10, backgroundColor: d === 12 ? C.accent : C.surf, alignItems: 'center', justifyContent: 'center', padding: 0 }, [P(String(d), 13, 600, d === 12 ? 'var(--sf-onAccent, #fff)' : null)]));
    return col(12, [P('Сентябрь 2026', 17, 600), row(8, cells, { wrap: true })], { width: '100%' });
  });

  /* --- магазин --- */
  I('prodGrid', 'shop', 'Сетка товаров', 'products grid shop', function () {
    return cols(3, [1, 2, 3].map(function (i) { return card([IMG('Товар ' + i, 200), P('Товар ' + i, 17, 600), P('890 ₽', 18, 700), B('В корзину')], { width: '31%', padding: 14 }); }));
  });
  I('cartRow', 'shop', 'Строка корзины', 'cart row basket', function () {
    return col(0, [row(16, [sq(64, 10), col(4, [P('Кофе Гедео, 250 г', 16, 600), P('Обжарка средняя', 13, null, C.muted)], { width: '54%' }), row(8, [B('−', 'outline'), P('1', 15, 600), B('+', 'outline')]), P('890 ₽', 17, 700)], { justifyContent: 'space-between', width: '100%' }), line()], { gap: 14, width: '100%' });
  });
  I('summary', 'shop', 'Итог заказа', 'order summary total', function () {
    return card([P('Ваш заказ', 20, 600), row(0, [P('Товары', 15, null, C.muted), P('1 780 ₽', 15)], { justifyContent: 'space-between' }), row(0, [P('Доставка', 15, null, C.muted), P('300 ₽', 15)], { justifyContent: 'space-between' }), line(), row(0, [P('Итого', 17, 700), P('2 080 ₽', 20, 700, C.accent)], { justifyContent: 'space-between' }), B('Оформить заказ')], { width: '360px' });
  });
  I('coupon', 'shop', 'Промокод', 'coupon promo', function () { return row(10, [box([P('Промокод', 15, null, C.muted)], { width: '60%' }), B('Применить', 'outline')], { wrap: true }); });
  I('qty', 'shop', 'Количество', 'quantity counter', function () { return row(10, [B('−', 'outline'), P('1', 16, 600), B('+', 'outline')]); });
  I('variants', 'shop', 'Варианты', 'variants size color', function () { return col(10, [P('Объём', 14, 600), row(8, [pill('250 г', true), pill('500 г'), pill('1 кг')], { wrap: true })], { width: '100%' }); });
  I('plans3', 'shop', 'Тарифы в ряд', 'pricing plans tariffs', function () {
    var data = [['Free', '0 ₽', ['5 генераций в день', 'Все шаблоны']], ['Pro', '990 ₽', ['Без лимита', 'Все модели', 'История']], ['Team', '2 900 ₽', ['Всё из Pro', 'До 5 человек']]];
    return cols(3, data.map(function (d, i) {
      var kids = [P(d[0], 22, 600), row(6, [P(d[1], 34, 700), P('/ мес', 14, null, C.muted)], { alignItems: 'flex-end' }), line()];
      d[2].forEach(function (t) { kids.push(row(8, [P('✓', 14, 700, C.accent), P(t, 15)])); });
      kids.push(B(i === 1 ? 'Оформить' : 'Выбрать', i === 1 ? null : 'outline'));
      return card(kids, { width: '31%' });
    }));
  });
  I('payments', 'shop', 'Способы оплаты', 'payments methods', function () { return row(12, ['Картой', 'СБП', 'Наличными', 'Счёт'].map(function (t) { return chip(t); }), { wrap: true }); });
  I('guarantees', 'shop', 'Гарантии', 'guarantees trust', function () {
    return row(16, [['Возврат 14 дней', ''], ['Доставка от 2 дней', ''], ['Гарантия 1 год', '']].map(function (t) {
      return row(10, [sq(36, 10), P(t[0], 15, 600)], { width: '31%' });
    }), { wrap: true });
  });
  I('reviews3', 'shop', 'Отзывы в ряд', 'reviews testimonials', function () {
    return cols(3, [['Мария Д.', 'Сделали за три дня.'], ['Игорь П.', 'Наконец-то понятная цена.'], ['Анна К.', 'Поддержка отвечает сразу.']].map(function (r) {
      return card([P('★★★★★', 14, null, C.accent), P(r[1], 16), row(10, [sq(34, 999), P(r[0], 14, 600)])], { width: '31%' });
    }));
  });

  /* --- состояния --- */
  I('alert', 'state', 'Уведомление', 'alert notice', function () { return row(12, [dot(C.accent), P('Заявка отправлена. Ответим в течение часа.', 15)], { backgroundColor: C.surf, borderRadius: 12, padding: '14px 18px', width: '100%' }); });
  I('toast', 'state', 'Тост', 'toast snackbar', function () { return row(12, [P('Скопировано', 15, 600), P('Отменить', 14, 600, C.accent)], { backgroundColor: C.surf, borderRadius: 12, padding: '12px 16px', justifyContent: 'space-between', width: '320px' }); });
  I('empty', 'state', 'Пусто', 'empty state', function () { return col(12, [sq(48, 12), P('Пока ничего нет', 20, 600), P('Добавь первый проект — он появится здесь.', 15, null, C.muted), B('Создать', 'outline')], { alignItems: 'center', padding: 48, width: '100%' }); });
  I('e404', 'state', 'Страница 404', 'error 404 notfound', function () { return col(14, [P('404', 72, 700, C.accent), P('Такой страницы нет', 26, 600), P('Возможно, ссылка устарела.', 16, null, C.muted), B('На главную', 'outline', '/')], { alignItems: 'center', padding: 80, width: '100%' }); });
  I('skeleton', 'state', 'Скелетон', 'skeleton loading', function () { return col(12, [F({ width: '60%', height: 18, borderRadius: 6, backgroundColor: C.surf, padding: 0 }, []), F({ width: '100%', height: 12, borderRadius: 6, backgroundColor: C.surf, padding: 0 }, []), F({ width: '85%', height: 12, borderRadius: 6, backgroundColor: C.surf, padding: 0 }, [])], { width: '100%' }); });
  I('cookie', 'state', 'Cookie-баннер', 'cookie consent', function () { return row(16, [P('Мы используем cookie, чтобы сайт работал как надо.', 14, null, null, { width: '60%' }), row(10, [B('Принять'), B('Настроить', 'outline')])], { backgroundColor: C.surf, borderRadius: 14, padding: 18, wrap: true, justifyContent: 'space-between', width: '100%' }); });
  I('confirm', 'state', 'Подтверждение', 'confirm dialog modal', function () { return card([P('Удалить проект?', 22, 600), P('Действие нельзя отменить.', 15, null, C.muted), row(12, [B('Удалить'), B('Отмена', 'outline')])], { width: '380px' }); });

  /* --- маркетинг --- */
  I('faq', 'market', 'Вопросы и ответы', 'faq accordion questions', function () {
    return col(0, [['Сколько стоит?', 'От 45 000 ₽ за лендинг, точную смету считаем по задаче.'], ['Какие сроки?', 'Лендинг — три дня, магазин — неделя.'], ['Есть правки?', 'Две итерации входят в стоимость.']].map(function (q) {
      return col(0, [col(8, [row(0, [P(q[0], 18, 600), P('+', 20, 700, C.muted)], { justifyContent: 'space-between', width: '100%' }), P(q[1], 15, null, C.muted)], { padding: '18px 0', width: '100%' }), line()], { width: '100%' });
    }), { width: '100%' });
  });
  I('features3', 'market', 'Преимущества', 'features benefits', function () {
    return cols(3, [['Быстро', 'Первый макет через три дня.'], ['Прозрачно', 'Смета до начала работы.'], ['Надолго', 'Поддержка после запуска.']].map(function (f) {
      return card([sq(44, 12), P(f[0], 20, 600), P(f[1], 15, null, C.muted)], { width: '31%' });
    }));
  });
  I('steps', 'market', 'Как это работает', 'steps how process', function () {
    return cols(3, [['01', 'Заявка', 'Опиши задачу в двух предложениях.'], ['02', 'Смета', 'Присылаем цену и срок в тот же день.'], ['03', 'Запуск', 'Отдаём сайт и передаём доступы.']].map(function (s) {
      return card([P(s[0], 30, 700, C.accent), P(s[1], 20, 600), P(s[2], 15, null, C.muted)], { width: '31%' });
    }));
  });
  I('compare', 'market', 'Сравнение', 'compare table', function () {
    return col(12, [row(0, [P('', 13, 700, C.muted, { width: '50%' }), P('Мы', 13, 700, C.accent, { width: '25%' }), P('Обычно', 13, 700, C.muted, { width: '25%' })], { width: '100%' }), line()].concat([['Срок', '3 дня', '3 недели'], ['Правки', 'Входят', 'За деньги'], ['Поддержка', 'Есть', 'Нет']].map(function (r) {
      return col(0, [row(0, [P(r[0], 15, null, null, { width: '50%' }), P(r[1], 15, 600, null, { width: '25%' }), P(r[2], 15, null, C.muted, { width: '25%' })], { width: '100%' }), line()], { gap: 12, width: '100%' });
    })), { width: '100%' });
  });
  I('team', 'market', 'Команда', 'team people', function () {
    return cols(4, ['Иван Крылов', 'Мария Дол', 'Пётр Ким', 'Анна Ли'].map(function (n) {
      return col(10, [IMG('Фото', 180), P(n, 16, 600), P('Дизайнер', 13, null, C.muted)], { width: '23%' });
    }));
  });
  I('cases', 'market', 'Кейсы', 'cases portfolio works', function () {
    return cols(2, [['Магазин «Полка»', '+40% к конверсии'], ['Кофейня «Зёрна»', 'Запуск за 3 дня']].map(function (c) {
      return card([IMG('Кейс', 240), P(c[0], 22, 600), P(c[1], 15, null, C.muted), P('Смотреть →', 15, 600, C.accent)], { width: '48%', padding: 16 });
    }));
  });
  I('promo', 'market', 'Баннер акции', 'promo banner sale', function () {
    return row(20, [col(8, [chip('До 30 сентября'), P('Скидка 20% на первый проект', 28, 600)], { width: '60%' }), B('Забрать скидку')], { backgroundColor: C.surf, borderRadius: 18, padding: 32, wrap: true, justifyContent: 'space-between', width: '100%' });
  });
  I('countdown', 'market', 'Обратный отсчёт', 'countdown timer', function () {
    return row(12, [['02', 'дня'], ['14', 'часа'], ['38', 'минут']].map(function (t) {
      return col(4, [P(t[0], 32, 700), P(t[1], 12, null, C.muted)], { alignItems: 'center', backgroundColor: C.surf, borderRadius: 12, padding: '14px 18px' });
    }));
  });
  I('social', 'market', 'Соцдоказательство', 'social proof trust', function () {
    return row(14, [row(-8, ['АК', 'МД', 'ИВ'].map(function (t) { return F({ width: 34, height: 34, borderRadius: 999, backgroundColor: C.surf, alignItems: 'center', justifyContent: 'center', padding: 0 }, [P(t, 12, 700)]); })), P('и ещё 240 клиентов с нами', 15, null, C.muted)]);
  });

  /* --- продвинутые (htmlraw) --- */
  I('raw', 'adv', 'Свой HTML', 'html custom code', function () { return RAW('<div style="padding:24px;font:16px/1.5 system-ui">Свой HTML — замени содержимое блока.</div>', 160); });
  I('iframe', 'adv', 'Встроенная страница', 'iframe embed', function () { return RAW('<iframe src="https://example.com" style="width:100%;height:100%;border:0;border-radius:14px" loading="lazy"></iframe>', 420); });
  I('map', 'adv', 'Карта', 'map location osm', function () { return RAW('<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=37.60%2C55.74%2C37.66%2C55.78&amp;layer=mapnik" style="width:100%;height:100%;border:0;border-radius:14px" loading="lazy"></iframe>', 380); });
  I('video', 'adv', 'Видео', 'video youtube player', function () { return RAW('<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" style="width:100%;height:100%;border:0;border-radius:14px" allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>', 400); });
  I('audio', 'adv', 'Аудио', 'audio player sound', function () { return RAW('<audio controls style="width:100%"><source src="" type="audio/mpeg">Ваш браузер не умеет проигрывать аудио.</audio>', 80); });
  I('form3', 'adv', 'Внешняя форма', 'google form embed', function () { return RAW('<iframe src="https://docs.google.com/forms/d/e/FORM_ID/viewform?embedded=true" style="width:100%;height:100%;border:0" loading="lazy"></iframe>', 520); });
  I('gradient', 'adv', 'Живой градиент', 'gradient animated background', function () {
    return RAW('<div style="width:100%;height:100%;border-radius:16px;background:linear-gradient(120deg,#7c5cff,#2fb8ff,#7c5cff);background-size:300% 300%;animation:dlg 12s ease infinite"></div><style>@keyframes dlg{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}</style>', 260);
  });
  I('marquee', 'adv', 'Бегущая строка', 'marquee ticker', function () {
    return RAW('<div style="overflow:hidden;white-space:nowrap;padding:14px 0;font:600 18px/1 system-ui"><span style="display:inline-block;animation:dlm 18s linear infinite">Дизайн · Вёрстка · Поддержка · Дизайн · Вёрстка · Поддержка · </span></div><style>@keyframes dlm{from{transform:translateX(0)}to{transform:translateX(-50%)}}</style>', 70);
  });

  /* ============================ вставка на доску ========================= */
  /* Рендер и хранилище схемы лежат в index.html, имена оттуда неизвестны.
     Поэтому ищем и схему, и применитель операций по признакам, пробуем
     несколько способов подряд и ПРОВЕРЯЕМ, что дерево реально изменилось. */

  var lastWay = '';
  var seq = 0;

  function isSchema(v) {
    return !!v && typeof v === 'object' && Array.isArray(v.pages) && v.pages.length >= 0 && !Array.isArray(v);
  }
  function findSchema() {
    var holders = [window.SF, window.SFAI, window];
    var names = ['schema', 'state', 'doc', 'project', 'site', 'board', 'data', 'model'];
    var i, j, host, v;
    for (i = 0; i < holders.length; i++) {
      host = holders[i];
      if (!host) continue;
      for (j = 0; j < names.length; j++) {
        try { v = host[names[j]]; } catch (e) { continue; }
        if (isSchema(v)) return v;
      }
    }
    /* Ничего по имени — обходим свойства SF. */
    if (window.SF) {
      var keys;
      try { keys = Object.keys(window.SF); } catch (e) { keys = []; }
      for (i = 0; i < keys.length; i++) {
        try { v = window.SF[keys[i]]; } catch (e) { continue; }
        if (isSchema(v)) return v;
      }
    }
    return null;
  }
  function activePage(sc) {
    if (!sc || !sc.pages || !sc.pages.length) return null;
    for (var i = 0; i < sc.pages.length; i++) {
      if (sc.pages[i] && sc.pages[i].id === sc.activePageId) return sc.pages[i];
    }
    return sc.pages[0];
  }
  function count(node) {
    if (!node) return 0;
    var n = 1, kids = node.children || [];
    for (var i = 0; i < kids.length; i++) n += count(kids[i]);
    return n;
  }
  function snapshot() {
    var sc = findSchema();
    var pg = activePage(sc);
    return pg ? count(pg.root) : -1;
  }
  function withIds(node) {
    if (!node || typeof node !== 'object') return node;
    if (!node.id) node.id = 'dlb' + (Date.now() % 100000) + '_' + (++seq);
    var kids = node.children || [];
    for (var i = 0; i < kids.length; i++) withIds(kids[i]);
    return node;
  }

  /* Применитель операций: сначала по именам, потом по исходнику функции —
     он обязан знать про replacePage и setActivePage. */
  var applierCache = null;
  function looksApplier(fn) {
    if (typeof fn !== 'function') return false;
    var src;
    try { src = Function.prototype.toString.call(fn); } catch (e) { return false; }
    if (src.length > 200000) return false;
    return src.indexOf('replacePage') >= 0 && (src.indexOf('setActivePage') >= 0 || src.indexOf('setTheme') >= 0);
  }
  function findApplier() {
    if (applierCache) return applierCache;
    var named = [
      window.SFAI && window.SFAI.applyOps, window.SFAI && window.SFAI.apply,
      window.SF && window.SF.applyOps, window.SF && window.SF.apply,
      window.applyOps, window.sfApplyOps, window.applyBoardOps, window.applyAiOps, window.sfApply
    ];
    var i;
    for (i = 0; i < named.length; i++) {
      if (typeof named[i] === 'function') { applierCache = named[i]; return applierCache; }
    }
    var hosts = [window.SF, window.SFAI, window];
    for (i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      if (!host) continue;
      var keys;
      try { keys = Object.keys(host); } catch (e) { continue; }
      for (var j = 0; j < keys.length; j++) {
        var v;
        try { v = host[keys[j]]; } catch (e) { continue; }
        if (looksApplier(v)) { applierCache = v; return applierCache; }
      }
    }
    return null;
  }

  function rerender() {
    var names = ['render', 'draw', 'paint', 'refresh', 'update', 'renderAll', 'rerender'];
    var hosts = [window.SF, window];
    var done = false, i, j;
    for (i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      if (!host) continue;
      for (j = 0; j < names.length; j++) {
        var fn;
        try { fn = host[names[j]]; } catch (e) { continue; }
        if (typeof fn === 'function' && fn.length === 0) {
          try { fn.call(host); done = true; } catch (e) { }
        }
      }
    }
    ['sfRender', 'renderBoard', 'renderSchema', 'renderHtml'].forEach(function (n) {
      if (typeof window[n] === 'function') { try { window[n](); done = true; } catch (e) { } }
    });
    try { document.dispatchEvent(new CustomEvent('sf:change')); } catch (e) { }
    return done;
  }

  /* Пробуем применитель разными способами вызова и сверяем дерево. */
  function pushNode(node) {
    withIds(node);
    var before = snapshot();
    var fn = findApplier();
    var ops = [{ op: 'addNode', node: node }];
    var shapes = [
      function () { return fn(JSON.stringify({ say: '', ops: ops })); },
      function () { return fn({ say: '', ops: ops }); },
      function () { return fn(ops); }
    ];
    var i;
    if (fn) {
      for (i = 0; i < shapes.length; i++) {
        try { shapes[i](); } catch (e) { }
        if (before < 0 || snapshot() > before) { lastWay = 'applier'; return true; }
      }
    }
    /* Запасной путь: кладём узел в дерево активной страницы руками. */
    var sc = findSchema();
    var pg = activePage(sc);
    if (pg && pg.root) {
      if (!Array.isArray(pg.root.children)) pg.root.children = [];
      pg.root.children.push(node);
      rerender();
      lastWay = 'schema';
      return true;
    }
    lastWay = 'none';
    return false;
  }

  function insert(id) {
    var item = null;
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) item = ITEMS[i];
    if (!item) return false;
    var node;
    try { node = item.make(); } catch (e) { return false; }
    var ok = pushNode(node);
    if (typeof window.toast === 'function') {
      window.toast(ok ? ('Добавлено: ' + item.name) : 'Не удалось вставить блок — открой вкладку «Дизайн» и попробуй снова');
    }
    return ok;
  }

  /* ================================ панель =============================== */

  var CSS_ID = 'dl-blocks-catalog-css';
  function styles() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent =
      '[data-dl-catalog]{margin:14px 0 6px;padding-top:12px;border-top:1px solid rgba(128,128,128,.22)}' +
      '[data-dl-catalog] .dlc-h{display:flex;align-items:center;justify-content:space-between;font:600 12px/1.2 inherit;opacity:.7;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px}' +
      '[data-dl-catalog] .dlc-n{opacity:.55;font-weight:600;letter-spacing:0}' +
      '[data-dl-catalog] .dlc-q{width:100%;box-sizing:border-box;padding:8px 10px;margin:0 0 8px;border-radius:9px;border:1px solid rgba(128,128,128,.28);background:rgba(128,128,128,.10);color:inherit;font:inherit;font-size:13px;outline:none}' +
      '[data-dl-catalog] .dlc-q:focus{border-color:rgba(128,128,128,.55)}' +
      '[data-dl-catalog] .dlc-cats{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 10px}' +
      '[data-dl-catalog] .dlc-cat{border:0;cursor:pointer;font:600 11px/1 inherit;padding:6px 9px;border-radius:999px;background:rgba(128,128,128,.14);color:inherit;opacity:.75}' +
      '[data-dl-catalog] .dlc-cat:hover{opacity:1}' +
      '[data-dl-catalog] .dlc-cat.on{background:rgba(128,128,128,.34);opacity:1}' +
      '[data-dl-catalog] .dlc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;max-height:340px;overflow:auto}' +
      '[data-dl-catalog] .dlc-i{display:block;width:100%;text-align:left;cursor:pointer;border:1px solid rgba(128,128,128,.20);background:rgba(128,128,128,.07);color:inherit;border-radius:9px;padding:9px 10px;font:500 12px/1.25 inherit}' +
      '[data-dl-catalog] .dlc-i:hover{background:rgba(128,128,128,.18);border-color:rgba(128,128,128,.4)}' +
      '[data-dl-catalog] .dlc-i:active{transform:translateY(1px)}' +
      '[data-dl-catalog] .dlc-empty{opacity:.6;font-size:12px;padding:10px 2px}' +
      '@media (max-width:820px){[data-dl-catalog] .dlc-grid{grid-template-columns:1fr;max-height:300px}}';
    (document.head || document.documentElement).appendChild(s);
  }

  function norm(v) { return String(v || '').replace(/[\s\u00a0]+/g, ' ').trim().toLowerCase(); }

  /* Панель «Блоки» ищем так же, как preview-mode-clean.js: по табу «Блоки»
     и предку, где рядом лежат «Слои», «Свойства» и секция «Базовые». */
  function findPanelHost() {
    var tabs = document.querySelectorAll('button,[role="tab"]');
    for (var i = 0; i < tabs.length; i++) {
      if (norm(tabs[i].textContent) !== 'блоки') continue;
      var node = tabs[i].parentElement;
      for (var d = 0; node && d < 8 && node !== document.body; d++, node = node.parentElement) {
        var t = norm(node.textContent);
        if (t.length > 6000) break;
        if (t.indexOf('базовые') >= 0 && (t.indexOf('слои') >= 0 || t.indexOf('свойства') >= 0)) return node;
      }
    }
    return null;
  }
  /* Внутри панели ищем контейнер со списком базовых блоков — к нему и
     дописываем каталог, чтобы он скроллился вместе с остальными блоками. */
  function findList(panel) {
    var all = panel.querySelectorAll('div,section,ul');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (norm(el.textContent).indexOf('базовые') !== 0) continue;
      if (el.querySelector('[data-dl-catalog]')) return el;
      if (el.children.length >= 2 && norm(el.textContent).length < 3000) return el;
    }
    return panel;
  }

  var activeCat = '';
  var query = '';

  function matches(item) {
    if (activeCat && item.cat !== activeCat) return false;
    if (!query) return true;
    return norm(item.tags).indexOf(query) >= 0 || norm(item.name).indexOf(query) >= 0;
  }

  function paint(box) {
    var grid = box.querySelector('.dlc-grid');
    if (!grid) return;
    grid.textContent = '';
    var shown = 0;
    for (var i = 0; i < ITEMS.length; i++) {
      if (!matches(ITEMS[i])) continue;
      shown++;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dlc-i';
      b.textContent = ITEMS[i].name;
      b.title = 'Вставить: ' + ITEMS[i].name;
      b.setAttribute('data-dl-block', ITEMS[i].id);
      grid.appendChild(b);
    }
    if (!shown) {
      var e = document.createElement('div');
      e.className = 'dlc-empty';
      e.textContent = 'Ничего не нашлось. Попробуй «кнопка», «тариф», «форма».';
      grid.appendChild(e);
    }
    var n = box.querySelector('.dlc-n');
    if (n) n.textContent = shown + ' из ' + ITEMS.length;
  }

  function build(host) {
    if (host.querySelector('[data-dl-catalog]')) return host.querySelector('[data-dl-catalog]');
    var box = document.createElement('div');
    box.setAttribute('data-dl-catalog', '1');

    var head = document.createElement('div');
    head.className = 'dlc-h';
    head.innerHTML = '<span>Каталог элементов</span><span class="dlc-n"></span>';
    box.appendChild(head);

    var q = document.createElement('input');
    q.className = 'dlc-q';
    q.type = 'search';
    q.placeholder = 'Поиск: тариф, отзыв, форма, таблица…';
    box.appendChild(q);

    var cats = document.createElement('div');
    cats.className = 'dlc-cats';
    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'dlc-cat on';
    all.textContent = 'Все';
    all.setAttribute('data-dl-cat', '');
    cats.appendChild(all);
    CATS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dlc-cat';
      b.textContent = c[1];
      b.setAttribute('data-dl-cat', c[0]);
      cats.appendChild(b);
    });
    box.appendChild(cats);

    var grid = document.createElement('div');
    grid.className = 'dlc-grid';
    box.appendChild(grid);

    q.addEventListener('input', function () { query = norm(q.value); paint(box); });
    q.addEventListener('keydown', function (e) { e.stopPropagation(); });
    cats.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.dlc-cat') : null;
      if (!b) return;
      e.preventDefault();
      activeCat = b.getAttribute('data-dl-cat') || '';
      Array.prototype.forEach.call(cats.children, function (x) { x.classList.toggle('on', x === b); });
      paint(box);
    });
    grid.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-dl-block]') : null;
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      insert(b.getAttribute('data-dl-block'));
    });

    host.appendChild(box);
    paint(box);
    return box;
  }

  function mount() {
    var panel = findPanelHost();
    if (!panel) return false;
    styles();
    build(findList(panel));
    return true;
  }

  /* ============================ словарь для ИИ =========================== */
  /* Модель раньше не знала, из чего собирать страницу, и клала целую секцию
     одним абзацем — редактировать было нечего. Теперь она получает тот же
     каталог и требование дробить контент на отдельные узлы. */

  function vocab() {
    var byCat = {};
    ITEMS.forEach(function (it) {
      if (!byCat[it.cat]) byCat[it.cat] = [];
      byCat[it.cat].push(it.name);
    });
    var lines = [];
    CATS.forEach(function (c) {
      var list = byCat[c[0]];
      if (list && list.length) lines.push(c[1] + ': ' + list.join(', ') + '.');
    });
    return lines.join('\n');
  }

  var PROMPT_MARK = 'КАТАЛОГ ЭЛЕМЕНТОВ DESIGN LAB';
  function promptTail() {
    return '\n\n' + PROMPT_MARK + ' — собирай страницу из этих элементов.\n' +
      'Типы узлов только такие: frame, paragraph, button, image, nav, header, footer, hscroll, burger, search, animation, htmlraw. ' +
      'Любой элемент ниже — это композиция из них, а не отдельный type.\n' +
      vocab() + '\n' +
      'ПРАВИЛА СБОРКИ (от них зависит, сможет ли человек потом править сайт мышкой):\n' +
      '1. Дроби контент. Надзаголовок, заголовок, описание и кнопка — четыре разных узла, а не один paragraph с переносами.\n' +
      '2. Каждая секция — отдельный frame с anchor и внутренним frame maxWidth 1100px.\n' +
      '3. Повторяющиеся сущности (тарифы, отзывы, товары, шаги, преимущества) — отдельные frame-карточки в одном frame с direction row, wrap true.\n' +
      '4. Цвета бери из темы: var(--sf-bg), var(--sf-surface), var(--sf-text), var(--sf-muted), var(--sf-accent). Своих hex в props не пиши.\n' +
      '5. Не клади в htmlraw то, что можно собрать из frame и paragraph: htmlraw не редактируется блоками.\n' +
      '6. Текст — русский, цены в рублях, кавычки-ёлочки, никаких Lorem ipsum и John Doe.';
  }

  function patchPrompt() {
    var S = window.SFAI;
    if (!S || typeof S.systemPrompt !== 'function' || S.systemPrompt.__dlCatalog) return false;
    var orig = S.systemPrompt;
    var wrapped = function () {
      var base = orig.apply(this, arguments);
      if (typeof base !== 'string') return base;
      if (base.indexOf(PROMPT_MARK) >= 0) return base;
      return base + promptTail();
    };
    wrapped.__dlCatalog = true;
    S.systemPrompt = wrapped;
    return true;
  }

  /* ================================ запуск =============================== */

  window.DLBlocks = {
    cats: CATS,
    items: ITEMS,
    names: function () { return ITEMS.map(function (i) { return i.name; }); },
    build: function (id) {
      for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i].make();
      return null;
    },
    insert: insert,
    vocab: vocab,
    mount: mount
  };

  window.dlBlocksCatalog = function () {
    return {
      items: ITEMS.length,
      cats: CATS.length,
      panel: !!document.querySelector('[data-dl-catalog]'),
      schema: !!findSchema(),
      applier: !!findApplier(),
      lastInsert: lastWay || '—',
      promptPatched: !!(window.SFAI && window.SFAI.systemPrompt && window.SFAI.systemPrompt.__dlCatalog)
    };
  };

  function boot() {
    styles();
    mount();
    patchPrompt();
  }

  var tries = 0;
  var timer = setInterval(function () {
    patchPrompt();
    mount();
    if (++tries > 120) clearInterval(timer);
  }, 400);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', boot);

  /* Панель пересобирается при каждом открытии — возвращаем каталог назад. */
  if (window.MutationObserver) {
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () {
        pending = false;
        if (!document.querySelector('[data-dl-catalog]')) mount();
      }, 220);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
