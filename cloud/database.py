"""Async SQLAlchemy engine + session management for cloud mode."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

from .config import settings

Base = declarative_base()

_engine = None
_sessionmaker = None

# Schema changes for databases that already exist in production. Every one is
# additive and idempotent, so it is a no-op both on a database that already has
# it and on a fresh one create_all just built.
_ADDITIVE_STATEMENTS = (
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
    "marketing_opt_out BOOLEAN NOT NULL DEFAULT false",
    # create_all adds indexes only to tables it creates, so on any database
    # predating this one the magic-link per-IP rate limiter was sequentially
    # scanning a table that only grows — on every sign-in attempt. It used to
    # say "apply this by hand" in a comment in models.py, which is not a plan.
    "CREATE INDEX IF NOT EXISTS ix_magic_ip_created "
    "ON magic_link_tokens (request_ip, created_at)",
)


async def init_engine():
    """Create the async engine + sessionmaker and ensure the schema exists.

    Uses ``create_all`` for zero-friction boot (additive-only schema in v1).
    Alembic (see ``alembic/``) is available for controlled migrations later.
    """
    global _engine, _sessionmaker
    if _engine is not None:
        return
    # Import models so their tables register on Base.metadata before create_all.
    from . import models  # noqa: F401

    _engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)

    async with _engine.begin() as conn:
        # Case-insensitive email uniqueness.
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
        await conn.run_sync(Base.metadata.create_all)

    # Each in its own transaction, and each allowed to fail the boot.
    #
    # These used to run inside the create_all transaction with their errors
    # caught and printed — which did not do what it looks like: on Postgres the
    # first failure poisons the transaction, so every later statement failed
    # too and the whole batch was silently skipped. Booting anyway just moves
    # the failure to the first query against a column that isn't there, hours
    # later and somewhere less obvious. Keep them additive and idempotent, and
    # reach for Alembic the moment one of them isn't.
    for statement in _ADDITIVE_STATEMENTS:
        async with _engine.begin() as conn:
            await conn.execute(text(statement))


def get_sessionmaker():
    if _sessionmaker is None:
        raise RuntimeError("Cloud DB engine not initialized — call init_engine() first.")
    return _sessionmaker


def session():
    """Return a new AsyncSession context manager (for use outside FastAPI deps)."""
    return get_sessionmaker()()


async def get_db():
    """FastAPI dependency yielding an AsyncSession."""
    async with get_sessionmaker()() as s:
        yield s
