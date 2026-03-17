from __future__ import annotations

import shutil
import tempfile
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.domain.payroll_provisions.service import (
    get_13th_provision_results,
    get_vacation_provision_results,
)
from app.schemas.payroll_provisions import (
    Parse13thProvisionResponse,
    ParseVacationProvisionResponse,
    ProvisionResultOut,
)

router = APIRouter()


def _validate_excel_pair(file_a: UploadFile, file_b: UploadFile) -> None:
    if not file_a.filename or not file_b.filename:
        raise HTTPException(
            status_code=400, detail="Envie os dois arquivos da provisão."
        )
    for f in (file_a, file_b):
        if Path(f.filename).suffix.lower() not in {".xlsx", ".xlsm"}:
            raise HTTPException(
                status_code=400, detail="Envie arquivos Excel válidos (.xlsx ou .xlsm)."
            )


@router.post(
    "/imports/payroll-provisions/13th/parse", response_model=Parse13thProvisionResponse
)
async def parse_13th_provision(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
) -> Parse13thProvisionResponse:
    _validate_excel_pair(file_a, file_b)

    temp_dir = Path(tempfile.mkdtemp(prefix="payroll_provision_13th_"))
    temp_a = temp_dir / f"a_{file_a.filename}"
    temp_b = temp_dir / f"b_{file_b.filename}"

    try:
        with temp_a.open("wb") as buf:
            shutil.copyfileobj(file_a.file, buf)
        with temp_b.open("wb") as buf:
            shutil.copyfileobj(file_b.file, buf)

        results = get_13th_provision_results(temp_a, temp_b)
        return Parse13thProvisionResponse(
            source_files=[file_a.filename, file_b.filename],
            provision_type="13th_salary",
            total_cost_centers=len(results),
            items=[ProvisionResultOut.model_validate(asdict(r)) for r in results],
        )

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Erro ao processar os arquivos: {exc}"
        ) from exc
    finally:
        try:
            if temp_a.exists():
                temp_a.unlink()
            if temp_b.exists():
                temp_b.unlink()
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
    _validate_excel_pair(file_a, file_b)

    temp_dir = Path(tempfile.mkdtemp(prefix="payroll_provision_vacation_"))
    temp_a = temp_dir / f"a_{file_a.filename}"
    temp_b = temp_dir / f"b_{file_b.filename}"

    try:
        with temp_a.open("wb") as buf:
            shutil.copyfileobj(file_a.file, buf)
        with temp_b.open("wb") as buf:
            shutil.copyfileobj(file_b.file, buf)

        results = get_vacation_provision_results(temp_a, temp_b)
        return ParseVacationProvisionResponse(
            source_files=[file_a.filename, file_b.filename],
            provision_type="vacation",
            total_cost_centers=len(results),
            items=[ProvisionResultOut.model_validate(asdict(r)) for r in results],
        )

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Erro ao processar os arquivos: {exc}"
        ) from exc
    finally:
        try:
            if temp_a.exists():
                temp_a.unlink()
            if temp_b.exists():
                temp_b.unlink()
            temp_dir.rmdir()
        except Exception:
            pass
