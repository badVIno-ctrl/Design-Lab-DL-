"""Общая оснастка тестов: сервис пользователей и провайдер ИИ без сети.

Раньше учётные записи жили в локальной SQLite внутри backend/auth.py, и тесты
регистрировались напрямую. Теперь единственное хранилище — внешний сервис
(USER_DB_SERVICE_URL), поэтому тесты подставляют вместо него заглушку: она
отвечает на /v1/auth/* и позволяет проверять и вход, и приватность проектов,
не поднимая PostgreSQL.
"""
import time

TOKENS = {
    "token-alice": {"id": "user-alice", "username": "alice", "plan": "free"},
    "token-bob": {"id": "user-bob", "username": "bob", "plan": "free"},
    "token-pro": {"id": "user-pro", "username": "prouser", "plan": "pro"},
}


def bearer(token):
    return {"Authorization": "Bearer " + token}


def prime_sessions(auth_module, tokens=None):
    """Кладёт готовые сессии в кэш auth, чтобы не ходить в сеть за /v1/auth/me.

    Кэш живёт 60 секунд и ключуется хешем токена — точно так же, как в бою.
    """
    auth_module._REMOTE_CACHE.clear()
    for token, user in (tokens or TOKENS).items():
        auth_module._REMOTE_CACHE[auth_module._token_hash(token)] = (time.time() + 3600, dict(user))


class FakeUsersService:
    """Заглушка httpx.AsyncClient для запросов к сервису пользователей."""

    users = {}

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def request(self, method, url, json=None, headers=None):
        return self._route(url, json or {}, headers or {})

    async def post(self, url, json=None, headers=None, data=None):
        return self._route(url, json or {}, headers or {})

    async def get(self, url, headers=None):
        return self._route(url, {}, headers or {})

    def _route(self, url, body, headers):
        if url.endswith("/me"):
            token = headers.get("Authorization", "").replace("Bearer ", "")
            user = TOKENS.get(token)
            if not user:
                return FakeResponse(401, {"detail": "no session"})
            return FakeResponse(200, dict(user, enabled=True))
        if url.endswith("/register"):
            name = body.get("username", "")
            if name in self.users:
                return FakeResponse(409, {"detail": "exists"})
            self.users[name] = body.get("password", "")
            return FakeResponse(200, {"token": "token-" + name, "username": name, "plan": "free"})
        if url.endswith("/login"):
            name = body.get("username", "")
            if self.users.get(name) != body.get("password"):
                return FakeResponse(401, {"detail": "bad credentials"})
            return FakeResponse(200, {"token": "token-" + name, "username": name, "plan": "free"})
        if url.endswith("/logout"):
            return FakeResponse(204, None)
        return FakeResponse(404, {"detail": "not found"})


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.headers = {"content-type": "application/json"}
        self.text = "" if payload is None else str(payload)

    @property
    def content(self):
        import json
        return b"" if self._payload is None else json.dumps(self._payload).encode("utf-8")

    def json(self):
        return self._payload


class FakeProvider:
    """Заглушка httpx.AsyncClient для вызова провайдера ИИ."""

    def __init__(self, content):
        self.content = content

    def client(self):
        content = self.content

        class Client:
            def __init__(self, *args, **kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                return False

            async def post(self, *args, **kwargs):
                return FakeResponse(200, {"choices": [{"message": {"content": content}}]})

        return Client
