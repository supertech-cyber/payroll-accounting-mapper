from __future__ import annotations

from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor

from app.core.config.settings import settings


@contextmanager
def get_db_connection():
    connection = psycopg2.connect(settings.database_url)
    try:
        yield connection
    finally:
        connection.close()


@contextmanager
def get_db_cursor():
    with get_db_connection() as connection:
        cursor = connection.cursor(cursor_factory=RealDictCursor)
        try:
            yield cursor
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            cursor.close()
