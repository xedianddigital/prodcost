from pathlib import Path

from fastapi.testclient import TestClient

from app.api import market_evidence
from app.api.market_evidence_llm import QuoteExtraction, ExtractedLineItem
from app.main import app


def test_basket_row_save_list_update_and_delete(tmp_path: Path) -> None:
    market_evidence.BASKET_PATH = tmp_path / "market_evidence_basket.json"
    client = TestClient(app)

    response = client.post(
        "/api/market-evidence/basket-rows",
        json={
            "source": "manual",
            "part_name": "Bracket",
            "quantity": 20,
            "line_total_eur": 3780,
            "material_sell_eur": 550,
            "route_hours": [{"market_rate_class_id": "cnc", "hours": 12.5}],
        },
    )
    assert response.status_code == 200
    saved = response.json()
    assert saved["id"]
    assert saved["part_name"] == "Bracket"

    listed = client.get("/api/market-evidence/basket-rows").json()
    assert len(listed) == 1

    update_response = client.put(
        f"/api/market-evidence/basket-rows/{saved['id']}",
        json={
            "source": "manual",
            "part_name": "Bracket",
            "quantity": 20,
            "line_total_eur": 3780,
            "material_sell_eur": 600,
            "route_hours": [{"market_rate_class_id": "cnc", "hours": 12.5}],
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["material_sell_eur"] == 600
    assert update_response.json()["created_at"] == saved["created_at"]

    delete_response = client.delete(f"/api/market-evidence/basket-rows/{saved['id']}")
    assert delete_response.status_code == 200
    assert client.get("/api/market-evidence/basket-rows").json() == []


def test_update_missing_basket_row_returns_404(tmp_path: Path) -> None:
    market_evidence.BASKET_PATH = tmp_path / "market_evidence_basket.json"
    client = TestClient(app)

    response = client.put(
        "/api/market-evidence/basket-rows/does-not-exist",
        json={"source": "manual", "part_name": "Bracket"},
    )
    assert response.status_code == 404


def test_extract_quote_returns_parsed_fields(monkeypatch) -> None:
    client = TestClient(app)

    def fake_extract_quote(pdf_bytes: bytes) -> QuoteExtraction:
        assert pdf_bytes == b"%PDF-fake-bytes"
        return QuoteExtraction(
            supplier="Acme Metalworks",
            currency="EUR",
            line_items=[ExtractedLineItem(part_name="Bracket", quantity=20, line_total=3780)],
        )

    monkeypatch.setattr(market_evidence, "extract_quote", fake_extract_quote)

    response = client.post(
        "/api/market-evidence/extract-quote",
        files={"file": ("quote.pdf", b"%PDF-fake-bytes", "application/pdf")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["supplier"] == "Acme Metalworks"
    assert body["line_items"][0]["part_name"] == "Bracket"


def test_extract_quote_surfaces_rate_limit_as_502(monkeypatch) -> None:
    client = TestClient(app)

    def failing_extract_quote(pdf_bytes: bytes) -> QuoteExtraction:
        raise RuntimeError("OpenRouter rate-limited after 4 retries (last status 429)")

    monkeypatch.setattr(market_evidence, "extract_quote", failing_extract_quote)

    response = client.post(
        "/api/market-evidence/extract-quote",
        files={"file": ("quote.pdf", b"%PDF-fake-bytes", "application/pdf")},
    )
    assert response.status_code == 502
