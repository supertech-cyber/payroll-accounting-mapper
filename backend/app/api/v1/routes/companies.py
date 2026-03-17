from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status
import asyncpg

from app.infrastructure.db.dependencies import get_conn
from app.infrastructure.db.company_repo import PgCompanyRepository
from app.schemas.company_registry import CompanyCreate, CompanyOut, CompanyUpdate

router = APIRouter(prefix="/companies")


@router.get("/", response_model=list[CompanyOut], summary="Listar empresas")
async def list_companies(conn: asyncpg.Connection = Depends(get_conn)):
    repo = PgCompanyRepository(conn)
    companies = await repo.list_all()
    return [CompanyOut(**asdict(c)) for c in companies]


@router.get("/{company_id}", response_model=CompanyOut, summary="Buscar empresa por ID")
async def get_company(company_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    repo = PgCompanyRepository(conn)
    company = await repo.get_by_id(company_id)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada."
        )
    return CompanyOut(**asdict(company))


@router.post(
    "/",
    response_model=CompanyOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar empresa",
)
async def create_company(
    body: CompanyCreate, conn: asyncpg.Connection = Depends(get_conn)
):
    repo = PgCompanyRepository(conn)
    try:
        company = await repo.create(
            code=body.code,
            name=body.name,
            cnpj=body.cnpj,
            cnpj_base=body.cnpj_base,
            output_template=body.output_template,
            fpa_batch=body.fpa_batch,
            tag=body.tag,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Empresa com código '{body.code}' já existe.",
        )
    return CompanyOut(**asdict(company))


@router.patch("/{company_id}", response_model=CompanyOut, summary="Atualizar empresa")
async def update_company(
    company_id: int,
    body: CompanyUpdate,
    conn: asyncpg.Connection = Depends(get_conn),
):
    repo = PgCompanyRepository(conn)
    company = await repo.update(
        company_id=company_id,
        name=body.name,
        cnpj=body.cnpj,
        cnpj_base=body.cnpj_base,
        output_template=body.output_template,
        fpa_batch=body.fpa_batch,
        tag=body.tag,
    )
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada."
        )
    return CompanyOut(**asdict(company))


@router.delete(
    "/{company_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover empresa",
)
async def delete_company(company_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    repo = PgCompanyRepository(conn)
    deleted = await repo.delete(company_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada."
        )
