from __future__ import annotations

from pydantic import BaseModel


class TagOut(BaseModel):
    id: int
    slug: str
    label: str
    description: str | None

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    slug: str
    label: str
    description: str | None = None


class TagUpdate(BaseModel):
    label: str | None = None
    description: str | None = None
