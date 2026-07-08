# STEP geometry analysis for Quote and Client Portal

## Context

Today, uploading a `.step`/`.stp` file on the Quote page or the Client Portal does nothing functional: only the filename/size is recorded (`cad_file: { filename, file_size_bytes, file_type, geometry_confidence: "not_parsed" }`), the backend never opens the file, and price/operations are entirely manual. The user wants the system to actually "look inside" the file and suggest what machining operations are needed (milling / turning / drilling / cutting) based on real geometry, for demo/presentation purposes — not to build a real CAM system, and not to bind it to real equipment/capacity yet (explicitly deferred).

Feasibility was already spiked live in this session: `cadquery` (wraps OpenCASCADE via `cadquery-ocp`, pure pip wheels, no compiling) installed cleanly in an isolated venv and parsed `Part13.STEP` in under a second — bounding box, volume, surface area, and a face-type histogram (planar/cylindrical/conical/spherical/toroidal), plus cylindrical face radii. Memory stayed flat throughout (no swap growth), so it's safe to run alongside other load. This plan wires that spike into the real app as an optional, heuristic, advisory feature — never replacing manual control, and gracefully absent if the dependency isn't installed (same pattern already used for the optional `OPENROUTER_API_KEY` PDF-extraction feature).

## Backend

**Dependency**: add `cadquery` under a new optional extra in `backend/pyproject.toml` (e.g. `geometry = ["cadquery>=2.8"]`), not a hard dependency — mirrors `dev` extra already there. Document in README/runbook that `pip install -e ".[geometry]"` is needed for this one feature; without it the endpoint reports "not configured," same UX pattern as the PDF-extraction fallback in `backend/app/api/market_evidence.py` (`has_api_key()` → 503 with a human-readable `detail`).

**New module `backend/app/api/step_geometry.py`**:
- `has_geometry_support() -> bool`: `try: import cadquery; return True; except ImportError: return False` (import lazily, not at module top, so the whole backend doesn't hard-fail without the extra installed).
- `class StepAnalysis(BaseModel)`: `bounding_box_mm: {x, y, z}`, `volume_mm3`, `surface_area_mm2`, `solidity_ratio` (volume / bbox volume), `face_counts: dict[str, int]`, `cylindrical_radii_mm: list[float]`, `suggested_operations: list[str]` (subset of the app's real `operation_type` values: `turning`, `milling_3_axis`, `drilling`, `saw_cutting`), `hole_count_estimate: int`, `notes: list[str]` (plain-language caveats, e.g. "heuristic estimate, not a CAM analysis").
- `analyze_step_bytes(step_bytes: bytes) -> StepAnalysis`: reuses the exact pattern proven in the spike (`cq.importers.importStep`, `BRepGProp.VolumeProperties_s`/`SurfaceProperties_s`, `TopExp_Explorer` over `TopAbs_FACE` + `BRepAdaptor_Surface`/`GeomAbs_*` type checks). Wrap in try/except so a malformed/unreadable STEP returns a `StepAnalysis` with empty/zero fields and a note, never a 500.
- Heuristic classifier (pure function, unit-testable in isolation):
  - **Turning candidate**: one dominant cylindrical/conical face set sharing a common axis, with that axis's radius close to half the largest bounding-box dimension (i.e. the part's overall envelope is itself a cylinder) → suggest `turning`.
  - **Milling** (default for anything with planar faces and pockets/steps, i.e. not the turning case): suggest `milling_3_axis`.
  - **Drilling**: any cylindrical faces not part of the turning-axis set → suggest `drilling`, with `hole_count_estimate` = count of distinct (radius, axis) cylindrical face groups.
  - **Sheet/cutting**: solidity ratio high AND one bounding-box dimension is small relative to the other two (thin plate) → suggest `saw_cutting` instead of milling.
  - These thresholds should be named constants at the top of the file, not magic numbers, so they're easy to tune after trying more sample parts.

**New endpoint** in `backend/app/api/step_geometry.py`, registered in `backend/app/main.py` next to the existing routers:
```
POST /api/step/analyze-geometry   (multipart file, .step/.stp)
```
- 400 if content-type/extension isn't step/stp.
- 503 (not 500) if `has_geometry_support()` is False, with a detail message pointing at the optional install (same shape as `market_evidence.py`'s missing-API-key 503).
- Otherwise call `analyze_step_bytes` and return `StepAnalysis`.

## Frontend (`frontend/src/main.tsx`)

Both pages get the *same* new piece of state and fetch call — factor it as one shared function near the other `call*` helpers (next to `callCalculate`, ~line 3024): `async function callAnalyzeGeometry(file: File): Promise<StepAnalysis | null>` — POSTs multipart to `/api/step/analyze-geometry`, returns `null` and surfaces the 503 detail as a status message on failure (do not throw/crash the page), reusing the "parse `detail` from JSON body" pattern already added for `extractBasketPdf`.

**Quote page** (`STEP and CAM` panel, ~line 5624-5657):
- On `cadFile` change, call `callAnalyzeGeometry`, store result in new `stepAnalysis` state.
- Render an advisory sub-panel (not blocking, not auto-applied) under the upload box: bounding box, suggested operation(s), hole count, with a clear "heuristic, not a real CAM analysis" caveat line (reuses the existing `sectionHelp`/`noteList` styling already used in this panel).
- Add a button "Add suggested operations" that, for each `suggested_operations` entry not already present in `quoteOperations`, calls the existing `createOperation(template)` (main.tsx:2106) via the same append path `addOperation()` already uses (main.tsx:4618-4628) — reuse, not reimplement. This is opt-in, the user still edits/removes rows normally afterward.
- No change to `quotePayloadForMode`'s `cad_file.geometry_confidence` semantics beyond setting it to `"heuristic_geometry_parsed"` when analysis succeeded, so the backend's existing informational warning (`calculator.py:202-205`) reflects reality.

**Client Portal** (`addPortalFiles`, ~line 3419, and part cards ~line 5886-5912):
- Extend `PortalPart` with an optional `stepAnalysis` field; `addPortalFiles` calls `callAnalyzeGeometry` per uploaded file and attaches the result to the created part (async — part appears immediately, analysis fills in a moment later, same optimistic-then-fill pattern already used elsewhere in this file).
- Show the same advisory bounding-box/suggested-operations line on each part card.
- Feed the geometry signal into `inferredPortalComplexity` (main.tsx:3248-3261) as one more additive scoring term (e.g. hole count / face count contribute like the existing tolerance/documentation signals do) — extends the existing scoring function rather than replacing its logic, consistent with how the file-size-in-bytes signal was previously removed and redistributed (see the comment at main.tsx:3243-3247).
- Extend `portalRouteOperationTypes` (main.tsx:3280-3282) to include `turning` when geometry suggests it, alongside the existing hardcoded `saw_cutting`/`milling_3_axis`/`drilling` (+ conditional `tapping`) list — same conditional-push pattern already used for tapping.

## i18n

All new user-facing strings (advisory panel labels, the "Add suggested operations" button, caveat text) go through the existing `t("...")` convention and get entries added to the `LV` dictionary in `frontend/src/i18n.ts`, consistent with the rest of the app.

## Docs

- `README.md`: extend the existing "Everything works out of the box with no API keys" paragraph to mention the optional geometry extra the same way the OpenRouter key is mentioned (one more sentence, not a new section).
- `docs/architecture.md` or `docs/costing-model.md` (whichever already documents the CAD/geometry boundary — check during implementation): add a short note that geometry analysis is heuristic face/volume classification, not a CAM/toolpath system, and does not affect quoted price.

## Verification

- Backend: new `backend/tests/test_step_geometry.py` using a small fixture STEP file (can reuse `Part13.STEP` from repo root, or check in a tiny synthetic one) asserting bounding box/volume/face counts and the heuristic's suggested operations match expectations; one test asserting the 503 path when `has_geometry_support()` is monkeypatched to False.
- `cd backend && pytest -q` and `npx tsc --noEmit` in `frontend/` clean.
- Manual: with both dev servers running, upload `Part13.STEP` on the Quote page and confirm the advisory panel shows bounding box 30×40×50mm and milling+drilling suggestions matching the spike's output; click "Add suggested operations" and confirm rows appear in the Operations table; repeat on Client Portal and confirm the part card shows the same advisory info right after upload, independent of the "Calculate Preliminary Estimate" button.
