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


class Settings:
    app_name: str = os.getenv("APP_NAME", "Payroll Accounting Mapper API")
    app_version: str = "0.4.0"
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:CHANGE_ME@localhost:5433/payroll_mapper",
    )

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
