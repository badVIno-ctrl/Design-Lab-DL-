# -*- coding: utf-8 -*-
"""Дизайн-паки: внешние дизайн-скиллы, разведённые по моделям.

Что это. В skills/packs/*.md лежат сжатые своды правил, собранные из десяти
открытых наборов дизайн-скиллов (список источников — skills/SOURCES.md).
Каждый пак — это front-matter с условиями подключения и тело из императивных
правил. Тело попадает в системный промпт, поэтому оно короткое и без прозы.

Чем это отличается от design_skills.py. Тот движок выдаёт КОНКРЕТИКУ под
запрос: вот эти hex, вот этот шрифт, вот такой план секций. Паки выдают
РЕМЕСЛО: как считать тени, чем плоха плоская шкала, какие пять состояний
у элемента. Первое отвечает «что сделать», второе — «как не испортить».

Главное правило подключения: у каждой модели свой бюджет (model_profiles.py).
Паки отбираются по приоритету, пока бюджет не исчерпан, поэтому слабая модель
получает только запреты и приёмку, а флагман — ещё дирекции и самопроверку.
"""
import pathlib
import re
from typing import Any, Dict, List, Optional

from . import model_profiles as mp

MARKER = "DESIGN&LAB · ДИЗАЙН-ПАКИ"

# Паки с приоритетом ниже этого — обязательный минимум: они подключаются любой
# модели независимо от бюджета. Это запрет «ИИ-слопа» и список приёмки, то есть
# ровно то, без чего слабая модель и выдаёт типовой шаблон.
MANDATORY_BELOW = 20

# Три полосы отбора, в этом порядке:
#   0 — обязательный минимум,
#   1 — паки, попавшие в тему запроса: тема важнее весовой категории,
#       про состояния формы надо напомнить и средней модели,
#   2 — паки по весовой категории модели.
BAND_MANDATORY, BAND_INTENT, BAND_TIER = 0, 1, 2

_PACKS_DIRS = [
    pathlib.Path(__file__).resolve().parents[1] / "skills" / "packs",
    pathlib.Path(__file__).resolve().parent / "packs",
]

_packs: Optional[List[Dict[str, Any]]] = None


def _split_list(raw: str) -> List[str]:
    return [part.strip().lower() for part in raw.split(",") if part.strip()]


def _parse(text: str, path: pathlib.Path) -> Optional[Dict[str, Any]]:
    """Разбор одного файла пака. Свой мини-парсер вместо PyYAML: полей мало,
    а лишняя зависимость в requirements.txt здесь не нужна."""
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end < 0:
        return None
    head, body = text[3:end], text[end + 4:].strip()
    meta: Dict[str, str] = {}
    for line in head.splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        meta[key.strip().lower()] = value.strip()
    pack_id = meta.get("id") or path.stem
    if not body:
        return None
    return {
        "id": pack_id,
        "title": meta.get("title", pack_id),
        "priority": int(meta.get("priority") or 100),
        # tiers: none — пак не подключается «по весу» вообще, только по теме
        # запроса или по возможностям модели. Так ведут себя паки про плакат и
        # про скриншот: сильной модели они не нужны, пока их не попросили.
        "tiers": [] if meta.get("tiers", "").strip().lower() == "none"
        else (_split_list(meta.get("tiers", "")) or list(mp.TIER_ORDER)),
        "modes": _split_list(meta.get("modes", "any")) or ["any"],
        "intent": _split_list(meta.get("intent", "")),
        "needs": _split_list(meta.get("needs", "")),
        "sources": meta.get("sources", ""),
        "body": body,
        "size": len(body),
    }


def packs() -> List[Dict[str, Any]]:
    """Все паки, отсортированные по приоритету. Читаются один раз."""
    global _packs
    if _packs is not None:
        return _packs
    found: List[Dict[str, Any]] = []
    for directory in _PACKS_DIRS:
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.md")):
            try:
                parsed = _parse(path.read_text(encoding="utf-8"), path)
            except OSError:
                continue
            if parsed:
                found.append(parsed)
        if found:
            break
    found.sort(key=lambda pack: (pack["priority"], pack["id"]))
    _packs = found
    return _packs


def available() -> bool:
    return bool(packs())


def _wanted_by_intent(pack: Dict[str, Any], message: str) -> bool:
    if not pack["intent"]:
        return False
    low = (message or "").lower().replace("\u0451", "\u0435")
    return any(word in low for word in pack["intent"])


def select(model: str = "", mode: str = "scratch", message: str = "",
           has_images: bool = False) -> Dict[str, Any]:
    """Какие паки получит именно эта модель на именно этот запрос.

    Отбор в три шага:
      1. отсеиваем паки, не подходящие модели по режиму и возможностям;
      2. паки, попавшие в тему запроса (intent), получают приоритет выше
         своего веса — про формы надо напомнить даже средней модели;
      3. набираем по порядку, пока хватает бюджета.
    """
    info = mp.profile(model)
    tier, budget = info["tier"], info["budget"]
    mode = (mode or "scratch").lower()

    candidates = []
    for pack in packs():
        if pack["modes"] != ["any"] and mode not in pack["modes"]:
            continue
        if "vision" in pack["needs"] and not (info["vision"] or has_images):
            continue
        if "reasoning" in pack["needs"] and not info["reasoning"]:
            continue
        by_intent = _wanted_by_intent(pack, message)
        # Пак «про скриншот» подключается, когда картинка реально приложена:
        # одной зрячести модели мало, иначе он занимает бюджет у нужных правил.
        if "vision" in pack["needs"]:
            by_intent = by_intent or has_images
        if tier not in pack["tiers"] and not by_intent:
            continue
        if pack["priority"] < MANDATORY_BELOW:
            band = BAND_MANDATORY
        elif by_intent:
            band = BAND_INTENT
        else:
            band = BAND_TIER
        candidates.append((band, pack["priority"], pack))

    candidates.sort(key=lambda item: (item[0], item[1], item[2]["id"]))

    chosen: List[Dict[str, Any]] = []
    used = 0
    skipped: List[str] = []
    for _band, _priority, pack in candidates:
        mandatory = pack["priority"] < MANDATORY_BELOW
        if not mandatory and used + pack["size"] > budget:
            skipped.append(pack["id"])
            continue
        chosen.append(pack)
        used += pack["size"]
    chosen.sort(key=lambda pack: (pack["priority"], pack["id"]))
    return {
        "profile": info,
        "packs": chosen,
        "ids": [pack["id"] for pack in chosen],
        "skipped": skipped,
        "used": used,
        "budget": budget,
    }


def render(chosen: List[Dict[str, Any]]) -> str:
    """Текст паков для системного промпта."""
    if not chosen:
        return ""
    line = "\u2500" * 75
    parts = [line, MARKER + " \u00b7 \u0440\u0435\u043c\u0435\u0441\u043b\u0435\u043d\u043d\u044b\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u0430 \u043f\u043e\u0434 \u044d\u0442\u0443 \u043c\u043e\u0434\u0435\u043b\u044c", line]
    for pack in chosen:
        parts.append("")
        parts.append("\u25ac\u25ac " + pack["title"].upper())
        parts.append(pack["body"])
    parts.append(line)
    return "\n".join(parts)


def brief_for(model: str = "", mode: str = "scratch", message: str = "",
              has_images: bool = False) -> str:
    """Готовая добавка к системному промпту для конкретной модели."""
    if not available():
        return ""
    return render(select(model, mode, message, has_images)["packs"])


def summary(model: str = "", mode: str = "scratch", message: str = "",
            has_images: bool = False) -> Dict[str, Any]:
    """Короткий отчёт для /api/design/* и отладки."""
    result = select(model, mode, message, has_images)
    return {
        "tier": result["profile"]["tier"],
        "vision": result["profile"]["vision"],
        "reasoning": result["profile"]["reasoning"],
        "budget": result["budget"],
        "used": result["used"],
        "packs": result["ids"],
        "skipped": result["skipped"],
    }


def stats() -> Dict[str, Any]:
    return {
        "packs": len(packs()),
        "bytes": sum(pack["size"] for pack in packs()),
        "ids": [pack["id"] for pack in packs()],
        "tiers": {tier: mp.TIER_BUDGET[tier] for tier in mp.TIER_ORDER},
    }


def export() -> Dict[str, Any]:
    """Полный слепок для браузерного двойника (frontend/dl-skill-packs.json)."""
    return {
        "marker": MARKER,
        "tierOrder": list(mp.TIER_ORDER),
        "tierBudget": dict(mp.TIER_BUDGET),
        "defaultTier": mp.DEFAULT_TIER,
        "exact": {name: mp.profile(name) for name in sorted(mp._EXACT)},
        "families": [[pattern, list(entry)] for pattern, entry in mp._FAMILIES],
        "packs": [
            {key: pack[key] for key in
             ("id", "title", "priority", "tiers", "modes", "intent", "needs", "body", "size")}
            for pack in packs()
        ],
    }
