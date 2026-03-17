from __future__ import annotations

from pydantic import BaseModel


# ── Output ────────────────────────────────────────────────────────────────────


class EventMappingOut(BaseModel):
    id: int
    event_id: int
    cost_center_id: int | None
    credit_account: str | None
    debit_account: str | None

    model_config = {"from_attributes": True}


class EventOut(BaseModel):
    id: int
    code: str
    description: str
    entry_type: str
    is_active: bool

    model_config = {"from_attributes": True}


class EventWithMappingsOut(BaseModel):
    event: EventOut
    mappings: list[EventMappingOut]


# ── Input ─────────────────────────────────────────────────────────────────────


class EventCreate(BaseModel):
    code: str
    description: str
    entry_type: str  # 'P' | 'D' | 'PROV'


class EventUpdate(BaseModel):
    description: str | None = None
    entry_type: str | None = None
    is_active: bool | None = None


class EventMappingUpsert(BaseModel):
    cost_center_id: int | None = None
    credit_account: str | None = None
    debit_account: str | None = None


class EventEnsure(BaseModel):
    """Find-or-create an event by code (used when processing unmapped payroll events)."""

    code: str
    description: str
    entry_type: str  # 'P' | 'D' | 'PROV'


class EventWithAllMappingsOut(BaseModel):
    """Flat event with all its mappings embedded — used for bulk tree loading."""

    id: int
    code: str
    description: str
    entry_type: str
    is_active: bool
    mappings: list[EventMappingOut] = []
