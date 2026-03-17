from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Company:
    id: int
    code: str
    name: str
    cnpj: str | None
    cnpj_base: str | None
    output_template: str | None
    fpa_batch: int | None
    tag: str | None
