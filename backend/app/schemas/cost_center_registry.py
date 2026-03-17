from __future__ import annotations

from pydantic import BaseModel


# ── Output ────────────────────────────────────────────────────────────────────


class CostCenterOut(BaseModel):
    id: int
    code: str
    name: str
    company_id: int | None
    target_cost_center_id: int | None = None

    model_config = {"from_attributes": True}


# ── Input ─────────────────────────────────────────────────────────────────────


class CostCenterCreate(BaseModel):
    code: str
    name: str
    company_id: int | None = None
    target_cost_center_id: int | None = None


class CostCenterUpdate(BaseModel):
    name: str | None = None
    company_id: int | None = None
    target_cost_center_id: int | None = None
