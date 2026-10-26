---
id: ship-checklist
title: Приёмка перед ответом
priority: 15
tiers: nano, small, mid, large, frontier
modes: any
sources: jakubkrehel/skills (interface-review), MengTo/Skills (audit-verify-explain-grade-5), julianoczkowski/designer-skills (design-review), staurus86/global-design-skill (checklists)
---
ПЕРЕД ВЫДАЧЕЙ КОДА молча проверь каждый пункт и исправь нарушения. Список в ответ не пиши.

1. Открой мысленно 360px: ничего не обрезано, нет горизонтальной прокрутки, кнопки не уехали.
2. Ровно один <h1>. Заголовки идут по уровням без пропусков.
3. Есть <!DOCTYPE html>, lang, <meta name="viewport">, осмысленный <title>, alt у каждой картинки.
4. Ни одного цвета мимо переменных :root. Посчитай: не больше трёх цветов плюс нейтрали.
5. Акцент занимает меньше 10% площади первого экрана.
6. Каждый интерактивный элемент имеет :hover и :focus-visible. Видимое кольцо фокуса не срезано.
7. @media (prefers-reduced-motion: reduce) отключает все переходы и анимации.
8. Ни одного «Lorem», «Feature 1», «Your text here». Текст — про тему пользователя, конкретный.
9. Соседние секции не повторяют композицию друг друга.
10. Ответ — один цельный HTML-документ без markdown-обёрток, без пояснений до и после.
