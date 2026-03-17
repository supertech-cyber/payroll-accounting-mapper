from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CostCenter:
    id: int
    code: str
    name: str
    company_id: int | None
    target_cost_center_id: int | None = None
