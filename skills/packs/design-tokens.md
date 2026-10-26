---
id: design-tokens
title: Токены дизайн-системы
priority: 70
tiers: large, frontier
modes: any
intent: токен, дизайн-систем, переменн, token, variable, тема, theme
sources: julianoczkowski/designer-skills (design-tokens), imsaif/design-with-claude (design-system, set-project-profile), staurus86/global-design-skill (tokens/), superdesigndev/superdesign-skill (design system flow)
---
ВСЁ ЧЕРЕЗ ПЕРЕМЕННЫЕ. Ни одного значения цвета, радиуса, тени и длительности прямо в правиле.

Имена
• Семантические, а не буквальные: --color-bg-primary, а не --white. --color-text-muted, а не --gray-500.
• Имя должно рассказывать о продукте, а не о шаблоне. Для чайной лавки --clay и --steam честнее, чем --surface-2.
• Три слоя: сырые значения → семантические токены → токены компонентов (--button-bg ссылается на --color-accent).

Обязательный набор
• Цвет: bg-primary / bg-secondary / bg-tertiary, text-primary / text-muted / text-inverse, border-subtle / border-strong, accent / accent-hover / accent-contrast, состояния success / warning / danger.
• Типографика: семейства display и body, 4–6 размеров, 2–3 веса, 2 межстрочных, tracking для заголовков.
• Пространство: шаг 4px, ступени 4/8/12/16/24/32/48/64/96/140.
• Форма: radius-sm / md / lg / full, border-width.
• Глубина: shadow-sm / md / lg одной пропорции.
• Движение: duration-fast / base / slow, ease-standard / ease-enter.

Темы
• Обе темы проектируются, светлая и тёмная. Тёмная — не инверсия: у неё свои значения светлоты и насыщенности.
• Переключение через [data-theme="dark"] плюс @media (prefers-color-scheme: dark) как значение по умолчанию.
• Компоненты не знают о теме: они читают только семантические токены.

Дисциплина
• Один набор токенов на все страницы. Если на второй странице другая тень — это разъезд системы, самый заметный признак непрофессиональной работы.
• Значение, использованное один раз, токеном не становится. Токен — то, что повторяется.
