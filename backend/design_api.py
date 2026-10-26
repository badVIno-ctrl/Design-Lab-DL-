# -*- coding: utf-8 -*-
"""HTTP-доступ к базе дизайн-скиллов.

Нужен для двух вещей:
1. Фронтенд может показать пользователю, какой скилл применён.
2. Можно быстро проверить движок без траты токенов модели.
"""
from fastapi import APIRouter, Query

from . import design_skills as ds
from . import model_profiles as mp
from . import skill_packs as sp

router = APIRouter(prefix="/api/design", tags=["design"])


@router.get("/stats")
def design_stats():
    """Размер базы: сколько палитр, шрифтов, композиций и комбинаций."""
    return {"available": ds.available(), **ds.stats(), "packs": sp.stats()}


@router.get("/skill")
def design_skill(
    message: str = Query("", max_length=4000),
    mode: str = Query("scratch"),
    variant: int = Query(0, ge=0, le=99),
    model: str = Query("", max_length=120),
    images: bool = Query(False),
    full: bool = Query(False),
):
    """Подбирает дизайн-скилл и набор дизайн-паков под запрос.

    full=false — только краткая сводка для интерфейса.
    full=true  — ещё и готовые CSS-токены, текст брифа и текст паков.
    """
    skill = ds.build_skill(message, mode=mode, variant=variant)
    out = {"available": bool(skill)}
    if skill:
        out.update(ds.summary(skill))
    out["packs"] = sp.summary(model=model, mode=mode, message=message, has_images=images)
    if full:
        if skill:
            out["tokens"] = ds.render_tokens(skill)
            out["brief"] = ds.render_brief(skill)
            out["fontLink"] = skill["font"]["link"]
        out["packsBrief"] = sp.brief_for(model=model, mode=mode, message=message, has_images=images)
    return out


@router.get("/packs")
def design_packs():
    """Каталог дизайн-паков и профилей моделей — чем какая модель усилена."""
    return {
        "available": sp.available(),
        "stats": sp.stats(),
        "profiles": mp.catalog(),
        "packs": [
            {key: pack[key] for key in
             ("id", "title", "priority", "tiers", "modes", "intent", "needs", "sources", "size")}
            for pack in sp.packs()
        ],
    }
