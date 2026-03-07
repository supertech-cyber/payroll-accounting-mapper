from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Provision13thCostCenterSnapshot:
    company_code: str
    company_name: str
    company_cnpj: str | None
    company_cnpj_base: str | None
    competence: str
    cost_center_code: str
    cost_center_name: str
    total_saldo_13th: float
    total_saldo_fgts: float
    total_saldo_inss: float
    total_saldo_terc: float
    total_saldo_rat: float


@dataclass
class Provision13thEntry:
    entry_code: str
    entry_description: str
    amount_previous: float
    amount_current: float
    amount_difference: float


@dataclass
class Provision13thResult:
    company_code: str
    company_name: str
    company_cnpj: str | None
    company_cnpj_base: str | None
    competence_previous: str
    competence_current: str
    cost_center_code: str
    cost_center_name: str
    entries: list[Provision13thEntry] = field(default_factory=list)
