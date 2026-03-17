from __future__ import annotations

from pathlib import Path

from app.domain.payroll_mirror.models import PayrollBlock
from app.infrastructure.excel.payroll_mirror_reader import parse_payroll_mirror


def get_payroll_mirror_blocks(file_path: str | Path) -> list[PayrollBlock]:
    return parse_payroll_mirror(file_path)
