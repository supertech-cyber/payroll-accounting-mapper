from __future__ import annotations

from pydantic import BaseModel


class ProvisionEntryOut(BaseModel):
    entry_code: str
    entry_description: str
    amount_previous: float
    amount_current: float
    amount_difference: float


class ProvisionResultOut(BaseModel):
    company_code: str
    company_name: str
    company_cnpj: str | None
    company_cnpj_base: str | None
    competence_previous: str
    competence_current: str
    cost_center_code: str
    cost_center_name: str
    entries: list[ProvisionEntryOut]


class Parse13thProvisionResponse(BaseModel):
    source_files: list[str]
    provision_type: str
    total_cost_centers: int
    items: list[ProvisionResultOut]


class ParseVacationProvisionResponse(BaseModel):
    source_files: list[str]
    provision_type: str
    total_cost_centers: int
    items: list[ProvisionResultOut]
