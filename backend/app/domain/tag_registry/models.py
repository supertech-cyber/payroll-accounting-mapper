from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Tag:
    id: int
    slug: str
    label: str
    description: str | None
