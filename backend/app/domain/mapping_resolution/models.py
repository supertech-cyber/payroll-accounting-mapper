from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ResolvedPayrollEvent:
    entry_type: str
    event_code: str
    description: str
    amount: float
    mapping_status: str  # mapped | unmapped
    debit_account: str | None = None
    credit_account: str | None = None
    history_template: str | None = None
    output_template_slug: str | None = None


@dataclass
class ResolvedPayrollBlock:
    company_code: str
    company_name: str
    company_cnpj: str | None
    company_cnpj_base: str | None
    competence: str
    cost_center_code: str | None
    cost_center_name: str | None
    is_totalizer: bool
    source_start_row: int | None
    summary: dict[str, float]
    gps: dict[str, str | float]
    company_status: str  # matched | unmatched
    template_status: str  # matched | unmatched
    cost_center_status: str  # matched | unmatched | skipped
    resolved_template_slug: str | None
    events: list[ResolvedPayrollEvent]
