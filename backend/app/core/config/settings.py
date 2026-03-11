from __future__ import annotations

import os


class Settings:
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://payroll_user:payroll_pass@localhost:5432/payroll_accounting_mapper",
    )


settings = Settings()
