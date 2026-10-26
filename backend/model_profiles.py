# -*- coding: utf-8 -*-
"""Профили моделей: сколько дизайн-знания модель способна унести.

Зачем это отдельный файл. Дизайн-скиллы — это текст в системном промпте, а
системный промпт не бесплатный. Gemma 4 31B и Claude Opus 5 нельзя кормить
одинаково: первой длинная методичка мешает (она теряет начало контекста и
перестаёт следовать формату ответа), второй короткого списка запретов мало —
она способна выполнить и художественную дирекцию, и самопроверку.

Поэтому у каждой модели есть:
  • tier      — весовая категория, от неё зависит бюджет и набор паков;
  • budget    — сколько символов дизайн-паков можно добавить сверх основного
                промпта (в промпте уже есть DESIGN_LAWS + бриф из базы);
  • vision    — умеет ли смотреть картинки (тогда даём пак про скриншоты);
  • reasoning — есть ли запас рассуждения (тогда даём пак самопроверки).

Список моделей повторяет каталог сайта: index.html (MODELS), models-patch.js
(EXTRA) и seekai-models.js (NEW). Неизвестная модель получает средний профиль —
новая модель в каталоге сразу работает, просто без тонкой настройки.
"""
import re

NANO, SMALL, MID, LARGE, FRONTIER = "nano", "small", "mid", "large", "frontier"

TIER_ORDER = (NANO, SMALL, MID, LARGE, FRONTIER)

# Бюджет паков в символах. Отсчёт от размера основного промпта: DESIGN_LAWS +
# DESIGN_SYSTEM ≈ 5 КБ, бриф дизайн-скилла из базы ≈ 4 КБ. Бюджет ограничивает
# только ДОБИРАЕМЫЕ паки: обязательный минимум (anti-slop и приёмка) получает
# любая модель, иначе слабая модель осталась бы без главного — списка запретов.
TIER_BUDGET = {
    NANO: 5200,
    SMALL: 8000,
    MID: 13000,
    LARGE: 20000,
    FRONTIER: 30000,
}

DEFAULT_TIER = MID

# Точные идентификаторы. Ключи — в нижнем регистре, как приходят от клиента.
_EXACT = {
    # --- OpenRouter free: самые слабые, только базовая дисциплина ---
    "google/gemma-4-31b-it:free": (NANO, False, False),
    "openai/gpt-oss-20b:free": (NANO, False, True),
    "cohere/north-mini-code:free": (NANO, False, False),
    "gemini-3.1-flash-lite": (NANO, True, False),
    "openrouter/free": (SMALL, False, False),
    "gemma-4-31b": (SMALL, False, False),
    "qwen3.6-35b-a3b": (SMALL, False, False),
    "claude-haiku-4-5": (SMALL, True, False),
    # --- средний класс: рабочие лошадки ---
    "glm-4.6": (MID, False, False),
    "kiwi::glm-4.6": (MID, False, False),
    "glm-5.2": (MID, False, False),
    "kiwi::glm-5.2": (MID, False, False),
    "zai-glm-4.7": (MID, False, True),
    "glm-4.5v": (MID, True, False),
    "zai-glm-4.5v": (MID, True, False),
    "gpt-oss-120b": (MID, False, True),
    "mistral-large": (MID, False, False),
    "mistral-large-latest": (MID, False, False),
    "deepseek-v4-flash": (MID, False, False),
    "gemini-flash-latest": (MID, True, True),
    "gemini-3.6-flash": (MID, True, True),
    "nvidia/nemotron-3-ultra-550b-a55b:free": (MID, False, False),
    "mimo-v2.5-pro": (MID, True, False),
    # --- сильные ---
    "claude-sonnet-4-6": (LARGE, True, False),
    "claude-sonnet-5": (LARGE, True, True),
    "claude-fable-5": (LARGE, True, False),
    "minimax-m3": (LARGE, True, False),
    "deepseek-v4-pro": (LARGE, False, True),
    "gemini-pro-latest": (LARGE, True, True),
    "grok-4-5": (LARGE, True, True),
    "gpt-5-5": (LARGE, True, False),
    "gpt-5-6-luna": (LARGE, True, True),
    "gpt-5-6-sol": (LARGE, True, True),
    # --- флагманы: несут всё, включая дирекции и самопроверку ---
    "claude-opus-4-7": (FRONTIER, True, True),
    "claude-opus-4-8": (FRONTIER, True, True),
    "claude-opus-5": (FRONTIER, True, True),
    "gpt-5-6": (FRONTIER, True, True),
    "gpt-5-6-terra": (FRONTIER, True, True),
    # Авто-выбор шлюза: какая модель ответит, неизвестно, поэтому берём
    # средний профиль — он безопасен и для слабой, и для сильной модели.
    "auto": (MID, False, False),
}

# Семейства для имён, которых нет в таблице: у провайдеров одна и та же модель
# называется то через точку, то через дефис, то с префиксом. Порядок важен —
# первое совпадение выигрывает.
_FAMILIES = (
    (r"opus", (FRONTIER, True, True)),
    (r"gpt-?5[.-]6", (FRONTIER, True, True)),
    (r"sonnet", (LARGE, True, True)),
    (r"fable|grok|gpt-?5[.-]5", (LARGE, True, False)),
    (r"haiku|lite|mini|20b|8b|4b", (NANO, False, False)),
    (r"gemini|minimax|mimo|[-_.]?v\b", (MID, True, False)),
    (r"glm|mistral|deepseek|qwen|gemma|nemotron|oss", (MID, False, False)),
)


def _thinking(model: str) -> bool:
    return bool(re.search(r"thinking|reason", model))


def profile(model: str) -> dict:
    """Профиль модели по её идентификатору."""
    name = (model or "").strip().lower()
    found = _EXACT.get(name)
    if not found:
        # «-thinking» и подобные суффиксы: пробуем базовое имя.
        base = re.sub(r"[-_](thinking|reasoning|high|low)$", "", name)
        found = _EXACT.get(base)
    if not found:
        for pattern, entry in _FAMILIES:
            if re.search(pattern, name):
                found = entry
                break
    tier, vision, reasoning = found or (DEFAULT_TIER, False, False)
    if _thinking(name):
        reasoning = True
    return {
        "model": model or "",
        "tier": tier,
        "budget": TIER_BUDGET[tier],
        "vision": vision,
        "reasoning": reasoning,
    }


def tier_at_least(tier: str, minimum: str) -> bool:
    try:
        return TIER_ORDER.index(tier) >= TIER_ORDER.index(minimum)
    except ValueError:
        return False


def catalog() -> dict:
    """Все известные профили — для /api/design/packs и для JS-двойника."""
    return {name: profile(name) for name in sorted(_EXACT)}
