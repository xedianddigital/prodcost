from fastapi.testclient import TestClient

from app.main import app


def test_assumptions_endpoint_returns_editable_sections() -> None:
    client = TestClient(app)

    response = client.get("/api/assumptions")

    assert response.status_code == 200
    payload = response.json()
    assert "commercial_policy" in payload
    assert "cam_programming_defaults" in payload
    assert "labor_classes" in payload
    assert "machine_classes" in payload
