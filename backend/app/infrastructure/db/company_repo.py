from __future__ import annotations

import asyncpg

from app.domain.company_registry.models import Company
from app.domain.company_registry.repository import CompanyRepository


def _row_to_company(row: asyncpg.Record) -> Company:
    return Company(
        id=row["id"],
        code=row["code"],
        name=row["name"],
        cnpj=row["cnpj"],
        cnpj_base=row["cnpj_base"],
        output_template=row["output_template"],
        fpa_batch=row["fpa_batch"],
        tag=row["tag"],
    )


class PgCompanyRepository(CompanyRepository):
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def list_all(self) -> list[Company]:
        rows = await self._conn.fetch(
            "SELECT id, code, name, cnpj, cnpj_base, output_template, fpa_batch, tag FROM companies ORDER BY name"
        )
        return [_row_to_company(r) for r in rows]

    async def get_by_id(self, company_id: int) -> Company | None:
        row = await self._conn.fetchrow(
            "SELECT id, code, name, cnpj, cnpj_base, output_template, fpa_batch, tag FROM companies WHERE id = $1",
            company_id,
        )
        return _row_to_company(row) if row else None

    async def get_by_code(self, code: str) -> Company | None:
        row = await self._conn.fetchrow(
            "SELECT id, code, name, cnpj, cnpj_base, output_template, fpa_batch, tag FROM companies WHERE code = $1",
            code,
        )
        return _row_to_company(row) if row else None

    async def create(
        self,
        code: str,
        name: str,
        cnpj: str | None = None,
        cnpj_base: str | None = None,
        output_template: str | None = None,
        fpa_batch: int | None = None,
        tag: str | None = None,
    ) -> Company:
        row = await self._conn.fetchrow(
            """
            INSERT INTO companies (code, name, cnpj, cnpj_base, output_template, fpa_batch, tag)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, code, name, cnpj, cnpj_base, output_template, fpa_batch, tag
            """,
            code,
            name,
            cnpj,
            cnpj_base,
            output_template,
            fpa_batch,
            tag,
        )
        return _row_to_company(row)  # type: ignore[arg-type]

    async def update(
        self,
        company_id: int,
        name: str | None = None,
        cnpj: str | None = None,
        cnpj_base: str | None = None,
        output_template: str | None = None,
        fpa_batch: int | None = None,
        tag: str | None = None,
    ) -> Company | None:
        row = await self._conn.fetchrow(
            """
            UPDATE companies
            SET
                name            = COALESCE($2, name),
                cnpj            = COALESCE($3, cnpj),
                cnpj_base       = COALESCE($4, cnpj_base),
                output_template = COALESCE($5, output_template),
                fpa_batch       = COALESCE($6, fpa_batch),
                tag             = COALESCE($7, tag)
            WHERE id = $1
            RETURNING id, code, name, cnpj, cnpj_base, output_template, fpa_batch, tag
            """,
            company_id,
            name,
            cnpj,
            cnpj_base,
            output_template,
            fpa_batch,
            tag,
        )
        return _row_to_company(row) if row else None

    async def delete(self, company_id: int) -> bool:
        result = await self._conn.execute(
            "DELETE FROM companies WHERE id = $1", company_id
        )
        return result == "DELETE 1"
