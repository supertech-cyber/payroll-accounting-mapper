from __future__ import annotations

from pydantic import BaseModel


class ParsePayrollMirrorResponse(BaseModel):
    source_file: str
    total_blocks: int
    blocks: list[dict]
