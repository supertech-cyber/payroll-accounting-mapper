from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any

from app.core.database.connection import get_db_cursor
from app.domain.mapping_resolution.models import (
    ResolvedPayrollBlock,
    ResolvedPayrollEvent,
)
from app.domain.payroll_mirror.service import build_payroll_mirror_payload


def _normalize_entry_type_for_mapping(entry_type: str) -> str:
    normalized = (entry_type or "").strip().upper()

    if normalized == "PROVENTO":
        return "P"
    if normalized == "DESCONTO":
        return "D"

    return normalized


def _find_company_by_cnpj_base(company_cnpj_base: str | None) -> dict[str, Any] | None:
    if not company_cnpj_base:
        return None

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, name, cnpj_base
            FROM companies
            WHERE cnpj_base = %s
              AND is_active = TRUE
            LIMIT 1
            """,
            (company_cnpj_base,),
        )
        return cursor.fetchone()


def _find_template_for_company(company_id: int) -> dict[str, Any] | None:
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT t.id, t.name, t.slug, t.file_type, t.layout_type
            FROM company_template_bindings b
            JOIN output_templates t ON t.id = b.template_id
            WHERE b.company_id = %s
              AND t.is_active = TRUE
            LIMIT 1
            """,
            (company_id,),
        )
        return cursor.fetchone()


def _find_cost_center(
    company_id: int, source_cost_center_code: str | None
) -> dict[str, Any] | None:
    if not source_cost_center_code:
        return None

    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, source_cost_center_code, source_cost_center_name, output_cost_center_code
            FROM cost_centers
            WHERE company_id = %s
              AND source_cost_center_code = %s
              AND is_active = TRUE
            LIMIT 1
            """,
            (company_id, source_cost_center_code),
        )
        return cursor.fetchone()


def _find_payroll_event_mapping(
    *,
    company_id: int,
    cost_center_id: int | None,
    entry_type: str,
    event_code: str,
) -> dict[str, Any] | None:
    normalized_entry_type = _normalize_entry_type_for_mapping(entry_type)
    with get_db_cursor() as cursor:
        if cost_center_id is not None:
            cursor.execute(
                """
                SELECT
                    pem.id,
                    pem.debit_account,
                    pem.credit_account,
                    pem.history_template,
                    t.slug AS output_template_slug
                FROM payroll_event_mappings pem
                JOIN output_templates t ON t.id = pem.output_template_id
                WHERE pem.company_id = %s
                  AND pem.cost_center_id = %s
                  AND pem.entry_type = %s
                  AND pem.event_code = %s
                  AND pem.is_active = TRUE
                LIMIT 1
                """,
                (company_id, cost_center_id, normalized_entry_type, event_code),
            )
            mapping = cursor.fetchone()
            if mapping:
                return mapping

        cursor.execute(
            """
            SELECT
                pem.id,
                pem.debit_account,
                pem.credit_account,
                pem.history_template,
                t.slug AS output_template_slug
            FROM payroll_event_mappings pem
            JOIN output_templates t ON t.id = pem.output_template_id
            WHERE pem.company_id = %s
              AND pem.cost_center_id IS NULL
              AND pem.entry_type = %s
              AND pem.event_code = %s
              AND pem.is_active = TRUE
            LIMIT 1
            """,
            (company_id, normalized_entry_type, event_code),
        )
        return cursor.fetchone()


def build_resolved_payroll_mirror_payload(
    *,
    file_path: str | Path,
    source_filename: str,
) -> dict[str, Any]:
    parsed = build_payroll_mirror_payload(
        file_path=file_path, source_filename=source_filename
    )
    resolved_blocks: list[dict[str, Any]] = []

    for block in parsed["blocks"]:
        company = _find_company_by_cnpj_base(block.get("company_cnpj_base"))
        template = _find_template_for_company(company["id"]) if company else None
        cost_center = (
            _find_cost_center(company["id"], block.get("cost_center_code"))
            if company and block.get("cost_center_code")
            else None
        )

        resolved_events: list[ResolvedPayrollEvent] = []

        for event in block.get("events", []):
            mapping = None
            if company:
                mapping = _find_payroll_event_mapping(
                    company_id=company["id"],
                    cost_center_id=cost_center["id"] if cost_center else None,
                    entry_type=event["entry_type"],
                    event_code=event["event_code"],
                )

            resolved_events.append(
                ResolvedPayrollEvent(
                    entry_type=event["entry_type"],
                    event_code=event["event_code"],
                    description=event["description"],
                    amount=event["amount"],
                    mapping_status="mapped" if mapping else "unmapped",
                    debit_account=mapping["debit_account"] if mapping else None,
                    credit_account=mapping["credit_account"] if mapping else None,
                    history_template=mapping["history_template"] if mapping else None,
                    output_template_slug=(
                        mapping["output_template_slug"] if mapping else None
                    ),
                )
            )

        resolved_block = ResolvedPayrollBlock(
            company_code=block["company_code"],
            company_name=block["company_name"],
            company_cnpj=block["company_cnpj"],
            company_cnpj_base=block["company_cnpj_base"],
            competence=block["competence"],
            cost_center_code=block["cost_center_code"],
            cost_center_name=block["cost_center_name"],
            is_totalizer=block["is_totalizer"],
            source_start_row=block["source_start_row"],
            summary=block["summary"],
            gps=block["gps"],
            company_status="matched" if company else "unmatched",
            template_status="matched" if template else "unmatched",
            cost_center_status=(
                "skipped"
                if block["cost_center_code"] is None
                else ("matched" if cost_center else "unmatched")
            ),
            resolved_template_slug=template["slug"] if template else None,
            events=resolved_events,
        )

        resolved_blocks.append(asdict(resolved_block))

    return {
        "source_file": parsed["source_file"],
        "total_blocks": parsed["total_blocks"],
        "blocks": resolved_blocks,
    }
