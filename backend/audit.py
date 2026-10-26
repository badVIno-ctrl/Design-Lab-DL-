"""/api/audit — server-side static security/quality audit (parity with the client)."""
import re
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from .models import AuditResponse, AuditItem
from .ratelimit import guard

router = APIRouter(prefix="/api", tags=["audit"])


class AuditRequest(BaseModel):
    html: str = Field("", max_length=800_000)


# Разбор тегов одним линейным проходом.
#
# Зачем. Проверки вида `<script[^>]+src=...` выглядят безобидно, но у них есть
# «хвост» после неограниченного `[^>]*`. На строке `<script<script<script…`
# движок регулярок начинает попытку на каждом `<script`, каждый раз доходит до
# конца документа и откатывается — это квадратичное время. При лимите 800 КБ и
# полностью открытом (без входа) `/api/audit` этого достаточно, чтобы одним
# запросом занять процесс на минуты, то есть положить сайт.
#
# `[^<>]*` такую атаку убивает: попытка обрывается на следующем `<` за один
# шаг, поэтому проход линейный. Дальше все «теговые» проверки работают уже по
# коротким строкам самих тегов, а не по всему документу.
_TAG_RE = re.compile(r"<([a-zA-Z][a-zA-Z0-9-]*)([^<>]*)>")


def _tags(html: str) -> dict:
    """Теги документа, сгруппированные по имени в нижнем регистре."""
    found = {}
    for match in _TAG_RE.finditer(html):
        found.setdefault(match.group(1).lower(), []).append(match.group(0))
    return found


def _title_text(html: str) -> str:
    """Текст первого <title> без регулярок — тоже ради линейного времени."""
    low = html.lower()
    start = low.find("<title")
    if start < 0:
        return ""
    open_end = low.find(">", start)
    if open_end < 0:
        return ""
    close = low.find("</title", open_end)
    if close < 0:
        return ""
    return html[open_end + 1:close]


KEY_PATTERNS = [
    (r"sk-or-v1-[A-Za-z0-9]{20,}", "OpenRouter"),
    (r"sk-[A-Za-z0-9]{20,}", "OpenAI-подобный"),
    (r"csk-[A-Za-z0-9]{20,}", "Cerebras"),
    (r"AIza[0-9A-Za-z_\-]{30,}", "Google API"),
    (r"AKIA[0-9A-Z]{16}", "AWS"),
    (r"gh[pousr]_[A-Za-z0-9]{20,}", "GitHub token"),
    (r"xox[baprs]-[A-Za-z0-9-]{10,}", "Slack token"),
]


def audit_html(html: str) -> dict:
    html = html or ""
    tags = _tags(html)
    items = []
    def add(sev, title, desc, fix=""):
        items.append({"sev": sev, "title": title, "desc": desc, "fix": fix})
    def has(rx):
        return re.search(rx, html, re.I) is not None

    leaked = [label for rx, label in KEY_PATTERNS if re.search(rx, html)]
    if leaked:
        add("high", "Утёкшие ключи/секреты в коде",
            "Найдены похожие на секреты строки (" + ", ".join(leaked) + "). В клиентском коде их видит любой посетитель.",
            "Убери ключи из HTML/JS, держи их на бэкенде. Скомпрометированные ключи немедленно отзови.")
    else:
        add("ok", "Секретов в коде не найдено", "Явных API-ключей и токенов в разметке нет.")

    inline_on = len(re.findall(r"\son[a-z]+\s*=\s*[\"']", html, re.I))
    if inline_on > 8:
        add("low", "Много inline-обработчиков (on...=)",
            f"Найдено {inline_on} inline-обработчиков. При вставке пользовательских данных это повышает риск XSS.",
            "Выноси обработчики в addEventListener; не вставляй непроверенный ввод в innerHTML.")

    if has(r"\.innerHTML\s*=") and has(r"location|value|search|params|input"):
        add("med", "innerHTML с потенциально пользовательскими данными",
            "Есть присваивание innerHTML рядом с источниками ввода — риск XSS.",
            "Используй textContent или экранируй HTML перед вставкой.")

    if has(r'target\s*=\s*["\']_blank["\']') and not has(r'rel\s*=\s*["\'][^"\']*noopener'):
        add("med", 'target="_blank" без rel="noopener"',
            "Внешние ссылки в новой вкладке без noopener — уязвимость tabnabbing.",
            'Добавь rel="noopener noreferrer" ко всем target="_blank".')

    http_assets = len(re.findall(r'(src|href)\s*=\s*["\']http://', html, re.I))
    if http_assets:
        add("med", "Смешанный контент (http://)",
            f"Найдено {http_assets} ресурсов по http:// — на https-сайте они заблокируются.",
            "Переведи все ссылки на https://.")

    scripts = tags.get("script", [])
    ext_scripts = sum(1 for t in scripts if re.search(r'src\s*=\s*["\']https?://', t, re.I))
    with_sri = sum(1 for t in scripts if re.search(r"integrity=", t, re.I))
    if ext_scripts > 0 and with_sri < ext_scripts:
        add("low", "Внешние скрипты без integrity (SRI)",
            f"Из {ext_scripts} внешних скриптов только {with_sri} с проверкой целостности.",
            "Добавь integrity + crossorigin к CDN-скриптам, где возможно.")

    metas = tags.get("meta", [])
    if not any(re.search(r'http-equiv=["\']Content-Security-Policy', t, re.I) for t in metas):
        add("low", "Нет Content-Security-Policy", "CSP снижает риск XSS и инъекций.",
            "Добавь заголовок или <meta http-equiv=\"Content-Security-Policy\">.")

    if not has(r"<!DOCTYPE html>"):
        add("med", "Нет <!DOCTYPE html>", "Без доктайпа браузер включает quirks-режим.", "Добавь <!DOCTYPE html> первой строкой.")
    if not any(re.search(r'name=["\']viewport["\']', t, re.I) for t in metas):
        add("high", "Нет meta viewport", "Сайт не адаптируется под мобильные.",
            'Добавь <meta name="viewport" content="width=device-width, initial-scale=1">.')
    if not any(re.search(r"lang=", t, re.I) for t in tags.get("html", [])):
        add("low", "Нет lang у <html>", "Важно для доступности и SEO.", 'Укажи <html lang="ru">.')
    if not _title_text(html).strip():
        add("med", "Пустой или отсутствует <title>", "Заголовок вкладки/SEO не задан.", "Добавь осмысленный <title>.")
    h1 = len(re.findall(r"<h1[\s>]", html, re.I))
    if h1 == 0:
        add("low", "Нет <h1>", "Одна главная заголовочная строка нужна для структуры и SEO.", "Добавь ровно один <h1>.")
    elif h1 > 1:
        add("low", f"Несколько <h1> ({h1})", "Обычно на странице должен быть один <h1>.", "Оставь один <h1>, остальное — h2/h3.")

    imgs = tags.get("img", [])
    no_alt = sum(1 for t in imgs if not re.search(r"\balt\s*=", t, re.I))
    if no_alt:
        add("low", f"Картинки без alt ({no_alt})", "Без alt изображения недоступны для скринридеров.",
            'Добавь alt каждому <img> (пустой alt="" для декоративных).')

    if not has(r"prefers-reduced-motion") and has(r"@keyframes|animation:"):
        add("low", "Анимации без prefers-reduced-motion", "Дискомфорт для чувствительных к движению.",
            "Оберни анимации в @media (prefers-reduced-motion: reduce).")

    if has(r"console\.log\("):
        add("low", "Остались console.log", "Отладочные логи в проде лучше убрать.", "Удали console.log перед публикацией.")

    weight = {"high": 22, "med": 9, "low": 3, "ok": 0}
    penalty = sum(weight[i["sev"]] for i in items)
    score = max(0, min(100, 100 - penalty))
    high = sum(1 for i in items if i["sev"] == "high")
    med = sum(1 for i in items if i["sev"] == "med")
    low = sum(1 for i in items if i["sev"] == "low")
    if high:
        summary = f"Есть {high} критич. и {med} средних замечаний."
    elif med:
        summary = f"Есть {med} средних и {low} мелких замечаний."
    elif low:
        summary = f"Мелкие улучшения: {low}."
    else:
        summary = "Отлично — проблем не найдено."
    rank = {"high": 0, "med": 1, "low": 2, "ok": 3}
    items.sort(key=lambda i: rank[i["sev"]])
    return {"score": score, "items": items, "high": high, "med": med, "low": low, "summary": summary}


@router.post("/audit", response_model=AuditResponse)
def audit(body: AuditRequest, request: Request):
    guard("audit", request)
    return audit_html(body.html)
