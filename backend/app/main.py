from fastapi import FastAPI
from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.payroll_mirror import router as payroll_mirror_router
from app.api.v1.routes.payroll_provisions import router as payroll_provisions_router

app = FastAPI(
    title="Payroll Accounting Mapper API",
    version="0.1.0",
    description="API for parsing payroll mirror spreadsheets and generating structured payroll data.",
)

app.include_router(health_router, prefix="/api/v1", tags=["Health"])
app.include_router(payroll_mirror_router, prefix="/api/v1", tags=["Payroll Mirror"])
app.include_router(
    payroll_provisions_router, prefix="/api/v1", tags=["Payroll Provisions"]
)
