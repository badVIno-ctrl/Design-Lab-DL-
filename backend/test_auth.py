"""Вход и приватность проектов. Без сети: сервис пользователей замокан.

Раньше этот файл проверял локальную SQLite-аутентификацию внутри backend/auth.py.
Её больше нет — учётные записи живут только в USER_DB_SERVICE_URL, поэтому
проверяется то же самое, но через заглушку сервиса: проксирование
register/login/me и то, что проекты одного пользователя недоступны другому.

Запуск: python3 backend/test_auth.py
"""
import os, tempfile, sys

os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="dl_a_")
os.environ["FRONTEND_DIR"] = tempfile.mkdtemp(prefix="dl_af_")
os.environ["AI_API_KEY"] = ""
os.environ["AUTH_ENABLED"] = "1"
os.environ["USER_DB_SERVICE_URL"] = "https://users.example.test"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient
import backend.main as m
import backend.auth as auth
import backend.config as config
from backend import _testkit as kit

# Заглушка сервиса пользователей для register/login/logout и для /v1/auth/me.
auth.httpx.AsyncClient = kit.FakeUsersService
kit.FakeUsersService.users = {}

client = TestClient(m.app)
P = 0; F = 0
def ok(n, c):
    global P, F
    if c: P += 1; print("  \u2705", n)
    else: F += 1; print("  \u274c", n)

auth_hdr = kit.bearer

print("\n== приватность включена ==")
ok("AUTH_ENABLED", config.AUTH_ENABLED is True)

print("\n== projects require auth (401 anonymous) ==")
ok("list 401", client.get("/api/projects").status_code == 401)
ok("create 401", client.post("/api/projects", json={"name": "x", "html": "<h1>x</h1>", "kind": "scratch"}).status_code == 401)

print("\n== register / login / me проксируются в сервис ==")
r = client.post("/api/auth/register", json={"username": "alice", "password": "secret1"})
ok("register 200", r.status_code == 200)
ta = r.json().get("token", "")
ok("got token", ta == "token-alice")
ok("dup register 409", client.post("/api/auth/register", json={"username": "alice", "password": "secret1"}).status_code == 409)
ok("short password 422", client.post("/api/auth/register", json={"username": "shorty", "password": "123"}).status_code == 422)
ok("bad login 401", client.post("/api/auth/login", json={"username": "alice", "password": "wrongpass"}).status_code == 401)
ok("good login 200", client.post("/api/auth/login", json={"username": "alice", "password": "secret1"}).status_code == 200)
ok("me works", client.get("/api/auth/me", headers=auth_hdr(ta)).json()["username"] == "alice")
ok("me anon 401", client.get("/api/auth/me").status_code == 401)

tb = client.post("/api/auth/register", json={"username": "bob", "password": "secret2"}).json()["token"]
ok("bob token", tb == "token-bob")

print("\n== private projects per user ==")
pa = client.post("/api/projects", json={"name": "A site", "html": "<h1>a</h1>", "kind": "scratch"}, headers=auth_hdr(ta)).json()["id"]
client.post("/api/projects", json={"name": "B site", "html": "<h1>b</h1>", "kind": "scratch"}, headers=auth_hdr(tb))
la = client.get("/api/projects", headers=auth_hdr(ta)).json()
ok("alice sees only her project", [p["id"] for p in la] == [pa])
ok("bob GET alice's project -> 404", client.get("/api/projects/" + pa, headers=auth_hdr(tb)).status_code == 404)
ok("bob DELETE alice's project -> 404", client.delete("/api/projects/" + pa, headers=auth_hdr(tb)).status_code == 404)
ok("alice GET own ok", client.get("/api/projects/" + pa, headers=auth_hdr(ta)).json()["html"] == "<h1>a</h1>")
ok("owner stamped", client.get("/api/projects/" + pa, headers=auth_hdr(ta)).json().get("owner") == "user-alice")

print("\n== удалённый проект не воскресает ==")
client.delete("/api/projects/" + pa, headers=auth_hdr(ta))
ok("deleted -> 404", client.get("/api/projects/" + pa, headers=auth_hdr(ta)).status_code == 404)
ok("сохранение в удалённый id -> 404",
   client.post("/api/projects", json={"id": pa, "name": "again", "html": "<h1>a</h1>", "kind": "scratch"},
               headers=auth_hdr(ta)).status_code == 404)

print("\n== logout сбрасывает кэш сессии ==")
client.post("/api/auth/logout", headers=auth_hdr(ta))
ok("кэш сессии очищен", auth._token_hash(ta) not in auth._REMOTE_CACHE)

print("\n----------------------------------------")
print(f"PASS: {P}   FAIL: {F}")
sys.exit(1 if F else 0)
