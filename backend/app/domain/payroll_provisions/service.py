from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any

from app.domain.payroll_provisions.parser_13th import parse_13th_reports
from app.domain.payroll_provisions.parser_vacation import parse_vacation_reports


def build_13th_provision_payload(
    previous_or_current_file_a: str | Path,
    previous_or_current_file_b: str | Path,
    source_filename_a: str,
    source_filename_b: str,
) -> dict[str, Any]:
    results = parse_13th_reports(previous_or_current_file_a, previous_or_current_file_b)

    return {
        "source_files": [source_filename_a, source_filename_b],
        "provision_type": "13th_salary",
        "total_cost_centers": len(results),
        "items": [asdict(item) for item in results],
    }


def build_vacation_provision_payload(
    previous_or_current_file_a: str | Path,
    previous_or_current_file_b: str | Path,
    source_filename_a: str,
    source_filename_b: str,
) -> dict[str, Any]:
    results = parse_vacation_reports(
        previous_or_current_file_a, previous_or_current_file_b
    )

    return {
        "source_files": [source_filename_a, source_filename_b],
        "provision_type": "vacation",
        "total_cost_centers": len(results),
        "items": [asdict(item) for item in results],
    }
