# Design&Lab

ИИ-конструктор красивых сайтов: галерея из 98 премиум-шаблонов, редактор «опиши словами»,
загрузка своего **ZIP/папки** в предпросмотр и встроенный **аудит безопасности**.
Теперь с бэкендом — ключи ИИ живут на сервере, а не в коде сайта.

```
project/
├── backend/                 FastAPI
│   ├── main.py              точка входа: CORS + роутеры + раздача статики
│   ├── config.py            настройки из .env (ключи, провайдер, пути)
│   ├── models.py            Pydantic-схемы запросов/ответов
│   ├── prompts.py           системный промпт против «ИИ-слопа» (impeccable)
│   ├── ai.py                POST /api/ai  → прокси к OpenAI-совместимому API
│   ├── projects.py          CRUD /api/projects (JSON-файлы, потом SQLite/PG)
│   ├── audit.py             POST /api/audit → статический аудит багов/дыр
│   ├── design_skills.py     подбор дизайн-системы из базы (что делать)
│   ├── model_profiles.py    профиль каждой модели: класс, бюджет, зрение
│   ├── skill_packs.py       дизайн-паки под модель (как не испортить)
│   ├── test_*.py            тесты (TestClient, сеть замокана)
│   └── requirements.txt
├── skills/
│   ├── packs/*.md           17 паков правил из 10 открытых наборов скиллов
│   └── SOURCES.md           откуда взято: репозиторий, коммит, лицензия
├── frontend/                статика (её же раздаёт бэкенд)
│   ├── index.html           только разметка + подключение файлов
│   ├── style.css            все стили
│   └── js/
│       ├── core.js          утилиты, галерея, движок ZIP/папок, аудит
│       ├── api.js           клиент бэкенда (/api/ai, /api/projects, /api/audit)
│       ├── editor.js        редактор, чат (fetch → /api/ai), проекты, голос
│       └── main.js          инициализация, роутер, drag&drop
├── .env.example
└── README.md
```

## Запуск

```bash
git clone <repo>
cd design-lab
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

cp .env.example .env          # впиши свой AI_API_KEY (можно бесплатный OpenRouter)

uvicorn backend.main:app --reload
# открой http://localhost:8000
```

Бесплатный вариант без затрат: заведи ключ на **openrouter.ai**, в `.env` оставь
`AI_BASE_URL=https://openrouter.ai/api/v1` и `AI_MODEL=qwen/qwen3-coder:free`.
Без ключа сайт всё равно открывается и показывает офлайн-демо + загрузку ZIP/папок.

### Docker

```bash
docker build -t design-lab .
docker run -p 8000:8000 -e AI_API_KEY=... design-lab
```

### Деплой на Render

Репозиторий содержит `render.yaml` (Blueprint) и `Procfile`. На Render: New → Blueprint →
выбери репозиторий → задай секрет `AI_API_KEY` в дашборде. Порт берётся из `$PORT`
автоматически.

## API

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/health` | статус сервиса |
| GET | `/api/models` | готов ли серверный ключ ИИ |
| POST | `/api/ai` | `{mode, message, html, model?, images?}` → `{html, model, say}` |
| POST | `/api/ai/stream` | то же, потоково (SSE): события `{delta}` … финал `{done, html}` |
| POST | `/api/audit` | `{html}` → оценка 0–100 + список проблем |
| GET | `/api/projects` | список проектов |
| POST | `/api/projects` | создать/обновить (`{id?, name, html, kind}`) |
| GET | `/api/projects/{id}` | загрузить проект |
| DELETE | `/api/projects/{id}` | удалить |
| POST | `/api/auth/register`, `/api/auth/login` | → `{token, username}` |
| GET | `/api/auth/me`, POST `/api/auth/logout` | текущий пользователь / выход |
| GET | `/api/design/stats` | размер базы дизайн-скиллов и паков |
| GET | `/api/design/skill` | какой скилл и какие паки подобраны (`message`, `model`, `mode`) |
| GET | `/api/design/packs` | каталог дизайн-паков и профилей моделей |

`/api/ai` работает с любым **OpenAI-совместимым** провайдером (OpenAI, OpenRouter, Cerebras,
Mistral, Groq, локальные) — задаётся через `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY`.

## Хранилище

По умолчанию проекты лежат в JSON-файлах (`data/projects/`). Для многих проектов переключись
на SQLite одной переменной: `STORE=sqlite` (появится `data/projects.db`). Интерфейс в
`backend/store.py` изолирован — позже так же добавляется Postgres.

## Аккаунты и приватные проекты

**Включено по умолчанию** (`AUTH_ENABLED=1`). Раньше значение по умолчанию было `0`, и при
пустой переменной любой анонимный запрос читал, перезаписывал и удалял проекты ВСЕХ
пользователей: `/api/projects` отдавал общий список. Теперь проекты приватные сразу.

Учётные записи, пароли и сессии живут только во внешнем сервисе `USER_DB_SERVICE_URL`
(репозиторий `design-lab-users`): Argon2id, случайный session token, в базе — SHA-256 от него.
Локальной SQLite-аутентификации в этом приложении нет. Фронтенд шлёт `Authorization: Bearer`
автоматически.

## Тесты

```bash
# бэкенд (Python, сеть и сервис пользователей замоканы)
python3 backend/test_backend.py                 # API + проекты + аудит  → 22/22
STORE=sqlite python3 backend/test_backend.py    # то же на SQLite        → 22/22
python3 backend/test_stream.py                  # streaming (SSE)        → 8/8
python3 backend/test_auth.py                    # вход + приватность     → 20/20
python3 backend/test_security.py                # регрессии на дыры      → 51/51
python3 backend/test_skill_packs.py             # дизайн-паки по моделям → 39/39

# сверка: сервер и браузер выбирают модели одни и те же паки
python3 backend/test_skill_packs.py --dump > /tmp/expected.json
node tools/test_skill_packs_parity.js /tmp/expected.json
```

`backend/_testkit.py` подставляет заглушки вместо сервиса пользователей и провайдера ИИ,
поэтому тесты не ходят в сеть и не требуют ключей.

## Безопасность

- **Ключи только на сервере** (`.env`, не коммитится). В коде сайта ключей нет.
- Проекты приватные по умолчанию: `AUTH_ENABLED=1`.
- **Тариф нельзя выдать себе самому.** `/api/plan/subscribe` отключён
  (`SELF_SERVE_PLANS=0`), тариф ставит сервис пользователей после оплаты или
  администратор через `/api/admin/plans/grant` с заголовком `X-Admin-Token`.
- **`TRUSTED_PROXY_HOPS=1`** — сколько наших прокси стоит перед приложением.
  От этого зависят все лимиты: `X-Forwarded-For` клиент пишет целиком, поэтому
  доверять можно только последним адресам цепочки. Прямое подключение — `0`.
- Логины на `gh_` заняты входом через GitHub: обычная регистрация их не получает,
  иначе можно было заранее занять `gh_<чужой-логин>`.
- Аудит `/api/audit` работает за линейное время: проверки идут по разобранным
  тегам, а не регулярками с неограниченным `[^>]*` и хвостом.
- Аудит ловит утёкшие секреты, XSS-риски, `target=_blank` без `noopener`, mixed-content,
  скрипты без SRI, отсутствие CSP/viewport/`lang`/`alt` и т.д.
- В проде задай `CORS_ORIGINS` своим доменом (не `*`).
- Диагностика провайдеров (`/api/*/check`) и `/api/admin/*` отвечают `404` без
  верного `ADMIN_API_TOKEN`, чтобы не подтверждать существование маршрутов.

## Дизайн-скиллы

Два слоя знания, которые дописываются в системный промпт любой модели:
конкретная дизайн-система из базы (`design_skills.py`) и ремесленные правила под
класс модели (`skill_packs.py`, собраны из 10 открытых наборов дизайн-скиллов).
Подробно — в [DESIGN-SKILLS.md](DESIGN-SKILLS.md), источники — в
[skills/SOURCES.md](skills/SOURCES.md).

## Дальше (по желанию)
- Хранилище проектов: JSON → SQLite/Postgres (интерфейс в `projects.py` уже изолирован).
- Живой запуск проектов со сборкой (React/Vite/Next) — через WebContainers или sandbox-раннер
  на сервере; сейчас `/api` определяет фреймворк и стартовую команду и показывает статику.
- Маршруты смены логина и пароля в сервисе пользователей: сейчас `/api/profile/*`
  честно отвечает `501`, потому что в `design-lab-users` их ещё нет.
