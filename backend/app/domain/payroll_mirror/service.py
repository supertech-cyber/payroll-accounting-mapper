from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any

from app.domain.payroll_mirror.parser import parse_payroll_mirror


def build_payroll_mirror_payload(
    file_path: str | Path, source_filename: str
) -> dict[str, Any]:
    blocks = parse_payroll_mirror(file_path)

    return {
        "source_file": source_filename,
        "total_blocks": len(blocks),
        "blocks": [asdict(block) for block in blocks],
    }
