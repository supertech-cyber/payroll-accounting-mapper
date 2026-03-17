from __future__ import annotations

from dataclasses import dataclass

# PROV/D/P values from the spreadsheet, normalised to one of these three
ENTRY_TYPES = ("P", "D", "PROV")


@dataclass
class Event:
    id: int
    code: str  # '5', '20', 'PROV13', etc.
    description: str
    entry_type: str  # 'P' | 'D' | 'PROV'
    is_active: bool


@dataclass
class EventMapping:
    id: int
    event_id: int
    cost_center_id: int | None  # None = default mapping (no CC specificity)
    credit_account: str | None
    debit_account: str | None


@dataclass
class EventWithMappings:
    event: Event
    mappings: list[EventMapping]
