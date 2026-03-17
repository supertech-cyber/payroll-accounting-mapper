from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
import asyncpg

from app.infrastructure.db.dependencies import get_conn
from app.infrastructure.db.event_repo import PgEventMappingRepository, PgEventRepository
from app.schemas.event_registry import (
    EventCreate,
    EventEnsure,
    EventMappingOut,
    EventMappingUpsert,
    EventOut,
    EventUpdate,
    EventWithAllMappingsOut,
    EventWithMappingsOut,
)

router = APIRouter(prefix="/events")


# ── Events ────────────────────────────────────────────────────────────────────


@router.get("/", response_model=list[EventOut], summary="Listar eventos cadastrados")
async def list_events(
    include_inactive: bool = Query(False, description="Incluir eventos desativados"),
    conn: asyncpg.Connection = Depends(get_conn),
):
    repo = PgEventRepository(conn)
    events = await repo.list_all(include_inactive=include_inactive)
    return [EventOut(**asdict(e)) for e in events]


@router.get(
    "/with-all-mappings",
    response_model=list[EventWithAllMappingsOut],
    summary="Listar todos os eventos com todos os mapeamentos (bulk, para árvore)",
)
async def list_events_with_all_mappings(
    include_inactive: bool = Query(True),
    conn: asyncpg.Connection = Depends(get_conn),
):
    where_clause = "" if include_inactive else "WHERE e.is_active = TRUE"
    rows = await conn.fetch(
        f"""
        SELECT e.id, e.code, e.description, e.entry_type, e.is_active,
               em.id          AS mapping_id,
               em.cost_center_id,
               em.credit_account,
               em.debit_account
        FROM events e
        LEFT JOIN event_mappings em ON em.event_id = e.id
        {where_clause}
        ORDER BY e.code, em.cost_center_id NULLS FIRST
        """
    )
    events: dict[int, dict] = {}
    for row in rows:
        eid = row["id"]
        if eid not in events:
            events[eid] = {
                "id": eid,
                "code": row["code"],
                "description": row["description"],
                "entry_type": row["entry_type"],
                "is_active": row["is_active"],
                "mappings": [],
            }
        if row["mapping_id"] is not None:
            events[eid]["mappings"].append(
                {
                    "id": row["mapping_id"],
                    "event_id": eid,
                    "cost_center_id": row["cost_center_id"],
                    "credit_account": row["credit_account"],
                    "debit_account": row["debit_account"],
                }
            )
    return [EventWithAllMappingsOut(**e) for e in events.values()]


@router.post(
    "/ensure",
    response_model=EventOut,
    summary="Garantir existência de evento — retorna o existente ou cria novo",
)
async def ensure_event(
    body: EventEnsure,
    conn: asyncpg.Connection = Depends(get_conn),
):
    """
    Idempotent: if an event with the given code already exists, return it.
    Otherwise create it and return the new record.
    Useful when processing payroll files with events not yet in the registry.
    """
    repo = PgEventRepository(conn)
    event = await repo.get_by_code(body.code)
    if not event:
        event = await repo.create(
            code=body.code,
            description=body.description,
            entry_type=body.entry_type,
        )
    return EventOut(**asdict(event))


@router.get(
    "/{event_id}",
    response_model=EventWithMappingsOut,
    summary="Buscar evento com mapeamentos",
)
async def get_event(event_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    mapping_repo = PgEventMappingRepository(conn)
    result = await mapping_repo.get_with_mappings(event_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado."
        )
    return EventWithMappingsOut(
        event=EventOut(**asdict(result.event)),
        mappings=[EventMappingOut(**asdict(m)) for m in result.mappings],
    )


@router.post(
    "/",
    response_model=EventOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar evento",
)
async def create_event(body: EventCreate, conn: asyncpg.Connection = Depends(get_conn)):
    repo = PgEventRepository(conn)
    try:
        event = await repo.create(
            code=body.code,
            description=body.description,
            entry_type=body.entry_type,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Evento com código '{body.code}' já existe.",
        )
    return EventOut(**asdict(event))


@router.patch("/{event_id}", response_model=EventOut, summary="Atualizar evento")
async def update_event(
    event_id: int,
    body: EventUpdate,
    conn: asyncpg.Connection = Depends(get_conn),
):
    repo = PgEventRepository(conn)
    event = await repo.update(
        event_id=event_id,
        description=body.description,
        entry_type=body.entry_type,
        is_active=body.is_active,
    )
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado."
        )
    return EventOut(**asdict(event))


@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover evento",
)
async def delete_event(event_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    repo = PgEventRepository(conn)
    deleted = await repo.delete(event_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado."
        )


# ── Event Mappings ────────────────────────────────────────────────────────────


@router.put(
    "/{event_id}/mappings",
    response_model=EventMappingOut,
    summary="Criar ou atualizar mapeamento contábil de evento",
)
async def upsert_event_mapping(
    event_id: int,
    body: EventMappingUpsert,
    conn: asyncpg.Connection = Depends(get_conn),
):
    # Ensure event exists
    event_repo = PgEventRepository(conn)
    event = await event_repo.get_by_id(event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado."
        )

    mapping_repo = PgEventMappingRepository(conn)
    mapping = await mapping_repo.upsert(
        event_id=event_id,
        cost_center_id=body.cost_center_id,
        credit_account=body.credit_account,
        debit_account=body.debit_account,
    )
    return EventMappingOut(**asdict(mapping))


@router.patch(
    "/mappings/{mapping_id}",
    response_model=EventMappingOut,
    summary="Atualizar mapeamento contábil",
)
async def update_mapping(
    mapping_id: int,
    body: EventMappingUpsert,
    conn: asyncpg.Connection = Depends(get_conn),
):
    mapping_repo = PgEventMappingRepository(conn)
    mapping = await mapping_repo.update_by_id(
        mapping_id=mapping_id,
        credit_account=body.credit_account,
        debit_account=body.debit_account,
    )
    if not mapping:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Mapeamento não encontrado."
        )
    return EventMappingOut(**asdict(mapping))


@router.delete(
    "/mappings/{mapping_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remover mapeamento contábil",
)
async def delete_mapping(mapping_id: int, conn: asyncpg.Connection = Depends(get_conn)):
    mapping_repo = PgEventMappingRepository(conn)
    deleted = await mapping_repo.delete(mapping_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Mapeamento não encontrado."
        )
