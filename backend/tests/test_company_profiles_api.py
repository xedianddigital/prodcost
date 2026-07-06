from pathlib import Path

from fastapi.testclient import TestClient

from app.api import company_profiles
from app.main import app


def test_company_profile_save_list_get_and_delete(tmp_path: Path) -> None:
    company_profiles.PROFILES_PATH = tmp_path / "company_profiles.json"
    client = TestClient(app)

    response = client.post(
        "/api/company-profiles",
        json={
            "name": "Factory profile",
            "profile_state": {
                "companyName": "Factory profile",
                "assets": [],
                "employees": [],
                "overheadItems": [],
            },
            "assumptions_snapshot": {"id": "assumptions-v0"},
        },
    )

    assert response.status_code == 200
    saved = response.json()
    assert saved["id"]
    assert saved["profile_state"]["profileId"] == saved["id"]

    listed = client.get("/api/company-profiles").json()
    assert len(listed) == 1
    assert listed[0]["name"] == "Factory profile"

    fetched = client.get(f"/api/company-profiles/{saved['id']}").json()
    assert fetched["assumptions_snapshot"]["id"] == "assumptions-v0"

    delete_response = client.delete(f"/api/company-profiles/{saved['id']}")
    assert delete_response.status_code == 200
    assert client.get("/api/company-profiles").json() == []
