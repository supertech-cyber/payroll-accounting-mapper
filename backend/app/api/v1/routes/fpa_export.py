"""
FPA Export — generates Elevor-compatible .fpa accounting files from resolved
payroll blocks.

FPA file format (one line per accounting entry):
    {batch},{DDMMYYYY},{debit_account},{credit_account},{amount:.2f},,{historico},,

One file is generated per cost-centre block and bundled into a ZIP.
The batch number used in each line is taken from the block's company_fpa_batch
field; the request-level ``batch`` is used as a fallback when that field is None.
"""

from __future__ import annotations

import calendar
import io
import zipfile
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/exports", tags=["Exports"])

# ── Request / response models ─────────────────────────────────────────────────


class FpaEventItem(BaseModel):
    entry_type: str
    event_code: str
    description: str
    amount: float
    mapping: dict[str, Any] | None = None


class FpaBlock(BaseModel):
    company_code: str
    company_name: str
    company_fpa_batch: int | None = None  # de-para code for this company
    competence: str  # "YYYY-MM"
    cost_center_code: str | None
    cost_center_name: str | None
    is_totalizer: bool
    events: list[FpaEventItem]


class FpaExportRequest(BaseModel):
    blocks: list[FpaBlock]
    batch: int = 1  # default entry-type prefix for the FPA line


# ── FPA generation helpers ────────────────────────────────────────────────────


def _competence_to_date(competence: str) -> str:
    """
    Convert 'YYYY-MM' to the last day of the month in DDMMYYYY format.
    e.g. '2025-12' → '31122025'
    """
    year, month = int(competence[:4]), int(competence[5:7])
    last_day = calendar.monthrange(year, month)[1]
    return f"{last_day:02d}{month:02d}{year}"


def _competence_label(competence: str) -> str:
    """'2025-12' → '12/2025'"""
    year, month = competence[:4], competence[5:7]
    return f"{month}/{year}"


def _generate_fpa_content(block: FpaBlock, batch: int) -> list[str]:
    """Return FPA lines for a single cost-centre block (helper for company grouping)."""
    date_str = _competence_to_date(block.competence)
    comp_label = _competence_label(block.competence)
    lines: list[str] = []

    for event in block.events:
        if not event.mapping:
            continue
        debit = event.mapping.get("debit_account")
        credit = event.mapping.get("credit_account")
        if not debit or not credit:
            continue  # skip unmapped entries
        amount = f"{event.amount:.2f}"
        historico = f"{event.description} {comp_label}"
        lines.append(f"{batch},{date_str},{debit},{credit},{amount},,{historico},,")

    return lines


def _safe_filename(name: str) -> str:
    """Strip / replace characters that are invalid in file names."""
    for ch in r'\/:*?"<>|':
        name = name.replace(ch, "_")
    return name.strip()


# ── Endpoint ──────────────────────────────────────────────────────────────────


@router.post(
    "/fpa",
    summary="Exportar lançamentos contábeis no formato FPA (Elevor)",
    response_class=StreamingResponse,
)
async def export_fpa(body: FpaExportRequest) -> StreamingResponse:
    """
    Generate one .fpa file per cost-centre block and return them bundled in a ZIP.
    Totalizer blocks are skipped — only cost-centre-level blocks are exported.
    """
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # One .fpa file per cost-centre block; totalizer blocks are skipped
        for block in body.blocks:
            if block.is_totalizer:
                continue

            # Use the company's specific FPA code; fall back to the request batch
            effective_batch = (
                block.company_fpa_batch
                if block.company_fpa_batch is not None
                else body.batch
            )
            lines = _generate_fpa_content(block, effective_batch)
            if not lines:
                continue

            cc_code = block.cost_center_code or "sem-cc"
            cc_name = block.cost_center_name or ""
            filename = (
                _safe_filename(f"{block.company_code} - {cc_code} - {cc_name}") + ".fpa"
            )
            zf.writestr(filename, "\n".join(lines))

    zip_buffer.seek(0)

    comp = body.blocks[0].competence if body.blocks else "export"
    zip_name = f"FPA_{comp.replace('-', '_')}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )
