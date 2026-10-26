"""Design&Lab backend configuration (env-driven, no secrets in code)."""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = Path(os.getenv("FRONTEND_DIR", ROOT / "frontend"))
DATA_DIR = Path(os.getenv("DATA_DIR", ROOT / "data"))
PROJECTS_DIR = DATA_DIR / "projects"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

# Separate persistent service for users, sessions, subscriptions and usage.
USER_DB_SERVICE_URL = os.getenv("USER_DB_SERVICE_URL", "").rstrip("/")
USER_DB_SERVICE_TIMEOUT = float(os.getenv("USER_DB_SERVICE_TIMEOUT", "60"))
# Сервисный токен того же сервиса — нужен, чтобы менять тариф пользователя.
SERVICE_API_TOKEN = os.getenv("SERVICE_API_TOKEN", "")

# --- AI provider (OpenAI-compatible: OpenAI, OpenRouter, Groq, Cerebras, Mistral, local…) ---
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")
AI_TEMPERATURE = float(os.getenv("AI_TEMPERATURE", "0.5"))
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "8192"))
# Сколько секунд ждать ответ модели. Это тот самый таймаут, с которым
# proxy.py открывает соединение с провайдером (_open_upstream).
# 22 августа поднято со 120 до 300: на большой странице сильные модели
# не укладывались в две минуты, и запрос обрывался раньше первого байта.
# Клиентский таймаут в frontend/request-cancel.js должен оставаться чуть
# больше этого значения, иначе браузер обрежет раньше сервера и настоящая
# причина отказа до человека не дойдёт.
# Значение можно переопределить переменной окружения AI_TIMEOUT.
AI_TIMEOUT = float(os.getenv("AI_TIMEOUT", "300"))

# CORS: comma-separated origins, or * for dev
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]

def _flag(name: str, default: str) -> bool:
    return os.getenv(name, default).lower() in ("1", "true", "yes", "on")


# Authentication and project access are backed by USER_DB_SERVICE_URL.
# По умолчанию ВКЛЮЧЕНО. Раньше здесь стоял "0", и при пустой переменной любой
# анонимный запрос мог прочитать, перезаписать и удалить проекты ВСЕХ
# пользователей: /api/projects отдавал общий список, потому что _owned()
# возвращает True, когда проверка выключена.
AUTH_ENABLED = _flag("AUTH_ENABLED", "1")

# Разрешить ли пользователю самому менять себе тариф через /api/plan/subscribe.
# Выключено: тариф ставит сервис пользователей после оплаты или администратор.
SELF_SERVE_PLANS = _flag("SELF_SERVE_PLANS", "0")

# Admin-only diagnostics (/api/*/check). Empty value disables them completely.
ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN", "")

# Сколько генераций в сутки даёт бесплатный тариф (0 — без ограничений).
FREE_DAILY_EDITS = int(os.getenv("FREE_DAILY_EDITS", "5"))


def has_ai_key() -> bool:
    return bool(AI_API_KEY)
