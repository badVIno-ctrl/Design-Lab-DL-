"""Backend tests via Starlette TestClient. No real network: AI and the users
service are mocked (backend/_testkit.py).

Запуск: python3 backend/test_backend.py
"""
import os, tempfile, sys

# isolate data dir + ensure no AI key before importing the app
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="dl_test_")
os.environ["AI_API_KEY"] = ""
os.environ["FRONTEND_DIR"] = tempfile.mkdtemp(prefix="dl_fe_")  # empty; mount harmless
os.environ["USER_DB_SERVICE_URL"] = "https://users.example.test"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient
import backend.main as m
import backend.ai as ai
import backend.auth as auth
from backend.audit import audit_html
from backend.ai import extract_html
from backend import _testkit as kit

client = TestClient(m.app)
kit.prime_sessions(auth)
ALICE = kit.bearer("token-alice")
P=0; F=0
def ok(n,c):
    global P,F
    if c: P+=1; print("  \u2705",n)
    else: F+=1; print("  \u274c",n)

print("\n== extract_html ==")
ok("strips fences", extract_html("hey ```html\n<!DOCTYPE html><html></html>\n```").startswith("<!DOCTYPE html>"))
ok("cuts prose after </html>", extract_html("<html>x</html>\n\nHope this helps").endswith("</html>"))
ok("empty->empty", extract_html("")=="")

print("\n== /api/health и /api/models ==")
r = client.get("/api/health")
ok("health 200", r.status_code==200)
ok("health ok:true", r.json()["ok"] is True)
ok("models: ready false (no key)", client.get("/api/models").json()["ready"] is False)

print("\n== /api/ai требует входа ==")
ok("anon -> 401", client.post("/api/ai", json={"mode":"scratch","message":"кофейня"}).status_code==401)

print("\n== /api/ai without key -> 503 ==")
r = client.post("/api/ai", json={"mode":"scratch","message":"кофейня"}, headers=ALICE)
ok("503 when no key", r.status_code==503)

print("\n== /api/ai happy path (mocked provider) ==")
DOC = "<!DOCTYPE html><html lang='ru'><head><meta name='viewport' content='w'><title>Кафе</title></head><body><h1>Кофе</h1></body></html>"
ai.config.AI_API_KEY = "test-key"          # pretend a key is configured
ai.httpx.AsyncClient = kit.FakeProvider("Готово!\n```html\n"+DOC+"\n```").client()
r = client.post("/api/ai", json={"mode":"scratch","message":"сделай лендинг кофейни"}, headers=ALICE)
ok("ai 200", r.status_code==200)
ok("returns extracted html doc", r.json()["html"].startswith("<!DOCTYPE html>") and "Кофе" in r.json()["html"])
ai.config.AI_API_KEY = ""                  # reset

print("\n== /api/projects CRUD (вошедший пользователь) ==")
r = client.post("/api/projects", json={"name":"Мой сайт","html":"<h1>hi</h1>","kind":"scratch"}, headers=ALICE)
ok("create 200", r.status_code==200)
pid = r.json()["id"]
ok("has id", bool(pid))
r = client.get("/api/projects", headers=ALICE)
ok("list contains it", any(p["id"]==pid for p in r.json()))
r = client.post("/api/projects", json={"id":pid,"name":"Переименован","html":"<h1>v2</h1>","kind":"scratch"}, headers=ALICE)
ok("update keeps id", r.json()["id"]==pid and r.json()["name"]=="Переименован")
r = client.get(f"/api/projects/{pid}", headers=ALICE)
ok("get returns html v2", r.json()["html"]=="<h1>v2</h1>")
r = client.delete(f"/api/projects/{pid}", headers=ALICE)
ok("delete 204", r.status_code==204)
r = client.get(f"/api/projects/{pid}", headers=ALICE)
ok("gone -> 404", r.status_code==404)
r = client.get("/api/projects/../../etc/passwd", headers=ALICE)
ok("path traversal blocked", r.status_code in (400,404))

print("\n== /api/audit ==")
leak = "<html><body><h1>a</h1><script>var k='sk-or-v1-"+("a"*40)+"'</script></body></html>"
r = client.post("/api/audit", json={"html":leak})
j = r.json()
ok("audit 200", r.status_code==200)
ok("flags leaked key high", any(i["sev"]=="high" and ("ключ" in i["title"] or "секрет" in i["title"]) for i in j["items"]))
ok("score < 90", j["score"] < 90)
# parity sanity vs direct function
ok("route matches audit_html()", j["score"]==audit_html(leak)["score"])

print("\n----------------------------------------")
print(f"PASS: {P}   FAIL: {F}")
sys.exit(1 if F else 0)
