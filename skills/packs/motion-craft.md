---
id: motion-craft
title: Движение
priority: 40
tiers: mid, large, frontier
modes: any
intent: анимац, движен, переход, animation, motion, hover, скролл, scroll, parallax
sources: jakubkrehel/skills (better-ui/animations.md, better-ui/performance.md), staurus86/global-design-skill (rules/05-animation.md), MengTo/Skills (web-design/animation-systems, animation-on-scroll, optimize-web-animations), Owl-Listener/designer-skills (interaction-design/animation-principles, doherty-threshold)
---
ДВИЖЕНИЕ ОБЪЯСНЯЕТ, откуда элемент пришёл и куда денется. Всё остальное — шум.

Тайминги и кривые
• transition: all запрещён. Перечисляй свойства: transition-property: opacity, transform.
• Заведи токены: --ease: cubic-bezier(0.25, 0.46, 0.45, 0.94) для обычных переходов, cubic-bezier(0.16, 1, 0.3, 1) для появления.
• hover ~150ms, смена состояния 200–250ms, перестройка блока меньше 350ms. Выше 400ms интерфейс кажется медленным.
• Bounce и elastic — только для того, что имеет массу: перетаскивание, шторка. На кнопках и меню — нет.

Что анимировать
• Только transform и opacity. height, padding, top, left, width вызывают перевёрстку и рывки.
• Раскрытие по высоте: grid-template-rows: 0fr → 1fr. Нажатие: transform: scale(0.96) — именно 0.96, меньше 0.95 выглядит карикатурно.
• Переходы состояний делай через CSS transition (их можно прервать на середине). @keyframes оставь для одноразовых сценариев.
• Иконка меняется не через display, а сменой opacity + scale 0.25→1 + blur 4px→0.

Появление при скролле
• Одно осмысленное движение на секцию, служащее ритму рассказа. Не на каждый div.
• Каскад: задержки 0.1 / 0.2 / 0.3s между смысловыми частями блока, не между всеми элементами.
• Уход мягче прихода: небольшой фиксированный translateY, ease-out и на вход, и на выход.
• Первую отрисовку не анимируй: контент первого экрана должен быть виден сразу.

Обязательно
• @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
• will-change ставь перед взаимодействием и снимай после. Постоянный will-change съедает память.
