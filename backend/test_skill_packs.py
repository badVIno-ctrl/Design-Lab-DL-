"""Дизайн-паки: отбор по моделям, бюджеты и сборка промпта. Без сети.

Запуск:  python3 backend/test_skill_packs.py
Дамп ожиданий для JS-сверки:  python3 backend/test_skill_packs.py --dump
"""
import json
import os
import sys
import tempfile

os.environ.setdefault("DATA_DIR", tempfile.mkdtemp(prefix="dl_packs_"))
os.environ.setdefault("FRONTEND_DIR", tempfile.mkdtemp(prefix="dl_packs_fe_"))

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend import model_profiles as mp          # noqa: E402
from backend import skill_packs as sp             # noqa: E402
from backend.prompts import build_system_prompt   # noqa: E402

# Наборы, на которых сверяются оба движка отбора: Python и JS.
CASES = [
    ("google/gemma-4-31b-it:free", "scratch", "сайт кофейни в центре", False),
    ("openai/gpt-oss-20b:free", "scratch", "лендинг с ценами и отзывами", False),
    ("cohere/north-mini-code:free", "edit", "поправь отступы в шапке", False),
    ("openrouter/free", "scratch", "сайт кофейни", False),
    ("qwen3.6-35b-a3b", "scratch", "форма записи к врачу", False),
    ("gemma-4-31b", "scratch", "плакат на концерт", False),
    ("claude-haiku-4-5", "edit", "сделай кнопку заметнее", False),
    ("glm-4.6", "scratch", "лендинг для студии дизайна с ценами", False),
    ("kiwi::glm-5.2", "scratch", "магазин керамики", False),
    ("zai-glm-4.7", "scratch", "админ-панель склада, таблица заказов", False),
    ("mistral-large-latest", "edit", "перепиши текст на первом экране", False),
    ("gemini-3.6-flash", "scratch", "повтори макет со скриншота", True),
    ("gemini-3.1-flash-lite", "scratch", "вот скриншот, сделай так же", True),
    ("claude-sonnet-4-6", "scratch", "портфолио фотографа", False),
    ("claude-sonnet-5", "scratch", "дашборд аналитики продаж", False),
    ("deepseek-v4-pro", "scratch", "сайт юридической фирмы", False),
    ("claude-opus-4-8-thinking", "scratch", "сайт клиники, спокойный стиль", False),
    ("claude-opus-5-thinking", "scratch", "сайт винодельни, премиум", False),
    ("gpt-5-6-terra", "edit", "поменяй цвет кнопки", False),
    ("gpt-5-6", "scratch", "афиша выставки", False),
    ("совсем-новая-модель-9000", "scratch", "сайт клиники", False),
]


def dump():
    out = []
    for model, mode, message, images in CASES:
        result = sp.select(model, mode, message, images)
        out.append({
            "model": model, "mode": mode, "message": message, "images": images,
            "expect": {
                "tier": result["profile"]["tier"],
                "used": result["used"],
                "packs": result["ids"],
            },
        })
    print(json.dumps(out, ensure_ascii=False))


if "--dump" in sys.argv:
    dump()
    raise SystemExit(0)

P = 0
F = 0


def ok(name, condition):
    global P, F
    if condition:
        P += 1
        print("  \u2705", name)
    else:
        F += 1
        print("  \u274c", name)


print("\n== база паков ==")
ok("паки найдены", sp.available())
ok("20 паков", len(sp.packs()) == 20)
ok("у всех есть тело", all(pack["body"] for pack in sp.packs()))
ok("у всех указан источник", all(pack["sources"] for pack in sp.packs()))
ok("приоритеты уникальны", len({p["priority"] for p in sp.packs()}) == len(sp.packs()))
ok("id уникальны", len({p["id"] for p in sp.packs()}) == len(sp.packs()))
_gates = [p for p in sp.packs() if p["id"] == "beautiful-gates"]
ok("пак порядка работы лежит в обязательной полосе",
   len(_gates) == 1 and _gates[0]["priority"] < sp.MANDATORY_BELOW)

print("\n== обязательный минимум получает КАЖДАЯ модель ==")
floor = {"anti-slop", "ship-checklist", "beautiful-gates"}
missing = []
for name in list(mp.catalog()) + ["неизвестная-модель", ""]:
    for mode in ("scratch", "edit"):
        ids = set(sp.select(name, mode, "сайт кофейни")["ids"])
        if not floor <= ids:
            missing.append((name, mode))
ok("anti-slop, ship-checklist и beautiful-gates всегда на месте", not missing)
if missing:
    print("     нет у:", missing[:5])

print("\n== бюджет соблюдается ==")
over = []
for name in mp.catalog():
    result = sp.select(name, "scratch", "лендинг с ценами, дашборд, форма, скриншот, плакат")
    extra = sum(p["size"] for p in result["packs"] if p["priority"] >= sp.MANDATORY_BELOW)
    if extra > result["budget"]:
        over.append((name, extra, result["budget"]))
ok("добираемые паки не превышают бюджет", not over)
if over:
    print("     превышение:", over[:5])

print("\n== слабая модель получает меньше, сильная больше ==")
sizes = {}
for name, tier in [("google/gemma-4-31b-it:free", "nano"), ("openrouter/free", "small"),
                   ("glm-4.6", "mid"), ("claude-sonnet-5", "large"), ("claude-opus-5", "frontier")]:
    result = sp.select(name, "scratch", "сайт кофейни")
    sizes[tier] = result["used"]
    ok(f"{name} -> tier {tier}", result["profile"]["tier"] == tier)
order = [sizes[t] for t in ("nano", "small", "mid", "large", "frontier")]
ok("объём паков растёт с классом модели", order == sorted(order) and order[0] < order[-1])

print("\n== адресность паков ==")
ok("порядок работы и язык интерфейса доходят до самой слабой модели",
   "beautiful-gates" in sp.select("google/gemma-4-31b-it:free", "scratch", "сайт кофейни")["ids"])
ok("nano без художественных дирекций",
   "art-direction-recipes" not in sp.select("google/gemma-4-31b-it:free", "scratch", "сайт кофейни")["ids"])
ok("самопроверка только рассуждающим",
   "self-review" in sp.select("claude-opus-5-thinking", "scratch", "сайт")["ids"]
   and "self-review" not in sp.select("claude-sonnet-4-6", "scratch", "сайт")["ids"])
ok("дирекции не лезут в режим правки",
   "art-direction-recipes" not in sp.select("claude-opus-5", "edit", "смени шрифт")["ids"])
ok("скриншот-пак приходит вместе с картинкой",
   "screenshot-to-ui" in sp.select("gemini-3.6-flash", "scratch", "сделай так же", True)["ids"])
ok("скриншот-пак не приходит без картинки и без просьбы",
   "screenshot-to-ui" not in sp.select("gemini-3.6-flash", "scratch", "сайт кофейни", False)["ids"])
ok("плакат подключается по теме даже слабой модели",
   "graphic-composition" in sp.select("gemma-4-31b", "scratch", "нужен плакат на концерт")["ids"])
ok("плакат не подключается сильной модели без просьбы",
   "graphic-composition" not in sp.select("claude-opus-5", "scratch", "сайт кофейни")["ids"])
ok("панель подключается по теме средней модели",
   "interface-design" in sp.select("glm-4.6", "scratch", "админ-панель с таблицей заказов")["ids"])
ok("формы подключаются по теме",
   "interaction-ux" in sp.select("qwen3.6-35b-a3b", "scratch", "форма записи")["ids"])

print("\n== профили ==")
ok("thinking-суффикс включает рассуждение", mp.profile("claude-opus-4-8-thinking")["reasoning"])
ok("неизвестная модель получает средний профиль",
   mp.profile("что-то-совсем-новое")["tier"] == mp.DEFAULT_TIER)
ok("пустое имя не падает", mp.profile("")["tier"] == mp.DEFAULT_TIER)
ok("имя по семейству узнаётся", mp.profile("claude-opus-9-turbo")["tier"] == "frontier")
ok("регистр не важен", mp.profile("GLM-4.6")["tier"] == mp.profile("glm-4.6")["tier"])

print("\n== сборка системного промпта ==")
weak = build_system_prompt("scratch", message="сайт кофейни", model="google/gemma-4-31b-it:free")
strong = build_system_prompt("scratch", message="сайт кофейни", model="claude-opus-5")
ok("в промпте есть законы дизайна", "10 ЗАКОНОВ ХОРОШЕГО ДИЗАЙНА" in weak)
ok("в промпте есть бриф из базы", "ГОТОВЫЙ ДИЗАЙН-СКИЛЛ" in weak)
ok("в промпте есть паки", sp.MARKER in weak)
ok("в промпте есть правило про кириллический шрифт", "кириллиц" in weak.lower())
ok("бриф идёт РАНЬШЕ паков", weak.find("ГОТОВЫЙ ДИЗАЙН-СКИЛЛ") < weak.find(sp.MARKER))
ok("сильной модели достаётся более длинный промпт", len(strong) > len(weak))
ok("без модели промпт всё равно собирается", sp.MARKER in build_system_prompt("scratch", message="сайт"))

print("\n== экспорт для браузера ==")
data = sp.export()
ok("экспорт содержит паки", len(data["packs"]) == len(sp.packs()))
ok("экспорт содержит профили", len(data["exact"]) == len(mp._EXACT))
ok("экспорт содержит семейства", len(data["families"]) == len(mp._FAMILIES))
ok("бюджеты по классам на месте", set(data["tierBudget"]) == set(mp.TIER_ORDER))
ok("экспорт сериализуется в JSON", bool(json.dumps(data, ensure_ascii=False)))

print("\n----------------------------------------")
print(f"PASS: {P}   FAIL: {F}")
sys.exit(1 if F else 0)
