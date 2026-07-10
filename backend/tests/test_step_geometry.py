from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api import step_geometry
from app.api.step_geometry import _classify_operations, analyze_step_bytes
from app.main import app

FIXTURE_STEP = Path(__file__).resolve().parents[2] / "Part13.STEP"

pytestmark = pytest.mark.skipif(
    not step_geometry.has_geometry_support(), reason="cadquery geometry extra not installed"
)


def test_analyze_step_bytes_reports_bbox_volume_and_faces() -> None:
    analysis = analyze_step_bytes(FIXTURE_STEP.read_bytes())

    assert analysis.bounding_box_mm.x == pytest.approx(30.0, abs=0.5)
    assert analysis.bounding_box_mm.y == pytest.approx(40.0, abs=0.5)
    assert analysis.bounding_box_mm.z == pytest.approx(50.0, abs=0.5)
    assert analysis.volume_mm3 > 0
    assert analysis.surface_area_mm2 > 0
    assert analysis.face_counts.get("planar", 0) > 0
    assert analysis.face_counts.get("cylindrical", 0) > 0


def test_analyze_step_bytes_suggests_milling_and_drilling() -> None:
    analysis = analyze_step_bytes(FIXTURE_STEP.read_bytes())

    assert "milling_3_axis" in analysis.suggested_operations
    assert "drilling" in analysis.suggested_operations
    assert "turning" not in analysis.suggested_operations
    assert analysis.hole_count_estimate == 2


def test_analyze_step_bytes_handles_malformed_input_gracefully() -> None:
    analysis = analyze_step_bytes(b"not a real step file")

    assert analysis.suggested_operations == []
    assert analysis.notes


def test_classify_operations_turning_candidate() -> None:
    # Envelope is a cylinder: longest dim 100 -> half is 50, radius matches within tolerance.
    operations, hole_count, notes = _classify_operations(
        bbox_dims=(50.0, 50.0, 100.0),
        solidity_ratio=0.9,
        cylindrical_groups=[(49.0, (0, 0, 1), (0, 0, 0))],
    )
    assert operations == ["turning"]
    assert hole_count == 0
    assert notes


def test_classify_operations_thin_plate_suggests_cutting() -> None:
    operations, hole_count, notes = _classify_operations(
        bbox_dims=(200.0, 150.0, 5.0),
        solidity_ratio=0.95,
        cylindrical_groups=[],
    )
    assert operations == ["saw_cutting"]
    assert hole_count == 0


def test_tessellate_step_bytes_returns_valid_mesh() -> None:
    mesh = step_geometry.tessellate_step_bytes(FIXTURE_STEP.read_bytes())

    assert mesh is not None
    assert len(mesh.vertices) % 3 == 0
    assert len(mesh.triangles) % 3 == 0
    assert len(mesh.triangles) >= 3
    vertex_count = len(mesh.vertices) // 3
    assert all(0 <= index < vertex_count for index in mesh.triangles)


def test_tessellate_step_bytes_handles_malformed_input() -> None:
    assert step_geometry.tessellate_step_bytes(b"not a real step file") is None


def test_quote_analysis_endpoint_returns_analysis_and_mesh() -> None:
    client = TestClient(app)

    with FIXTURE_STEP.open("rb") as f:
        response = client.post(
            "/api/step/quote-analysis",
            files={"file": ("Part13.STEP", f, "application/octet-stream")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["analysis"]["volume_mm3"] > 0
    assert body["mesh"] is not None
    assert len(body["mesh"]["triangles"]) >= 3


def test_analyze_geometry_endpoint_returns_503_when_unsupported(monkeypatch) -> None:
    monkeypatch.setattr(step_geometry, "has_geometry_support", lambda: False)
    client = TestClient(app)

    with FIXTURE_STEP.open("rb") as f:
        response = client.post(
            "/api/step/analyze-geometry",
            files={"file": ("Part13.STEP", f, "application/octet-stream")},
        )

    assert response.status_code == 503
    assert "geometry" in response.json()["detail"].lower()


def test_analyze_geometry_endpoint_rejects_non_step_extension() -> None:
    client = TestClient(app)

    response = client.post(
        "/api/step/analyze-geometry",
        files={"file": ("part.txt", b"hello", "text/plain")},
    )

    assert response.status_code == 400
