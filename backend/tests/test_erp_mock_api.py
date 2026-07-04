from pathlib import Path

from fastapi.testclient import TestClient

from app.api import erp
from app.main import app


def test_mock_erp_import_rfq_returns_quote_ready_payload() -> None:
    client = TestClient(app)

    response = client.post("/api/erp/import-rfq", json={"part_id": "part_al_sensor_bracket_rev_b"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "mock_erp"
    assert payload["part"]["name"] == "CNC aluminium sensor bracket"
    assert payload["customer"]["name"] == "Baltic Robotics Group"
    assert payload["material"]["stock_piece_cost_eur"] == 86
    assert len(payload["route"]) >= 3


def test_mock_erp_customer_offer_round_trip(tmp_path: Path) -> None:
    erp.CUSTOMER_OFFER_PAYLOADS_PATH = tmp_path / "customer_offer_payloads.json"
    client = TestClient(app)

    response = client.post(
        "/api/erp/customer-offer",
        json={
            "quote_number": "Q-ERP-001",
            "customer_name": "Baltic Robotics Group",
            "rfq_reference": "RFQ-ERP-001",
            "part_name": "Bracket",
            "quantity": 50,
            "target_sell_price_eur": 1250,
            "target_unit_sell_price_eur": 25,
            "accounting_sell_price_eur": 1800,
            "accounting_unit_sell_price_eur": 36,
        },
    )

    assert response.status_code == 200
    saved = response.json()
    assert saved["status"] == "mock_sent_to_erp"
    assert saved["id"].startswith("co-mock-")

    listed = client.get("/api/erp/customer-offers").json()
    assert listed[0]["quote_number"] == "Q-ERP-001"
