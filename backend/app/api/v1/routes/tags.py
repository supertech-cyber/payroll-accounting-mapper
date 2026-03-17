from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, status
import asyncpg

from app.infrastructure.db.dependencies import get_conn
from app.infrastructure.db.tag_repo import PgTagRepository
from app.schemas.tag_registry import TagCreate, TagOut, TagUpdate

router = APIRouter(prefix="/tags")


@router.get("/", response_model=list[TagOut], summary="Listar tags")
async def list_tags(conn: asyncpg.Connection = Depends(get_conn)):
    repo = PgTagRepository(conn)
    tags = await repo.list_all()
    return [TagOut(**asdict(t)) for t in tags]


@router.get("/{tag_id}", response_model=TagOut, summary="Buscar tag por ID")
async def get_tag(tag_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    repo = PgTagRepository(conn)
    tag = await repo.get_by_id(tag_id)
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag não encontrada."
        )
    return TagOut(**asdict(tag))


@router.post(
    "/",
    response_model=TagOut,
    status_code=status.HTTP_201_CREATED,
    summary="Criar tag",
)
async def create_tag(body: TagCreate, conn: asyncpg.Connection = Depends(get_conn)):
    repo = PgTagRepository(conn)
    try:
        tag = await repo.create(
            slug=body.slug.lower().strip(),
            label=body.label.strip(),
            description=body.description,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tag com slug '{body.slug}' já existe.",
        )
    return TagOut(**asdict(tag))


@router.patch("/{tag_id}", response_model=TagOut, summary="Atualizar tag")
async def update_tag(
    tag_id: int,
    body: TagUpdate,
    conn: asyncpg.Connection = Depends(get_conn),
):
    repo = PgTagRepository(conn)
    tag = await repo.update(
        tag_id=tag_id,
        label=body.label,
        description=body.description,
    )
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag não encontrada."
        )
    return TagOut(**asdict(tag))


@router.delete(
    "/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover tag",
)
async def delete_tag(tag_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    repo = PgTagRepository(conn)
    deleted = await repo.delete(tag_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tag não encontrada."
        )
