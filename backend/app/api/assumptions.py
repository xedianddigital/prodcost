import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from app.persistence import atomic_write_json, locked_store

router = APIRouter(tags=["assumptions"])

ASSUMPTIONS_PATH = Path(__file__).resolve().parents[3] / "data" / "baseline_assumptions.lv.json"


def _read_assumptions() -> dict[str, Any]:
    try:
        return json.loads(ASSUMPTIONS_PATH.read_text())
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Assumption file not found") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Assumption file contains invalid JSON") from exc


def _write_assumptions(payload: dict[str, Any]) -> dict[str, Any]:
    required_keys = {
        "cam_programming_defaults",
        "commercial_policy",
        "labor_classes",
        "machine_classes",
        "operation_templates",
    }
    missing = sorted(required_keys - payload.keys())
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing assumption sections: {', '.join(missing)}")

    atomic_write_json(ASSUMPTIONS_PATH, payload)
    return payload


@router.get("/assumptions")
def get_assumptions() -> dict[str, Any]:
    with locked_store(ASSUMPTIONS_PATH):
        return _read_assumptions()


@router.put("/assumptions")
def update_assumptions(payload: dict[str, Any]) -> dict[str, Any]:
    with locked_store(ASSUMPTIONS_PATH):
        return _write_assumptions(payload)
