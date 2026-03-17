from __future__ import annotations

import shutil
import tempfile
from dataclasses import asdict
from pathlib import Path
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.domain.mapping_resolution.models import ResolvedPayrollBlock
from app.domain.mapping_resolution.service import resolve_payroll_blocks
from app.domain.payroll_mirror.service import get_payroll_mirror_blocks
from app.infrastructure.db.dependencies import get_conn
from app.infrastructure.db.event_repo import PgEventMappingRepository
from app.schemas.payroll_mirror import (
    AccountMappingOut,
    EventItemOut,
    ParsePayrollMirrorResponse,
    PayrollBlockOut,
)

router = APIRouter()


def _block_to_out(
    block: ResolvedPayrollBlock,
    mapped_companies: set[str],
    mapped_ccs: set[str],
) -> PayrollBlockOut:
    events_out = [
        EventItemOut(
            entry_type=e.entry_type,
            event_code=e.event_code,
            description=e.description,
            amount=e.amount,
            mapping=AccountMappingOut(
                credit_account=e.mapping.credit_account,
                debit_account=e.mapping.debit_account,
                is_mapped=e.mapping.is_mapped,
            ),
        )
        for e in block.events
    ]
    return PayrollBlockOut(
        company_code=block.company_code,
        company_name=block.company_name,
        company_cnpj=block.company_cnpj,
        company_cnpj_base=block.company_cnpj_base,
        company_is_mapped=block.company_code in mapped_companies,
        competence=block.competence,
        cost_center_code=block.cost_center_code,
        cost_center_name=block.cost_center_name,
        cost_center_is_mapped=(
            block.cost_center_code in mapped_ccs if block.cost_center_code else False
        ),
        is_totalizer=block.is_totalizer,
        events=events_out,
        summary=block.summary,
        gps=block.gps,
        source_start_row=block.source_start_row,
    )


@router.post("/imports/payroll-mirror/parse", response_model=ParsePayrollMirrorResponse)
async def parse_payroll_mirror(
    file: UploadFile = File(...),
    conn: Annotated[asyncpg.Connection, Depends(get_conn)] = None,  # type: ignore[assignment]
) -> ParsePayrollMirrorResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo não informado.")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".xlsx", ".xlsm"}:
        raise HTTPException(
            status_code=400, detail="Envie um arquivo Excel válido (.xlsx ou .xlsm)."
        )

    temp_dir = Path(tempfile.mkdtemp(prefix="payroll_mirror_"))
    temp_file = temp_dir / file.filename

    try:
        with temp_file.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        blocks = get_payroll_mirror_blocks(temp_file)

        # Resolve accounting mappings from the DB
        mapping_repo = PgEventMappingRepository(conn)
        resolved = await resolve_payroll_blocks(blocks, mapping_repo)

        # Bulk-check which company / cost-centre codes are in the registry
        company_codes = list({b.company_code for b in resolved if b.company_code})
        cc_codes = list({b.cost_center_code for b in resolved if b.cost_center_code})
        company_rows = await conn.fetch(
            "SELECT code FROM companies WHERE code = ANY($1)", company_codes
        )
        cc_rows = await conn.fetch(
            "SELECT code FROM cost_centers WHERE code = ANY($1)", cc_codes
        )
        mapped_companies: set[str] = {r["code"] for r in company_rows}
        mapped_ccs: set[str] = {r["code"] for r in cc_rows}

        return ParsePayrollMirrorResponse(
            source_file=file.filename,
            total_blocks=len(resolved),
            blocks=[_block_to_out(b, mapped_companies, mapped_ccs) for b in resolved],
        )

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Erro ao processar o arquivo: {exc}"
        ) from exc
    finally:
        try:
            if temp_file.exists():
                temp_file.unlink()
            temp_dir.rmdir()
        except Exception:
            pass
