from __future__ import annotations

from pydantic import BaseModel


# ── Output ────────────────────────────────────────────────────────────────────


class CompanyOut(BaseModel):
    id: int
    code: str
    name: str
    cnpj: str | None
    cnpj_base: str | None
    output_template: str | None
    fpa_batch: int | None
    tag: str | None

    model_config = {"from_attributes": True}


# ── Input ─────────────────────────────────────────────────────────────────────


class CompanyCreate(BaseModel):
    code: str
    name: str
    cnpj: str | None = None
    cnpj_base: str | None = None
    output_template: str | None = None
    fpa_batch: int | None = None
    tag: str | None = None


class CompanyUpdate(BaseModel):
    name: str | None = None
    cnpj: str | None = None
    cnpj_base: str | None = None
    output_template: str | None = None
    fpa_batch: int | None = None
    tag: str | None = None
