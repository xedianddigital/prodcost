from fastapi import FastAPI

from app.api.assumptions import router as assumptions_router
from app.api.company_profiles import router as company_profiles_router
from app.api.erp import router as erp_router
from app.api.market_evidence import router as market_evidence_router
from app.api.quote_drafts import router as quote_drafts_router
from app.api.quotes import router as quotes_router
from app.api.step_geometry import router as step_geometry_router

app = FastAPI(title="ProdCost API", version="0.1.0")

app.include_router(assumptions_router, prefix="/api")
app.include_router(company_profiles_router, prefix="/api")
app.include_router(quotes_router, prefix="/api")
app.include_router(quote_drafts_router, prefix="/api")
app.include_router(erp_router, prefix="/api")
app.include_router(market_evidence_router, prefix="/api")
app.include_router(step_geometry_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

