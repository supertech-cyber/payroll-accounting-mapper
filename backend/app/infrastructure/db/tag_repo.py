from __future__ import annotations

import asyncpg

from app.domain.tag_registry.models import Tag


def _row_to_tag(row: asyncpg.Record) -> Tag:
    return Tag(
        id=row["id"],
        slug=row["slug"],
        label=row["label"],
        description=row["description"],
    )


class PgTagRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def list_all(self) -> list[Tag]:
        rows = await self._conn.fetch(
            "SELECT id, slug, label, description FROM tags ORDER BY slug"
        )
        return [_row_to_tag(r) for r in rows]

    async def get_by_id(self, tag_id: int) -> Tag | None:
        row = await self._conn.fetchrow(
            "SELECT id, slug, label, description FROM tags WHERE id = $1", tag_id
        )
        return _row_to_tag(row) if row else None

    async def create(
        self,
        slug: str,
        label: str,
        description: str | None = None,
    ) -> Tag:
        row = await self._conn.fetchrow(
            """
            INSERT INTO tags (slug, label, description)
            VALUES ($1, $2, $3)
            RETURNING id, slug, label, description
            """,
            slug,
            label,
            description,
        )
        return _row_to_tag(row)  # type: ignore[arg-type]

    async def update(
        self,
        tag_id: int,
        label: str | None = None,
        description: str | None = None,
    ) -> Tag | None:
        row = await self._conn.fetchrow(
            """
            UPDATE tags SET
                label       = COALESCE($2, label),
                description = COALESCE($3, description)
            WHERE id = $1
            RETURNING id, slug, label, description
            """,
            tag_id,
            label,
            description,
        )
        return _row_to_tag(row) if row else None

    async def delete(self, tag_id: int) -> bool:
        result = await self._conn.execute("DELETE FROM tags WHERE id = $1", tag_id)
        return result == "DELETE 1"
