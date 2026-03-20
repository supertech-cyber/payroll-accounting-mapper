from __future__ import annotations

import asyncpg

from app.domain.event_registry.models import Event, EventMapping, EventWithMappings
from app.domain.event_registry.repository import EventMappingRepository, EventRepository


def _row_to_event(row: asyncpg.Record) -> Event:
    return Event(
        id=row["id"],
        code=row["code"],
        description=row["description"],
        entry_type=row["entry_type"],
        is_active=row["is_active"],
    )


def _row_to_mapping(row: asyncpg.Record) -> EventMapping:
    return EventMapping(
        id=row["id"],
        event_id=row["event_id"],
        cost_center_id=row["cost_center_id"],
        credit_account=row["credit_account"],
        debit_account=row["debit_account"],
    )


class PgEventRepository(EventRepository):
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def list_all(self, include_inactive: bool = False) -> list[Event]:
        if include_inactive:
            rows = await self._conn.fetch(
                "SELECT id, code, description, entry_type, is_active "
                "FROM events ORDER BY code"
            )
        else:
            rows = await self._conn.fetch(
                "SELECT id, code, description, entry_type, is_active "
                "FROM events WHERE is_active = TRUE ORDER BY code"
            )
        return [_row_to_event(r) for r in rows]

    async def get_by_id(self, event_id: int) -> Event | None:
        row = await self._conn.fetchrow(
            "SELECT id, code, description, entry_type, is_active "
            "FROM events WHERE id = $1",
            event_id,
        )
        return _row_to_event(row) if row else None

    async def get_by_code(self, code: str) -> Event | None:
        row = await self._conn.fetchrow(
            "SELECT id, code, description, entry_type, is_active "
            "FROM events WHERE code = $1",
            code,
        )
        return _row_to_event(row) if row else None

    async def create(self, code: str, description: str, entry_type: str) -> Event:
        row = await self._conn.fetchrow(
            """
            INSERT INTO events (code, description, entry_type)
            VALUES ($1, $2, $3)
            RETURNING id, code, description, entry_type, is_active
            """,
            code,
            description,
            entry_type,
        )
        return _row_to_event(row)  # type: ignore[arg-type]

    async def update(
        self,
        event_id: int,
        description: str | None = None,
        entry_type: str | None = None,
        is_active: bool | None = None,
    ) -> Event | None:
        row = await self._conn.fetchrow(
            """
            UPDATE events
            SET
                description = COALESCE($2, description),
                entry_type  = COALESCE($3, entry_type),
                is_active   = COALESCE($4, is_active)
            WHERE id = $1
            RETURNING id, code, description, entry_type, is_active
            """,
            event_id,
            description,
            entry_type,
            is_active,
        )
        return _row_to_event(row) if row else None

    async def delete(self, event_id: int) -> bool:
        result = await self._conn.execute("DELETE FROM events WHERE id = $1", event_id)
        return result == "DELETE 1"


class PgEventMappingRepository(EventMappingRepository):
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def list_for_event(self, event_id: int) -> list[EventMapping]:
        rows = await self._conn.fetch(
            "SELECT id, event_id, cost_center_id, credit_account, debit_account "
            "FROM event_mappings WHERE event_id = $1 ORDER BY cost_center_id NULLS FIRST",
            event_id,
        )
        return [_row_to_mapping(r) for r in rows]

    async def get_with_mappings(self, event_id: int) -> EventWithMappings | None:
        event_row = await self._conn.fetchrow(
            "SELECT id, code, description, entry_type, is_active "
            "FROM events WHERE id = $1",
            event_id,
        )
        if not event_row:
            return None
        event = _row_to_event(event_row)
        mappings = await self.list_for_event(event_id)
        return EventWithMappings(event=event, mappings=mappings)

    async def upsert(
        self,
        event_id: int,
        cost_center_id: int | None,
        credit_account: str | None,
        debit_account: str | None,
    ) -> EventMapping:
        row = await self._conn.fetchrow(
            """
            INSERT INTO event_mappings (event_id, cost_center_id, credit_account, debit_account)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (event_id, cost_center_id)
            DO UPDATE SET
                credit_account = EXCLUDED.credit_account,
                debit_account  = EXCLUDED.debit_account
            RETURNING id, event_id, cost_center_id, credit_account, debit_account
            """,
            event_id,
            cost_center_id,
            credit_account,
            debit_account,
        )
        return _row_to_mapping(row)  # type: ignore[arg-type]

    async def update_by_id(
        self,
        mapping_id: int,
        credit_account: str | None = None,
        debit_account: str | None = None,
    ) -> EventMapping | None:
        row = await self._conn.fetchrow(
            """
            UPDATE event_mappings
            SET
                credit_account = COALESCE($2, credit_account),
                debit_account  = COALESCE($3, debit_account)
            WHERE id = $1
            RETURNING id, event_id, cost_center_id, credit_account, debit_account
            """,
            mapping_id,
            credit_account,
            debit_account,
        )
        return _row_to_mapping(row) if row else None

    async def delete(self, mapping_id: int) -> bool:
        result = await self._conn.execute(
            "DELETE FROM event_mappings WHERE id = $1", mapping_id
        )
        return result == "DELETE 1"

    async def resolve(
        self,
        event_code: str,
        cost_center_code: str | None,
        company_code: str | None = None,
    ) -> EventMapping | None:
        """
        Best-match lookup (in priority order):
          1. exact (event_code, cc_code, company_code) — company-specific mapping
          2. exact (event_code, cc_code) any company — fallback for shared CCs
          3. default mapping (cost_center_id IS NULL)
        """
        if cost_center_code is not None:
            if company_code is not None:
                # Priority 1 — prefer the CC that belongs to this company
                row = await self._conn.fetchrow(
                    """
                    SELECT em.id, em.event_id, em.cost_center_id,
                           em.credit_account, em.debit_account
                    FROM event_mappings em
                    JOIN events e ON e.id = em.event_id
                    JOIN cost_centers cc ON cc.id = em.cost_center_id
                    JOIN companies c ON c.id = cc.company_id
                    WHERE e.code = $1 AND cc.code = $2 AND c.code = $3
                    LIMIT 1
                    """,
                    event_code,
                    cost_center_code,
                    company_code,
                )
                if row:
                    return _row_to_mapping(row)

            # Priority 2 — same group (tag), any company in the group
            # Handles multi-company groups that share a single set of CCs.
            if company_code is not None:
                row = await self._conn.fetchrow(
                    """
                    SELECT em.id, em.event_id, em.cost_center_id,
                           em.credit_account, em.debit_account
                    FROM event_mappings em
                    JOIN events e ON e.id = em.event_id
                    JOIN cost_centers cc ON cc.id = em.cost_center_id
                    JOIN companies c ON c.id = cc.company_id
                    WHERE e.code = $1
                      AND cc.code = $2
                      AND c.tag = (SELECT tag FROM companies WHERE code = $3)
                    LIMIT 1
                    """,
                    event_code,
                    cost_center_code,
                    company_code,
                )
                if row:
                    return _row_to_mapping(row)

            # Priority 3 — any CC with matching code (legacy / no company context)
            row = await self._conn.fetchrow(
                """
                SELECT em.id, em.event_id, em.cost_center_id,
                       em.credit_account, em.debit_account
                FROM event_mappings em
                JOIN events e ON e.id = em.event_id
                JOIN cost_centers cc ON cc.id = em.cost_center_id
                WHERE e.code = $1 AND cc.code = $2
                LIMIT 1
                """,
                event_code,
                cost_center_code,
            )
            if row:
                return _row_to_mapping(row)

        # Fall back to default (NULL cost_center_id)
        row = await self._conn.fetchrow(
            """
            SELECT em.id, em.event_id, em.cost_center_id,
                   em.credit_account, em.debit_account
            FROM event_mappings em
            JOIN events e ON e.id = em.event_id
            WHERE e.code = $1 AND em.cost_center_id IS NULL
            LIMIT 1
            """,
            event_code,
        )
        return _row_to_mapping(row) if row else None
