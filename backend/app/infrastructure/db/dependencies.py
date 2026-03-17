from __future__ import annotations

from typing import AsyncGenerator

import asyncpg
from fastapi import Depends, Request

from app.core.database.connection import get_pool


async def get_conn(request: Request) -> AsyncGenerator[asyncpg.Connection, None]:
    """FastAPI dependency that yields a checked-out pool connection."""
    pool: asyncpg.Pool = get_pool()
    async with pool.acquire() as conn:
        yield conn
