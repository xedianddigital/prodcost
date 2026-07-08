import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.persistence import atomic_write_json, locked_store

router = APIRouter(tags=["erp mock"])

MOCK_ERP_PATH = Path(__file__).resolve().parents[3] / "data" / "mock_erp"
CUSTOMER_OFFER_PAYLOADS_PATH = MOCK_ERP_PATH / "customer_offer_payloads.json"


class ErpCustomerOfferInput(BaseModel):
    quote_number: str = Field(min_length=1)
    customer_id: str | None = None
    customer_name: str
    rfq_reference: str
    part_name: str
    quantity: int = Field(gt=0)
    target_sell_price_eur: float = Field(ge=0)
    target_unit_sell_price_eur: float = Field(ge=0)
    accounting_sell_price_eur: float | None = Field(default=None, ge=0)
    accounting_unit_sell_price_eur: float | None = Field(default=None, ge=0)
    material_sell_eur: float | None = Field(default=None, ge=0)
    material_unit_sell_eur: float | None = Field(default=None, ge=0)
    material_unit_cost_eur: float | None = Field(default=None, ge=0)
    currency: str = "EUR"
    validity_date: str | None = None
    delivery_estimate: str | None = None
    payment_terms: str | None = None
    quantity_breaks: list[dict[str, Any]] = Field(default_factory=list)
    source_quote_state: dict[str, Any] = Field(default_factory=dict)


def _read_json(filename: str) -> Any:
    path = MOCK_ERP_PATH / filename
    if not path.exists():
        raise HTTPException(status_code=500, detail=f"Mock ERP file missing: {filename}")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Mock ERP file invalid: {filename}") from exc


def _write_offer_payloads(payloads: list[dict[str, Any]]) -> None:
    atomic_write_json(CUSTOMER_OFFER_PAYLOADS_PATH, payloads)


def _read_offer_payloads() -> list[dict[str, Any]]:
    if not CUSTOMER_OFFER_PAYLOADS_PATH.exists():
        return []
    payload = json.loads(CUSTOMER_OFFER_PAYLOADS_PATH.read_text())
    if not isinstance(payload, list):
        raise HTTPException(status_code=500, detail="Customer offer payload store must be a JSON array")
    return payload


def _find_by_id(items: list[dict[str, Any]], item_id: str, label: str) -> dict[str, Any]:
    match = next((item for item in items if item.get("id") == item_id), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return match


@router.get("/erp/parts")
def list_erp_parts() -> list[dict[str, Any]]:
    parts = _read_json("parts.json")
    customers = {item["id"]: item for item in _read_json("customers.json")}
    routes = _read_json("routes.json")
    bom = _read_json("bom.json")

    return [
        {
            **part,
            "customer_name": customers.get(part.get("customer_id"), {}).get("name", "Unknown customer"),
            "operation_count": len([item for item in routes if item.get("part_id") == part.get("id")]),
            "bom_count": len([item for item in bom if item.get("part_id") == part.get("id")]),
        }
        for part in parts
    ]


@router.get("/erp/parts/{part_id}")
def get_erp_part(part_id: str) -> dict[str, Any]:
    parts = _read_json("parts.json")
    customers = _read_json("customers.json")
    part = _find_by_id(parts, part_id, "ERP part")
    customer = _find_by_id(customers, part["customer_id"], "ERP customer")
    return {
        "part": part,
        "customer": customer,
        "bom": [item for item in _read_json("bom.json") if item.get("part_id") == part_id],
        "route": [item for item in _read_json("routes.json") if item.get("part_id") == part_id],
        "materials": _read_json("materials.json"),
        "stock": _read_json("stock.json"),
        "machines": _read_json("machines.json"),
        "labor_finance": _read_json("labor_finance.json"),
    }


@router.post("/erp/import-rfq")
def import_erp_rfq(payload: dict[str, str]) -> dict[str, Any]:
    part_id = payload.get("part_id")
    if not part_id:
        raise HTTPException(status_code=422, detail="part_id is required")
    data = get_erp_part(part_id)
    bom_items = data["bom"]
    materials = {item["id"]: item for item in data["materials"]}
    stock = {item["id"]: item for item in data["stock"]}
    primary_bom = bom_items[0] if bom_items else None
    primary_material = materials.get(primary_bom["material_id"]) if primary_bom else None
    primary_stock = stock.get(primary_bom["stock_id"]) if primary_bom else None

    return {
        "source": "mock_erp",
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "part": data["part"],
        "customer": data["customer"],
        "material": {
            "name": primary_material.get("name") if primary_material else "ERP material",
            "stock_description": primary_stock.get("description") if primary_stock else "",
            "stock_piece_cost_eur": primary_stock.get("cost_eur") if primary_stock else 0,
            "stock_pieces_required": primary_bom.get("stock_pieces_required", 1) if primary_bom else 1,
            "scrap_recovery_eur": primary_bom.get("scrap_recovery_eur", 0) if primary_bom else 0,
        },
        "route": data["route"],
        "bom": bom_items,
        "availability_notes": [
            item.get("availability_note", "")
            for item in data["stock"]
            if primary_bom and item.get("id") == primary_bom.get("stock_id") and item.get("availability_note")
        ],
    }


@router.post("/erp/customer-offer")
def create_customer_offer(payload: ErpCustomerOfferInput) -> dict[str, Any]:
    with locked_store(CUSTOMER_OFFER_PAYLOADS_PATH):
        offers = _read_offer_payloads()
        saved = {
            "id": f"co-mock-{uuid4()}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "mock_sent_to_erp",
            **payload.model_dump(),
        }
        offers.append(saved)
        _write_offer_payloads(offers)
        return saved


@router.get("/erp/customer-offers")
def list_customer_offers() -> list[dict[str, Any]]:
    return sorted(_read_offer_payloads(), key=lambda item: item.get("created_at", ""), reverse=True)
