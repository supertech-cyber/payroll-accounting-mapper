from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes.health import router as health_router
from app.api.v1.routes.payroll_mirror import router as payroll_mirror_router
from app.api.v1.routes.payroll_provisions import router as payroll_provisions_router
from app.api.v1.routes.payroll_mapping import router as payroll_mapping_router

app = FastAPI(
    title="Payroll Accounting Mapper API",
    version="0.2.0",
    description="API for parsing payroll mirror and payroll provision spreadsheets.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1", tags=["Health"])
app.include_router(payroll_mirror_router, prefix="/api/v1", tags=["Payroll Mirror"])
app.include_router(
    payroll_provisions_router, prefix="/api/v1", tags=["Payroll Provisions"]
)
app.include_router(payroll_mapping_router, prefix="/api/v1", tags=["Payroll Mapping"])
