from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
import asyncpg

from app.infrastructure.db.dependencies import get_conn
from app.infrastructure.db.cost_center_repo import PgCostCenterRepository
from app.schemas.cost_center_registry import (
    CostCenterCreate,
    CostCenterOut,
    CostCenterUpdate,
)

router = APIRouter(prefix="/cost-centers")


@router.get("/", response_model=list[CostCenterOut], summary="Listar centros de custo")
async def list_cost_centers(
    company_id: int | None = Query(None, description="Filtrar por empresa"),
    conn: asyncpg.Connection = Depends(get_conn),
):
    repo = PgCostCenterRepository(conn)
    items = await repo.list_all(company_id=company_id)
    return [CostCenterOut(**asdict(cc)) for cc in items]


@router.get(
    "/{cc_id}", response_model=CostCenterOut, summary="Buscar centro de custo por ID"
)
async def get_cost_center(cc_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    repo = PgCostCenterRepository(conn)
    cc = await repo.get_by_id(cc_id)
    if not cc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Centro de custo não encontrado.",
        )
    return CostCenterOut(**asdict(cc))


@router.post(
    "/",
    response_model=CostCenterOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar centro de custo",
)
async def create_cost_center(
    body: CostCenterCreate, conn: asyncpg.Connection = Depends(get_conn)
):
    repo = PgCostCenterRepository(conn)
    try:
        cc = await repo.create(
            code=body.code,
            name=body.name,
            company_id=body.company_id,
            target_cost_center_id=body.target_cost_center_id,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Centro de custo com código '{body.code}' já existe para esta empresa.",
        )
    return CostCenterOut(**asdict(cc))


@router.patch(
    "/{cc_id}", response_model=CostCenterOut, summary="Atualizar centro de custo"
)
async def update_cost_center(
    cc_id: int,
    body: CostCenterUpdate,
    conn: asyncpg.Connection = Depends(get_conn),
):
    repo = PgCostCenterRepository(conn)
    cc = await repo.update(
        cc_id=cc_id,
        name=body.name,
        company_id=body.company_id,
        target_cost_center_id=body.target_cost_center_id,
    )
    if not cc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Centro de custo não encontrado.",
        )
    return CostCenterOut(**asdict(cc))


@router.delete(
    "/{cc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover centro de custo",
)
async def delete_cost_center(cc_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    repo = PgCostCenterRepository(conn)
    deleted = await repo.delete(cc_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Centro de custo não encontrado.",
        )
