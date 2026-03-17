#!/usr/bin/env python3
"""
Seed the event registry from  backend/samples/eventos_super_safra.xlsx

Run from the project root (with VPN active if DB is remote):
    python backend/scripts/seed_event_registry.py

The script is idempotent: it uses INSERT … ON CONFLICT DO NOTHING /
ON CONFLICT DO UPDATE so it is safe to re-run.
"""
from __future__ import annotations

import asyncio
import os
import re
import sys
from pathlib import Path

# Allow imports from app/ and load .env from project root
_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "backend"))

from dotenv import load_dotenv

# 1. Base .env
load_dotenv(_ROOT / ".env", override=False)
# 2. Environment-specific override (.env.development, .env.production, …)
_env = os.getenv("APP_ENV", "development")
_env_override = _ROOT / f".env.{_env}"
if _env_override.exists():
    load_dotenv(_env_override, override=True)

import asyncpg
import openpyxl

# ── Config ────────────────────────────────────────────────────────────────────

XLSX_PATH = Path(__file__).resolve().parents[1] / "samples" / "eventos_super_safra.xlsx"

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://payroll:payroll@localhost:5432/payroll_mapper",
)

# Company that owns this spreadsheet
COMPANY_CODE = "supersafra"
COMPANY_NAME = "Super Safra Comercial Agrícola Ltda."

# ── Helpers ───────────────────────────────────────────────────────────────────

_CC_PATTERN = re.compile(r"^(\d+)\s*[-–]\s*(.+)$")


def parse_cc_header(header: str) -> tuple[str, str]:
    """
    Returns (code, name) from a cost-center column header.

    Examples:
      "1 - Administrativo"            → ("1",      "Administrativo")
      "208 - PESSOAS & CULTURA"       → ("208",    "PESSOAS & CULTURA")
      "Colaboradores sem centro de custo" → ("SEM_CC", "Colaboradores sem CC")
      "(Empresa) Super Safra …"       → ("EMPRESA_1", "Super Safra …")  – indexed later
    """
    h = header.strip()
    m = _CC_PATTERN.match(h)
    if m:
        return m.group(1), m.group(2).strip()
    if "sem centro de custo" in h.lower() or "sem cc" in h.lower():
        return "SEM_CC", "Colaboradores sem centro de custo"
    if h.lower().startswith("(empresa)"):
        name = h[9:].strip(" )")
        return "", name  # code assigned per-occurrence below
    return "", h


def normalize_entry_type(raw: object) -> str | None:
    if raw is None:
        return None
    v = str(raw).strip().upper()
    if v in ("P",):
        return "P"
    if v == "D":
        return "D"
    if v == "PROV":
        return "PROV"
    return None


def to_str(val: object) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


# ── Main ──────────────────────────────────────────────────────────────────────


async def seed() -> None:
    print(f"Connecting to {DATABASE_URL!r} …")
    conn: asyncpg.Connection = await asyncpg.connect(DATABASE_URL)

    try:
        print(f"Loading workbook: {XLSX_PATH}")
        wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)
        ws = wb.active

        rows = list(ws.iter_rows(values_only=True))
        header = rows[0]  # row 1
        data_rows = rows[1:]  # rows 2+

        # -- 1. Ensure company exists ----------------------------------------
        company_id: int = await conn.fetchval(
            """
            INSERT INTO companies (code, name)
            VALUES ($1, $2)
            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """,
            COMPANY_CODE,
            COMPANY_NAME,
        )
        print(f"  Company id={company_id}  ({COMPANY_NAME})")

        # -- 2. Parse cost-center columns (cols 5+ = index 4+) ----------------
        empresa_counter = 0
        cc_col_map: dict[int, int] = {}  # col_index (0-based) → cost_center DB id

        for col_idx in range(4, len(header)):
            raw_header = header[col_idx]
            if raw_header is None:
                continue

            code, name = parse_cc_header(str(raw_header))

            if code == "":
                # "(Empresa) …" column or unknown → assign sequential code
                empresa_counter += 1
                code = f"EMPRESA_{empresa_counter}"

            cc_id: int = await conn.fetchval(
                """
                INSERT INTO cost_centers (code, name, company_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (code, company_id) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
                """,
                code,
                name,
                company_id,
            )
            cc_col_map[col_idx] = cc_id
            print(f"    CC  [{code:>10}]  id={cc_id}  {name}")

        # -- 3. Parse events + mappings ----------------------------------------
        inserted_events = 0
        inserted_mappings = 0

        for row in data_rows:
            raw_code = row[0]
            raw_desc = row[1]
            raw_pdp = row[2]
            raw_credit = row[3]

            if raw_code is None:
                continue

            event_code = str(raw_code).strip()
            description = str(raw_desc).strip() if raw_desc else event_code
            entry_type = normalize_entry_type(raw_pdp)

            if entry_type is None:
                print(
                    f"  WARNING: skipping row with unknown PROV/D/P={raw_pdp!r} (event {event_code})"
                )
                continue

            credit_default = to_str(raw_credit)

            # Upsert event
            event_id: int = await conn.fetchval(
                """
                INSERT INTO events (code, description, entry_type)
                VALUES ($1, $2, $3)
                ON CONFLICT (code) DO UPDATE
                    SET description = EXCLUDED.description,
                        entry_type  = EXCLUDED.entry_type
                RETURNING id
                """,
                event_code,
                description,
                entry_type,
            )
            inserted_events += 1

            # Per-cost-center mappings
            for col_idx, cc_id in cc_col_map.items():
                raw_debit = row[col_idx] if col_idx < len(row) else None
                debit_account = to_str(raw_debit)

                # Only insert when there's at least one account defined
                if credit_default is None and debit_account is None:
                    continue

                # For 'D' (desconto): the spreadsheet stores debit in col D and
                # credits per cost-center column — so we swap them.
                if entry_type == "D":
                    cr = debit_account
                    db = credit_default
                else:
                    cr = credit_default
                    db = debit_account

                await conn.execute(
                    """
                    INSERT INTO event_mappings (event_id, cost_center_id, credit_account, debit_account)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (event_id, cost_center_id) DO UPDATE
                        SET credit_account = EXCLUDED.credit_account,
                            debit_account  = EXCLUDED.debit_account
                    """,
                    event_id,
                    cc_id,
                    cr,
                    db,
                )
                inserted_mappings += 1

        print(
            f"\n✓ Seed complete: {inserted_events} events, "
            f"{inserted_mappings} mappings, "
            f"{len(cc_col_map)} cost centers."
        )

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
