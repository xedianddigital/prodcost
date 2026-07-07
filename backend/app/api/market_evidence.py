import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.api.market_evidence_llm import QuoteExtraction, extract_quote
from app.persistence import atomic_write_json, locked_store

router = APIRouter(tags=["market evidence"])

BASKET_PATH = Path(__file__).resolve().parents[3] / "data" / "market_evidence_basket.json"


class RouteHourEntry(BaseModel):
    market_rate_class_id: str
    hours: float = Field(ge=0)


class BasketRowInput(BaseModel):
    source: Literal["pdf_extraction", "manual"]
    pdf_filename: str | None = None
    supplier: str | None = None
    quote_date: str | None = None
    currency: str | None = None
    part_name: str = Field(min_length=1)
    quantity: float | None = None
    unit_price_eur: float | None = None
    line_total_eur: float | None = None
    material_sell_eur: float | None = None
    route_hours: list[RouteHourEntry] = Field(default_factory=list)
    notes: str = ""


class BasketRow(BasketRowInput):
    id: str
    created_at: str
    updated_at: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_store() -> list[dict[str, Any]]:
    if not BASKET_PATH.exists():
        return []
    try:
        payload = json.loads(BASKET_PATH.read_text())
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Market evidence basket file contains invalid JSON") from exc
    if not isinstance(payload, list):
        raise HTTPException(status_code=500, detail="Market evidence basket file must contain a JSON array")
    return payload


def _write_store(rows: list[dict[str, Any]]) -> None:
    atomic_write_json(BASKET_PATH, rows)


@router.get("/market-evidence/basket-rows", response_model=list[BasketRow])
def list_basket_rows() -> list[dict[str, Any]]:
    return sorted(_read_store(), key=lambda item: item.get("updated_at", ""), reverse=True)


@router.post("/market-evidence/basket-rows", response_model=BasketRow)
def create_basket_row(payload: BasketRowInput) -> dict[str, Any]:
    with locked_store(BASKET_PATH):
        rows = _read_store()
        timestamp = _now()
        row = {
            "id": str(uuid4()),
            "created_at": timestamp,
            "updated_at": timestamp,
            **payload.model_dump(),
        }
        rows.append(row)
        _write_store(rows)
        return row


@router.put("/market-evidence/basket-rows/{row_id}", response_model=BasketRow)
def update_basket_row(row_id: str, payload: BasketRowInput) -> dict[str, Any]:
    with locked_store(BASKET_PATH):
        rows = _read_store()
        index = next((i for i, row in enumerate(rows) if row.get("id") == row_id), None)
        if index is None:
            raise HTTPException(status_code=404, detail="Basket row not found")
        existing = rows[index]
        row = {
            **existing,
            **payload.model_dump(),
            "id": existing["id"],
            "created_at": existing.get("created_at", _now()),
            "updated_at": _now(),
        }
        rows[index] = row
        _write_store(rows)
        return row


@router.delete("/market-evidence/basket-rows/{row_id}")
def delete_basket_row(row_id: str) -> dict[str, str]:
    with locked_store(BASKET_PATH):
        rows = _read_store()
        remaining = [row for row in rows if row.get("id") != row_id]
        if len(remaining) == len(rows):
            raise HTTPException(status_code=404, detail="Basket row not found")
        _write_store(remaining)
        return {"status": "deleted"}


@router.post("/market-evidence/extract-quote", response_model=QuoteExtraction)
async def extract_quote_pdf(file: UploadFile = File(...)) -> QuoteExtraction:
    if file.content_type not in ("application/pdf", "application/octet-stream", None):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF")
    pdf_bytes = await file.read()
    try:
        return extract_quote(pdf_bytes)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
