from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Project root: backend/app/core/config/settings.py → 4 levels up
_ROOT = Path(__file__).resolve().parents[4]

# 1. Load base .env  (committed-safe defaults / local overrides)
load_dotenv(_ROOT / ".env", override=False)
# 2. Load .env.<APP_ENV> if it exists — values here win over .env
_env = os.getenv("APP_ENV", "development")
_env_file = _ROOT / f".env.{_env}"
if _env_file.exists():
    load_dotenv(_env_file, override=True)


def _build_database_url() -> str:
    """Build the asyncpg connection URL.

    Priority:
    1. DATABASE_URL (single var, already a full URL)
    2. DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME (individual vars)
    3. Hard-coded local dev fallback
    """
    if url := os.getenv("DATABASE_URL"):
        return url

    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "")
    name = os.getenv("DB_NAME", "payroll_mapper")

    # URL-encode '@' in password so asyncpg parses it correctly
    password_safe = password.replace("@", "%40")
    return f"postgresql://{user}:{password_safe}@{host}:{port}/{name}"


class Settings:
    app_name: str = os.getenv("APP_NAME", "Payroll Accounting Mapper API")
    app_version: str = "0.4.0"
    database_url: str = _build_database_url()

    # Comma-separated list of allowed CORS origins
    # e.g. CORS_ORIGINS=http://192.168.120.210:3000,http://localhost:3000
    @property
    def cors_origins(self) -> list[str]:
        raw = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        )
        return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
