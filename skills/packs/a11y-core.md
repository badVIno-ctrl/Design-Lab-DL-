---
id: a11y-core
title: Доступность
priority: 45
tiers: small, mid, large, frontier
modes: any
intent: доступн, a11y, скринридер, клавиатур, aria, focus, фокус, контраст
sources: jakubkrehel/skills (better-accessibility), staurus86/global-design-skill (rules/07-accessibility.md), Owl-Listener/designer-skills (design-systems, interaction-design/form-design), master5d/claude-design-skills (fixing-accessibility)
---
ДОСТУПНОСТЬ — часть вёрстки, а не отдельный этап.

Семантика
• header, nav, main, section, footer, article. div с onclick — не кнопка.
• Кнопка, которая действует, — <button>. Кнопка, которая ведёт, — <a href>. Не наоборот.
• Список — <ul>/<ol>. Иконка без подписи получает aria-label. Декоративная иконка — aria-hidden="true".
• Не ставь ARIA там, где хватает нативного тега. Неверный role хуже отсутствующего.

Клавиатура и фокус
• :focus-visible с видимым кольцом: outline: 2px solid var(--accent); outline-offset: 2px. Никогда outline: none без замены.
• Порядок табуляции совпадает с визуальным порядком. tabindex больше 0 не используй.
• Модальное окно: фокус переходит внутрь, Esc закрывает, фокус возвращается на кнопку-источник.
• Всплывающее меню открывается и закрывается с клавиатуры, а не только по hover.

Формы
• У каждого поля есть <label for>. Placeholder не заменяет подпись.
• Ошибка привязана через aria-describedby и написана словами, что сделать: «Введи телефон в формате +7…».
• autocomplete и правильный type (email, tel, url) — иначе на телефоне неудобная клавиатура.
• required и aria-invalid ставь на само поле.

Мелочи, которые ломают всё
• Тач-цель минимум 44×44px. Кликабельная зона может быть больше видимой через ::after.
• Контраст текста 4.5:1, иконок и границ 3:1.
• Картинке — alt по смыслу; декоративной — alt="".
• Текст масштабируется до 200% без обрезки: не задавай height у блоков с текстом.
• Ни одного сообщения только цветом: добавь иконку или подпись.
