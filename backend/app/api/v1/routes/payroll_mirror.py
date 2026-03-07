from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.domain.payroll_mirror.service import build_payroll_mirror_payload
from app.schemas.payroll_mirror import ParsePayrollMirrorResponse

router = APIRouter()


@router.post("/imports/payroll-mirror/parse", response_model=ParsePayrollMirrorResponse)
async def parse_payroll_mirror(
    file: UploadFile = File(...),
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

        payload = build_payroll_mirror_payload(
            file_path=temp_file,
            source_filename=file.filename,
        )
        return ParsePayrollMirrorResponse(**payload)

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
