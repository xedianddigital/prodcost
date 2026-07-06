import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.persistence import atomic_write_json, locked_store

router = APIRouter(tags=["company profiles"])

PROFILES_PATH = Path(__file__).resolve().parents[3] / "data" / "company_profiles.json"


class CompanyProfileInput(BaseModel):
    name: str = Field(min_length=1)
    profile_state: dict[str, Any]
    assumptions_snapshot: dict[str, Any] | None = None


class CompanyProfile(CompanyProfileInput):
    id: str
    created_at: str
    updated_at: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_store() -> list[dict[str, Any]]:
    if not PROFILES_PATH.exists():
        return []
    try:
        payload = json.loads(PROFILES_PATH.read_text())
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Company profiles file contains invalid JSON") from exc
    if not isinstance(payload, list):
        raise HTTPException(status_code=500, detail="Company profiles file must contain a JSON array")
    return payload


def _write_store(profiles: list[dict[str, Any]]) -> None:
    atomic_write_json(PROFILES_PATH, profiles)


@router.get("/company-profiles", response_model=list[CompanyProfile])
def list_company_profiles() -> list[dict[str, Any]]:
    profiles = _read_store()
    return sorted(profiles, key=lambda item: item.get("updated_at", ""), reverse=True)


@router.get("/company-profiles/{profile_id}", response_model=CompanyProfile)
def get_company_profile(profile_id: str) -> dict[str, Any]:
    for profile in _read_store():
        if profile.get("id") == profile_id:
            return profile
    raise HTTPException(status_code=404, detail="Company profile not found")


@router.post("/company-profiles", response_model=CompanyProfile)
def save_company_profile(payload: CompanyProfileInput) -> dict[str, Any]:
    with locked_store(PROFILES_PATH):
        profiles = _read_store()
        state_id = payload.profile_state.get("profileId") if isinstance(payload.profile_state, dict) else None
        existing_index = next(
            (index for index, profile in enumerate(profiles) if profile.get("id") == state_id),
            None,
        )
        timestamp = _now()

        if existing_index is None:
            profile = {
                "id": str(uuid4()),
                "created_at": timestamp,
                "updated_at": timestamp,
                **payload.model_dump(),
            }
            if isinstance(profile["profile_state"], dict):
                profile["profile_state"]["profileId"] = profile["id"]
            profiles.append(profile)
        else:
            existing = profiles[existing_index]
            profile = {
                **existing,
                **payload.model_dump(),
                "id": existing["id"],
                "created_at": existing.get("created_at", timestamp),
                "updated_at": timestamp,
            }
            if isinstance(profile["profile_state"], dict):
                profile["profile_state"]["profileId"] = profile["id"]
            profiles[existing_index] = profile

        _write_store(profiles)
        return profile


@router.delete("/company-profiles/{profile_id}")
def delete_company_profile(profile_id: str) -> dict[str, str]:
    with locked_store(PROFILES_PATH):
        profiles = _read_store()
        remaining = [profile for profile in profiles if profile.get("id") != profile_id]
        if len(remaining) == len(profiles):
            raise HTTPException(status_code=404, detail="Company profile not found")
        _write_store(remaining)
        return {"status": "deleted"}
