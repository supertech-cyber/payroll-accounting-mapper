from __future__ import annotations

import re
from decimal import Decimal
from typing import Any


def norm(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def only_digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def to_float(value: Any) -> float:
    if value in (None, "", " "):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return 0.0
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    elif "," in text:
        text = text.replace(",", ".")
    return float(Decimal(text))


def parse_company(text: str) -> tuple[str, str]:
    match = re.match(r"Empresa:\s*(\d+)\s*-\s*(.+)$", text)
    if not match:
        return "", text
    return match.group(1), match.group(2).strip()


def parse_cnpj(text: str) -> tuple[str | None, str | None]:
    match = re.search(r"CNPJ[:\s]*([\d\.\-\/]+)", text, flags=re.IGNORECASE)
    if not match:
        return None, None
    cnpj = only_digits(match.group(1))
    if len(cnpj) != 14:
        return None, None
    return cnpj, cnpj[:8]


def find_company_cnpj(ws: Any, company_row: int) -> tuple[str | None, str | None]:
    max_cols_to_scan = min(ws.max_column, 54)
    for row in range(company_row, min(company_row + 2, ws.max_row) + 1):
        for col in range(1, max_cols_to_scan + 1):
            text = norm(ws.cell(row, col).value)
            if "CNPJ" in text.upper():
                cnpj, cnpj_base = parse_cnpj(text)
                if cnpj:
                    return cnpj, cnpj_base
    return None, None


def competence_to_display(competence: str) -> str:
    year, month = competence.split("-")
    return f"{month}/{year}"
