from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class AccountMappingOut(BaseModel):
    credit_account: str | None
    debit_account: str | None
    is_mapped: bool


class EventItemOut(BaseModel):
    entry_type: str
    event_code: str
    description: str
    amount: float
    mapping: AccountMappingOut | None = None  # None when DB resolution was skipped


class PayrollBlockOut(BaseModel):
    company_code: str
    company_name: str
    company_cnpj: str | None
    company_cnpj_base: str | None
    company_is_mapped: bool = False
    competence: str
    cost_center_code: str | None
    cost_center_name: str | None
    cost_center_is_mapped: bool = False
    is_totalizer: bool
    events: list[EventItemOut]
    summary: dict[str, float]
    gps: dict[str, Any]
    source_start_row: int | None


class ParsePayrollMirrorResponse(BaseModel):
    source_file: str
    total_blocks: int
    blocks: list[PayrollBlockOut]
