from pathlib import Path

from fastapi.testclient import TestClient

from app.api import quote_drafts
from app.main import app


def _save_draft(client: TestClient) -> str:
    response = client.post(
        "/api/quote-drafts",
        json={
            "name": "Export bracket",
            "quote_state": {"partName": "Bracket", "quantity": 5},
            "target_result": {
                "sell_price_eur": 100,
                "unit_sell_price_eur": 20,
                "lines": [{"label": "Material", "cost_eur": 30, "unit_cost_eur": 6}],
            },
            "accounting_result": {
                "sell_price_eur": 120,
                "unit_sell_price_eur": 24,
                "lines": [{"label": "Material", "cost_eur": 30, "unit_cost_eur": 6}],
            },
            "quantity_break_results": [
                {
                    "quantity": 5,
                    "target": {"sell_price_eur": 100, "unit_sell_price_eur": 20},
                    "accounting": {"sell_price_eur": 120, "unit_sell_price_eur": 24},
                }
            ],
            "assumptions_snapshot": {"id": "assumptions-v0"},
        },
    )
    return response.json()["id"]


def test_quote_draft_json_and_csv_exports(tmp_path: Path) -> None:
    quote_drafts.DRAFTS_PATH = tmp_path / "quote_drafts.json"
    client = TestClient(app)
    draft_id = _save_draft(client)

    json_response = client.get(f"/api/quote-drafts/{draft_id}/export.json")
    assert json_response.status_code == 200
    assert json_response.json()["part_name"] == "Bracket"
    assert json_response.json()["target_sell_price_eur"] == 100
    assert json_response.json()["quantity_break_results"][0]["quantity"] == 5

    csv_response = client.get(f"/api/quote-drafts/{draft_id}/export.csv")
    assert csv_response.status_code == 200
    assert "Target sell price" in csv_response.text
    assert "quantity_break_target" in csv_response.text
    assert "Material" in csv_response.text
