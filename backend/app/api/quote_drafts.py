import csv
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from app.persistence import atomic_write_json, locked_store

router = APIRouter(tags=["quote drafts"])

DRAFTS_PATH = Path(__file__).resolve().parents[3] / "data" / "quote_drafts.json"


class QuoteDraftInput(BaseModel):
    name: str = Field(min_length=1)
    quote_state: dict[str, Any]
    target_result: dict[str, Any] | None = None
    accounting_result: dict[str, Any] | None = None
    quantity_break_results: list[dict[str, Any]] = Field(default_factory=list)
    assumptions_snapshot: dict[str, Any] | None = None


class QuoteDraft(QuoteDraftInput):
    id: str
    created_at: str
    updated_at: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_store() -> list[dict[str, Any]]:
    if not DRAFTS_PATH.exists():
        return []
    try:
        payload = json.loads(DRAFTS_PATH.read_text())
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Quote drafts file contains invalid JSON") from exc
    if not isinstance(payload, list):
        raise HTTPException(status_code=500, detail="Quote drafts file must contain a JSON array")
    return payload


def _write_store(drafts: list[dict[str, Any]]) -> None:
    atomic_write_json(DRAFTS_PATH, drafts)


@router.get("/quote-drafts", response_model=list[QuoteDraft])
def list_quote_drafts() -> list[dict[str, Any]]:
    drafts = _read_store()
    return sorted(drafts, key=lambda item: item.get("updated_at", ""), reverse=True)


@router.get("/quote-drafts/{draft_id}", response_model=QuoteDraft)
def get_quote_draft(draft_id: str) -> dict[str, Any]:
    for draft in _read_store():
        if draft.get("id") == draft_id:
            return draft
    raise HTTPException(status_code=404, detail="Quote draft not found")


@router.post("/quote-drafts", response_model=QuoteDraft)
def save_quote_draft(payload: QuoteDraftInput) -> dict[str, Any]:
    with locked_store(DRAFTS_PATH):
        drafts = _read_store()
        state_id = payload.quote_state.get("draftId") if isinstance(payload.quote_state, dict) else None
        existing_index = next(
            (index for index, draft in enumerate(drafts) if draft.get("id") == state_id),
            None,
        )
        timestamp = _now()

        if existing_index is None:
            draft = {
                "id": str(uuid4()),
                "created_at": timestamp,
                "updated_at": timestamp,
                **payload.model_dump(),
            }
            if isinstance(draft["quote_state"], dict):
                draft["quote_state"]["draftId"] = draft["id"]
            drafts.append(draft)
        else:
            existing = drafts[existing_index]
            draft = {
                **existing,
                **payload.model_dump(),
                "id": existing["id"],
                "created_at": existing.get("created_at", timestamp),
                "updated_at": timestamp,
            }
            if isinstance(draft["quote_state"], dict):
                draft["quote_state"]["draftId"] = draft["id"]
            drafts[existing_index] = draft

        _write_store(drafts)
        return draft


@router.delete("/quote-drafts/{draft_id}")
def delete_quote_draft(draft_id: str) -> dict[str, str]:
    with locked_store(DRAFTS_PATH):
        drafts = _read_store()
        remaining = [draft for draft in drafts if draft.get("id") != draft_id]
        if len(remaining) == len(drafts):
            raise HTTPException(status_code=404, detail="Quote draft not found")
        _write_store(remaining)
        return {"status": "deleted"}


def _quote_export_payload(draft: dict[str, Any]) -> dict[str, Any]:
    target = draft.get("target_result") or {}
    accounting = draft.get("accounting_result") or {}
    quote_state = draft.get("quote_state") or {}
    return {
        "id": draft.get("id"),
        "name": draft.get("name"),
        "created_at": draft.get("created_at"),
        "updated_at": draft.get("updated_at"),
        "part_name": quote_state.get("partName"),
        "quantity": quote_state.get("quantity"),
        "target_sell_price_eur": target.get("sell_price_eur"),
        "target_unit_sell_price_eur": target.get("unit_sell_price_eur"),
        "accounting_sell_price_eur": accounting.get("sell_price_eur"),
        "accounting_unit_sell_price_eur": accounting.get("unit_sell_price_eur"),
        "quantity_break_results": draft.get("quantity_break_results") or quote_state.get("quantityBreakResults") or [],
        "quote_state": quote_state,
        "target_result": target,
        "accounting_result": accounting,
        "assumptions_snapshot": draft.get("assumptions_snapshot"),
    }


def _find_draft(draft_id: str) -> dict[str, Any]:
    for draft in _read_store():
        if draft.get("id") == draft_id:
            return draft
    raise HTTPException(status_code=404, detail="Quote draft not found")


@router.get("/quote-drafts/{draft_id}/export.json")
def export_quote_draft_json(draft_id: str) -> Response:
    draft = _find_draft(draft_id)
    payload = _quote_export_payload(draft)
    filename = f"quote-{draft_id}.json"
    return Response(
        content=json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/quote-drafts/{draft_id}/export.csv")
def export_quote_draft_csv(draft_id: str) -> Response:
    draft = _find_draft(draft_id)
    target = draft.get("target_result") or {}
    accounting = draft.get("accounting_result") or {}
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["section", "label", "total_eur", "unit_eur"] )
    writer.writerow(["summary", "Target sell price", target.get("sell_price_eur", ""), target.get("unit_sell_price_eur", "")])
    writer.writerow(["summary", "Accounting sell price", accounting.get("sell_price_eur", ""), accounting.get("unit_sell_price_eur", "")])
    writer.writerow(["summary", "Target missing-tool cost", target.get("missing_tool_cost_eur", ""), ""])
    writer.writerow(["summary", "Accounting missing-tool cost", accounting.get("missing_tool_cost_eur", ""), ""])

    for item in draft.get("quantity_break_results", []) or []:
        target_break = item.get("target", {}) if isinstance(item, dict) else {}
        accounting_break = item.get("accounting", {}) if isinstance(item, dict) else {}
        writer.writerow(["quantity_break_target", item.get("quantity", ""), target_break.get("sell_price_eur", ""), target_break.get("unit_sell_price_eur", "")])
        writer.writerow(["quantity_break_accounting", item.get("quantity", ""), accounting_break.get("sell_price_eur", ""), accounting_break.get("unit_sell_price_eur", "")])

    for mode, result in [("target", target), ("accounting", accounting)]:
        for line in result.get("lines", []) if isinstance(result, dict) else []:
            writer.writerow([mode, line.get("label", ""), line.get("cost_eur", ""), line.get("unit_cost_eur", "")])

    filename = f"quote-{draft_id}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
