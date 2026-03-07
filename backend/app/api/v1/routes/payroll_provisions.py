from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.domain.payroll_provisions.service import (
    build_13th_provision_payload,
    build_vacation_provision_payload,
)
from app.schemas.payroll_provisions import (
    Parse13thProvisionResponse,
    ParseVacationProvisionResponse,
)

router = APIRouter()


def validate_excel_upload(file_a: UploadFile, file_b: UploadFile) -> tuple[str, str]:
    if not file_a.filename or not file_b.filename:
        raise HTTPException(
            status_code=400, detail="Envie os dois arquivos da provisão."
        )

    suffix_a = Path(file_a.filename).suffix.lower()
    suffix_b = Path(file_b.filename).suffix.lower()

    if suffix_a not in {".xlsx", ".xlsm"} or suffix_b not in {".xlsx", ".xlsm"}:
        raise HTTPException(
            status_code=400, detail="Envie arquivos Excel válidos (.xlsx ou .xlsm)."
        )

    return file_a.filename, file_b.filename


@router.post(
    "/imports/payroll-provisions/13th/parse", response_model=Parse13thProvisionResponse
)
async def parse_13th_provision(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
) -> Parse13thProvisionResponse:
    validate_excel_upload(file_a, file_b)

    temp_dir = Path(tempfile.mkdtemp(prefix="payroll_provision_13th_"))
    temp_file_a = temp_dir / f"a_{file_a.filename}"
    temp_file_b = temp_dir / f"b_{file_b.filename}"

    try:
        with temp_file_a.open("wb") as buffer:
            shutil.copyfileobj(file_a.file, buffer)

        with temp_file_b.open("wb") as buffer:
            shutil.copyfileobj(file_b.file, buffer)

        payload = build_13th_provision_payload(
            previous_or_current_file_a=temp_file_a,
            previous_or_current_file_b=temp_file_b,
            source_filename_a=file_a.filename,
            source_filename_b=file_b.filename,
        )
        return Parse13thProvisionResponse(**payload)

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Erro ao processar os arquivos: {exc}"
        ) from exc
    finally:
        try:
            if temp_file_a.exists():
                temp_file_a.unlink()
            if temp_file_b.exists():
                temp_file_b.unlink()
            temp_dir.rmdir()
        except Exception:
            pass


@router.post(
    "/imports/payroll-provisions/vacation/parse",
    response_model=ParseVacationProvisionResponse,
)
async def parse_vacation_provision(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
) -> ParseVacationProvisionResponse:
    validate_excel_upload(file_a, file_b)

    temp_dir = Path(tempfile.mkdtemp(prefix="payroll_provision_vacation_"))
    temp_file_a = temp_dir / f"a_{file_a.filename}"
    temp_file_b = temp_dir / f"b_{file_b.filename}"

    try:
        with temp_file_a.open("wb") as buffer:
            shutil.copyfileobj(file_a.file, buffer)

        with temp_file_b.open("wb") as buffer:
            shutil.copyfileobj(file_b.file, buffer)

        payload = build_vacation_provision_payload(
            previous_or_current_file_a=temp_file_a,
            previous_or_current_file_b=temp_file_b,
            source_filename_a=file_a.filename,
            source_filename_b=file_b.filename,
        )
        return ParseVacationProvisionResponse(**payload)

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Erro ao processar os arquivos: {exc}"
        ) from exc
    finally:
        try:
            if temp_file_a.exists():
                temp_file_a.unlink()
            if temp_file_b.exists():
                temp_file_b.unlink()
            temp_dir.rmdir()
        except Exception:
            pass
