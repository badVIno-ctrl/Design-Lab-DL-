"""Регрессии на закрытые дыры. Без сети: сервис пользователей замокан.

Запуск: python3 backend/test_security.py
"""
import os
import sys
import tempfile
import time

os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="dl_sec_")
os.environ["FRONTEND_DIR"] = tempfile.mkdtemp(prefix="dl_sec_fe_")
os.environ["AI_API_KEY"] = ""
os.environ["ADMIN_API_TOKEN"] = "admin-token-for-tests"
os.environ["USER_DB_SERVICE_URL"] = "https://users.example.test"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient   # noqa: E402
import backend.main as m                    # noqa: E402
import backend.auth as auth                 # noqa: E402
import backend.config as config             # noqa: E402
import backend.ratelimit as ratelimit       # noqa: E402
from backend.audit import audit_html        # noqa: E402
from backend.proxy import _split            # noqa: E402

client = TestClient(m.app)
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


class FakeRequest:
    """Минимальный объект запроса для проверки вычисления адреса клиента."""

    def __init__(self, peer, forwarded=None):
        self.client = type("C", (), {"host": peer})()
        self.headers = {"x-forwarded-for": forwarded} if forwarded else {}


print("\n== адрес клиента нельзя подделать X-Forwarded-For ==")
# Один наш прокси: он дописывает настоящий адрес последним, всё левее — от клиента.
ratelimit.TRUSTED_PROXY_HOPS = 1
ok("берётся адрес, дописанный нашим прокси",
   ratelimit.client_ip(FakeRequest("10.0.0.1", "1.2.3.4, 203.0.113.9")) == "203.0.113.9")
ok("подделка одним значением не проходит",
   ratelimit.client_ip(FakeRequest("10.0.0.1", "9.9.9.9")) == "9.9.9.9")
ok("без заголовка берётся peer",
   ratelimit.client_ip(FakeRequest("203.0.113.7")) == "203.0.113.7")
ratelimit.TRUSTED_PROXY_HOPS = 0
ok("без доверенных прокси заголовок игнорируется целиком",
   ratelimit.client_ip(FakeRequest("10.0.0.1", "1.2.3.4")) == "10.0.0.1")
ratelimit.TRUSTED_PROXY_HOPS = 1

print("\n== лимиты объявлены для всех корзин ==")
buckets = set(ratelimit.RULES)
ok("корзина plan объявлена явно", "plan" in buckets)
ok("все лимиты положительные", all(limit > 0 and window > 0 for limit, window in ratelimit.RULES.values()))

print("\n== /api/audit: аудит линеен по времени (ReDoS закрыт) ==")
for name, payload in [("<script> без закрытия", "<script" * 90000),
                      ("<img> без закрытия", "<img" * 200000),
                      ("<meta> без закрытия", "<meta" * 160000),
                      ("<title> без закрытия", "<title>" + "a" * 700000)]:
    started = time.time()
    audit_html(payload)
    spent = time.time() - started
    ok(f"{name}: {spent:.2f}s < 2s", spent < 2.0)

print("\n== /api/audit: результаты не изменились ==")
good = ('<!DOCTYPE html><html lang="ru"><head><meta name="viewport" content="width=device-width">'
        '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'">'
        '<title>Кафе</title>'
        '<script src="https://cdn.example/a.js" integrity="sha384-x"></script>'
        '</head><body><h1>Кофе</h1><img src="/a.png" alt="a"></body></html>')
report = audit_html(good)
titles = {item["title"] for item in report["items"]}
ok("чистый документ близок к 100", report["score"] >= 95)
ok("нет ложного «нет viewport»", "Нет meta viewport" not in titles)
ok("нет ложного «нет lang»", "Нет lang у <html>" not in titles)
ok("нет ложного «нет title»", "Пустой или отсутствует <title>" not in titles)
ok("нет ложного «нет CSP»", "Нет Content-Security-Policy" not in titles)
ok("нет ложного SRI", "Внешние скрипты без integrity (SRI)" not in titles)

empty_title = "<html lang=ru><head><title>   </title></head><body><h1>x</h1></body></html>"
ok("пустой <title> ловится",
   "Пустой или отсутствует <title>" in {i["title"] for i in audit_html(empty_title)["items"]})
leak = "<html><body><script>var k='sk-or-v1-" + ("a" * 40) + "'</script></body></html>"
ok("утёкший ключ ловится",
   any(i["sev"] == "high" and "ключ" in i["title"] for i in audit_html(leak)["items"]))
no_alt = "<html><body><img src=a><img src=b alt=''></body></html>"
ok("картинка без alt ловится",
   any("без alt (1)" in i["title"] for i in audit_html(no_alt)["items"]))

print("\n== /api/plan/subscribe: бесплатного Pro нет ==")
ok("самостоятельная смена тарифа выключена по умолчанию", config.SELF_SERVE_PLANS is False)
res = client.post("/api/plan/subscribe", json={"plan": "pro"})
ok("subscribe -> 403", res.status_code == 403)
ok("slash-вариант тоже 403", client.post("/api/plan/subscribe/", json={"plan": "pro"}).status_code == 403)
ok("другой регистр тоже 403", client.post("/API/plan/subscribe", json={"plan": "pro"}).status_code == 403)
import backend.plans as plans   # noqa: E402
ok("память процесса больше не хранит тариф", not hasattr(plans, "_override"))

print("\n== приватность проектов включена по умолчанию ==")
ok("AUTH_ENABLED по умолчанию включён", config._flag("AUTH_ENABLED", "1") is True)
ok("анонимный список проектов -> 401", client.get("/api/projects").status_code == 401)
ok("анонимное создание -> 401",
   client.post("/api/projects", json={"name": "x", "html": "<h1>x</h1>", "kind": "scratch"}).status_code == 401)
ok("анонимное удаление -> 401", client.delete("/api/projects/abc123").status_code == 401)

print("\n== логины GitHub нельзя занять заранее ==")
res = client.post("/api/auth/register", json={"username": "gh_torvalds", "password": "secret1"})
ok("регистрация gh_* -> 400", res.status_code == 400)
ok("обычный логин не задет (доходит до сервиса пользователей)",
   client.post("/api/auth/register", json={"username": "alice", "password": "secret1"}).status_code != 400)
ok("префикс совпадает с тем, что строит вход через GitHub",
   auth._gh_username("Torvalds").startswith(auth.GITHUB_USERNAME_PREFIX))

print("\n== админские маршруты скрыты и не падают ==")
ok("без токена /api/admin/plans/grant -> 404",
   client.post("/api/admin/plans/grant", json={"user_id": "u1", "plan": "pro"}).status_code == 404)
ok("неверный токен -> 404",
   client.post("/api/admin/plans/grant", json={"user_id": "u1", "plan": "pro"},
               headers={"X-Admin-Token": "nope"}).status_code == 404)
# Проверяем саму зависимость: uvicorn декодирует заголовки как latin-1, поэтому
# в токене реально может оказаться символ вне ASCII. compare_digest на таких
# строках бросает TypeError — раньше это давало 500 вместо 404.
from fastapi import HTTPException                    # noqa: E402
from backend.admin import require_admin              # noqa: E402
from backend.proxy import admin_only                 # noqa: E402


def status_of(callable_, token):
    try:
        callable_(token)
    except HTTPException as exc:
        return exc.status_code
    except Exception as exc:                          # TypeError и прочее — это баг
        return type(exc).__name__
    return 200


ok("не-ASCII токен: require_admin -> 404", status_of(require_admin, "\u0442\u043e\u043a\u0435\u043d") == 404)
ok("не-ASCII токен: admin_only -> 404", status_of(admin_only, "\u00ff\u00fe") == 404)
ok("верный токен пропускает", status_of(admin_only, os.environ["ADMIN_API_TOKEN"]) == 200)
ok("диагностика провайдеров закрыта", client.get("/api/seekai/check").status_code == 404)

print("\n== /api/proxy: адрес апстрима чистится от userinfo ==")
clean, host, path = _split("https://attacker:secret@generativelanguage.googleapis.com/v1beta/models/x:generateContent")
ok("userinfo убран из адреса", "attacker" not in clean and "secret" not in clean)
ok("хост опознан верно", host == "generativelanguage.googleapis.com")
try:
    _split("http://openrouter.ai/v1/chat/completions")
    ok("http отклоняется", False)
except Exception as exc:
    ok("http отклоняется", getattr(exc, "status_code", None) == 403)

print("\n== размеры запросов ограничены ==")
from backend.models import AIRequest, MAX_IMAGE_CHARS   # noqa: E402
from pydantic import ValidationError                     # noqa: E402
try:
    AIRequest(mode="scratch", message="x", images=["data:image/png;base64," + "A" * MAX_IMAGE_CHARS])
    ok("слишком большая картинка отклоняется", False)
except ValidationError:
    ok("слишком большая картинка отклоняется", True)
try:
    AIRequest(mode="scratch", message="x", images=["a"] * 9)
    ok("слишком много картинок отклоняется", False)
except ValidationError:
    ok("слишком много картинок отклоняется", True)
ok("четыре картинки допустимы", len(AIRequest(mode="scratch", message="x", images=["a"] * 4).images) == 4)

print("\n== смена логина без сервиса пользователей не падает 500 ==")
saved = config.USER_DB_SERVICE_URL
config.USER_DB_SERVICE_URL = ""
auth._REMOTE_CACHE.clear()
auth._REMOTE_CACHE[auth._token_hash("t0k3n")] = (time.time() + 60, {"id": "u1", "username": "bob", "plan": "free"})
res = client.post("/api/profile/username", json={"username": "newname", "password": "secret1"},
                  headers={"Authorization": "Bearer t0k3n"})
ok("смена логина -> 503, а не 500", res.status_code == 503)
res = client.post("/api/profile/password", json={"password": "secret1", "new_password": "secret2"},
                  headers={"Authorization": "Bearer t0k3n"})
ok("смена пароля -> 503, а не 500", res.status_code == 503)
config.USER_DB_SERVICE_URL = saved
auth._REMOTE_CACHE.clear()

print("\n== заголовки безопасности ==")
headers = client.get("/api/health").headers
for name, value in [("X-Content-Type-Options", "nosniff"),
                    ("X-Frame-Options", "SAMEORIGIN"),
                    ("Cross-Origin-Opener-Policy", "same-origin"),
                    ("X-Permitted-Cross-Domain-Policies", "none")]:
    ok(f"{name}: {value}", headers.get(name) == value)
ok("HSTS выставлен", "max-age=" in headers.get("Strict-Transport-Security", ""))

print("\n== обход пути в id проекта ==")
ok("path traversal -> 400/404", client.get("/api/projects/../../etc/passwd").status_code in (400, 401, 404))

print("\n----------------------------------------")
print(f"PASS: {P}   FAIL: {F}")
sys.exit(1 if F else 0)
