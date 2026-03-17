from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ProvisionEntry:
    entry_code: str
    entry_description: str
    amount_previous: float
    amount_current: float
    amount_difference: float


@dataclass
class ProvisionResult:
    company_code: str
    company_name: str
    company_cnpj: str | None
    company_cnpj_base: str | None
    competence_previous: str
    competence_current: str
    cost_center_code: str
    cost_center_name: str
    entries: list[ProvisionEntry] = field(default_factory=list)
