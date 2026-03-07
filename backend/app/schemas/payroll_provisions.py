from __future__ import annotations

from pydantic import BaseModel


class Parse13thProvisionResponse(BaseModel):
    source_files: list[str]
    provision_type: str
    total_cost_centers: int
    items: list[dict]
