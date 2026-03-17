from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.payroll_mirror import router as payroll_mirror_router
from app.api.v1.routes.payroll_provisions import router as payroll_provisions_router
from app.api.v1.routes.companies import router as companies_router
from app.api.v1.routes.cost_centers import router as cost_centers_router
from app.api.v1.routes.events import router as events_router
from app.api.v1.routes.fpa_export import router as fpa_export_router
from app.api.v1.routes.tags import router as tags_router
from app.core.database.connection import create_pool, close_pool
from app.core.config.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    await create_pool()
    yield
    await close_pool()


app = FastAPI(
    title="Payroll Accounting Mapper API",
    version="0.4.0",
    description="API for parsing payroll spreadsheets and resolving accounting mappings.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1", tags=["Health"])
app.include_router(payroll_mirror_router, prefix="/api/v1", tags=["Payroll Mirror"])
app.include_router(
    payroll_provisions_router, prefix="/api/v1", tags=["Payroll Provisions"]
)
app.include_router(companies_router, prefix="/api/v1", tags=["Companies"])
app.include_router(cost_centers_router, prefix="/api/v1", tags=["Cost Centers"])
app.include_router(events_router, prefix="/api/v1", tags=["Events"])
app.include_router(tags_router, prefix="/api/v1", tags=["Tags"])
app.include_router(fpa_export_router, prefix="/api/v1", tags=["Exports"])
