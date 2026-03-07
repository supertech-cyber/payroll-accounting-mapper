from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class EventItem:
    entry_type: str  # PROVENTO | DESCONTO
    event_code: str
    description: str
    amount: float


@dataclass
class PayrollBlock:
    company_code: str
    company_name: str
    company_cnpj: str | None
    company_cnpj_base: str | None
    competence: str
    cost_center_code: str | None
    cost_center_name: str | None
    is_totalizer: bool
    events: list[EventItem] = field(default_factory=list)
    summary: dict[str, float] = field(default_factory=dict)
    gps: dict[str, str | float] = field(default_factory=dict)
    source_start_row: int | None = None
