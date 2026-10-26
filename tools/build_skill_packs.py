#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает frontend/dl-skill-packs.json из skills/packs/*.md.

Зачем нужен отдельный файл для браузера. Часть моделей вызывается прямо из
index.html, мимо backend/ai.py: браузер сам собирает тело запроса и отправляет
его через /api/proxy. Такой запрос никогда не проходит через prompts.py, поэтому
паки ему дописывает JS-двойник (frontend/dl-skill-packs.js).

Чтобы двойник не разошёлся с сервером, он не содержит ни одного правила и ни
одного профиля модели: он читает этот JSON, а JSON собирается из того же
skills/packs и того же backend/model_profiles.py, что использует сервер.
Один источник правды, две точки применения.

    python3 tools/build_skill_packs.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import skill_packs  # noqa: E402

OUT = ROOT / "frontend" / "dl-skill-packs.json"


def main() -> int:
    data = skill_packs.export()
    if not data["packs"]:
        print("нет паков в skills/packs — нечего собирать", file=sys.stderr)
        return 1
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total = sum(pack["size"] for pack in data["packs"])
    print(f"{OUT.relative_to(ROOT)}: {len(data['packs'])} паков, {total} символов правил, "
          f"{len(data['exact'])} профилей моделей, файл {OUT.stat().st_size} Б")
    for pack in data["packs"]:
        tiers = ",".join(pack["tiers"]) or "по теме"
        print(f"  {pack['priority']:>3} {pack['id']:<22} {pack['size']:>5} симв.  [{tiers}]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
