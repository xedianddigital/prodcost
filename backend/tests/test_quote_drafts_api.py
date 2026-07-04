from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import quote_drafts
from app.main import app


def test_quote_draft_save_list_get_and_delete(tmp_path: Path) -> None:
    quote_drafts.DRAFTS_PATH = tmp_path / "quote_drafts.json"
    client = TestClient(app)

    response = client.post(
        "/api/quote-drafts",
        json={
            "name": "Q-001 bracket",
            "quote_state": {"partName": "Bracket", "quantity": 20},
            "target_result": {"sell_price_eur": 100},
            "accounting_result": {"sell_price_eur": 120},
            "assumptions_snapshot": {"id": "assumptions-v0"},
        },
    )

    assert response.status_code == 200
    saved = response.json()
    assert saved["id"]
    assert saved["quote_state"]["draftId"] == saved["id"]

    listed = client.get("/api/quote-drafts").json()
    assert len(listed) == 1
    assert listed[0]["name"] == "Q-001 bracket"

    fetched = client.get(f"/api/quote-drafts/{saved['id']}").json()
    assert fetched["target_result"]["sell_price_eur"] == 100

    delete_response = client.delete(f"/api/quote-drafts/{saved['id']}")
    assert delete_response.status_code == 200
    assert client.get("/api/quote-drafts").json() == []


def test_concurrent_draft_saves_do_not_lose_entries(tmp_path: Path) -> None:
    quote_drafts.DRAFTS_PATH = tmp_path / "quote_drafts.json"
    client = TestClient(app)

    def save(index: int) -> int:
        response = client.post(
            "/api/quote-drafts",
            json={
                "name": f"Concurrent draft {index}",
                "quote_state": {"partName": f"Part {index}", "quantity": 1},
            },
        )
        return response.status_code

    worker_count = 20
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        statuses = list(executor.map(save, range(worker_count)))

    assert all(status == 200 for status in statuses)
    listed = client.get("/api/quote-drafts").json()
    assert len(listed) == worker_count
    assert len({draft["id"] for draft in listed}) == worker_count
