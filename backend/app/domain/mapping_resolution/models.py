from __future__ import annotations

from dataclasses import dataclass

from app.domain.payroll_mirror.models import EventItem, PayrollBlock


@dataclass
class AccountMapping:
    credit_account: str | None
    debit_account: str | None
    is_mapped: bool


@dataclass
class ResolvedEventItem:
    entry_type: str
    event_code: str
    description: str
    amount: float
    mapping: AccountMapping


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
    events: list[ResolvedEventItem]
    summary: dict[str, float]
    gps: dict
    source_start_row: int | None
