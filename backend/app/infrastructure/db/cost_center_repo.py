from __future__ import annotations

import asyncpg

from app.domain.cost_center_registry.models import CostCenter
from app.domain.cost_center_registry.repository import CostCenterRepository


def _row_to_cc(row: asyncpg.Record) -> CostCenter:
    return CostCenter(
        id=row["id"],
        code=row["code"],
        name=row["name"],
        company_id=row["company_id"],
        target_cost_center_id=row["target_cost_center_id"],
    )


class PgCostCenterRepository(CostCenterRepository):
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def list_all(self, company_id: int | None = None) -> list[CostCenter]:
        if company_id is not None:
            rows = await self._conn.fetch(
                "SELECT id, code, name, company_id, target_cost_center_id FROM cost_centers "
                "WHERE company_id = $1 ORDER BY code",
                company_id,
            )
        else:
            rows = await self._conn.fetch(
                "SELECT id, code, name, company_id, target_cost_center_id FROM cost_centers ORDER BY code"
            )
        return [_row_to_cc(r) for r in rows]

    async def get_by_id(self, cc_id: int) -> CostCenter | None:
        row = await self._conn.fetchrow(
            "SELECT id, code, name, company_id, target_cost_center_id FROM cost_centers WHERE id = $1",
            cc_id,
        )
        return _row_to_cc(row) if row else None

    async def get_by_code(
        self, code: str, company_id: int | None = None
    ) -> CostCenter | None:
        if company_id is not None:
            row = await self._conn.fetchrow(
                "SELECT id, code, name, company_id, target_cost_center_id FROM cost_centers "
                "WHERE code = $1 AND company_id = $2",
                code,
                company_id,
            )
        else:
            row = await self._conn.fetchrow(
                "SELECT id, code, name, company_id, target_cost_center_id FROM cost_centers "
                "WHERE code = $1 AND company_id IS NULL",
                code,
            )
        return _row_to_cc(row) if row else None

    async def create(
        self,
        code: str,
        name: str,
        company_id: int | None = None,
        target_cost_center_id: int | None = None,
    ) -> CostCenter:
        row = await self._conn.fetchrow(
            """
            INSERT INTO cost_centers (code, name, company_id, target_cost_center_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, code, name, company_id, target_cost_center_id
            """,
            code,
            name,
            company_id,
            target_cost_center_id,
        )
        return _row_to_cc(row)  # type: ignore[arg-type]

    async def update(
        self,
        cc_id: int,
        name: str | None = None,
        company_id: int | None = None,
        target_cost_center_id: int | None = None,
    ) -> CostCenter | None:
        row = await self._conn.fetchrow(
            """
            UPDATE cost_centers
            SET
                name                  = COALESCE($2, name),
                company_id            = COALESCE($3, company_id),
                target_cost_center_id = $4
            WHERE id = $1
            RETURNING id, code, name, company_id, target_cost_center_id
            """,
            cc_id,
            name,
            company_id,
            target_cost_center_id,
        )
        return _row_to_cc(row) if row else None

    async def delete(self, cc_id: int) -> bool:
        result = await self._conn.execute(
            "DELETE FROM cost_centers WHERE id = $1", cc_id
        )
        return result == "DELETE 1"
