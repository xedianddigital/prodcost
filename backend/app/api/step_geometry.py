import tempfile
from collections import Counter

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

router = APIRouter(tags=["step geometry"])

# Heuristic thresholds -- tune these against more sample parts as they come in.
TURNING_RADIUS_TOLERANCE_RATIO = 0.12  # cyl radius vs. half the longest bbox dim, as a fraction
SHEET_THIN_DIM_RATIO = 0.15  # min(bbox dims) / max(bbox dims) below this looks like a plate
SHEET_MIN_SOLIDITY = 0.85  # volume / bbox volume above this, combined with thinness, looks cut-not-milled
AXIS_GROUP_DECIMALS = 1  # rounding used to group cylindrical faces into distinct holes/turned features


def has_geometry_support() -> bool:
    try:
        import cadquery  # noqa: F401
    except ImportError:
        return False
    return True


class BoundingBox(BaseModel):
    x: float
    y: float
    z: float


class StepAnalysis(BaseModel):
    bounding_box_mm: BoundingBox
    volume_mm3: float
    surface_area_mm2: float
    solidity_ratio: float
    face_counts: dict[str, int]
    cylindrical_radii_mm: list[float]
    suggested_operations: list[str]
    hole_count_estimate: int
    notes: list[str] = Field(default_factory=list)


def _empty_analysis(note: str) -> StepAnalysis:
    return StepAnalysis(
        bounding_box_mm=BoundingBox(x=0, y=0, z=0),
        volume_mm3=0,
        surface_area_mm2=0,
        solidity_ratio=0,
        face_counts={},
        cylindrical_radii_mm=[],
        suggested_operations=[],
        hole_count_estimate=0,
        notes=[note],
    )


def _classify_operations(
    bbox_dims: tuple[float, float, float],
    solidity_ratio: float,
    cylindrical_groups: list[tuple[float, tuple[float, float, float], tuple[float, float, float]]],
) -> tuple[list[str], int, list[str]]:
    """Pure heuristic classifier. Returns (suggested_operations, hole_count_estimate, notes)."""
    notes = ["Heuristic estimate from face/volume analysis, not a real CAM/toolpath analysis."]
    sorted_dims = sorted(bbox_dims)
    min_dim, _, max_dim = sorted_dims
    half_max_dim = max_dim / 2

    turning_group = None
    if cylindrical_groups:
        largest = max(cylindrical_groups, key=lambda g: g[0])
        radius, _axis_dir, _axis_loc = largest
        if half_max_dim > 0 and abs(radius - half_max_dim) / half_max_dim <= TURNING_RADIUS_TOLERANCE_RATIO:
            turning_group = largest

    operations: list[str] = []

    if turning_group is not None:
        operations.append("turning")
        notes.append(
            "Overall envelope is close to a cylinder of revolution, suggesting this part could be turned."
        )
        remaining_groups = [g for g in cylindrical_groups if g is not turning_group]
    else:
        remaining_groups = cylindrical_groups
        is_thin_plate = max_dim > 0 and (min_dim / max_dim) <= SHEET_THIN_DIM_RATIO
        if is_thin_plate and solidity_ratio >= SHEET_MIN_SOLIDITY:
            operations.append("saw_cutting")
            notes.append("Part is a thin, solid plate -- suggesting cutting rather than milling.")
        else:
            operations.append("milling_3_axis")

    hole_count_estimate = len(remaining_groups)
    if hole_count_estimate:
        operations.append("drilling")

    return operations, hole_count_estimate, notes


def analyze_step_bytes(step_bytes: bytes) -> StepAnalysis:
    try:
        import cadquery as cq
        from OCP.BRepAdaptor import BRepAdaptor_Surface
        from OCP.BRepGProp import BRepGProp
        from OCP.GeomAbs import GeomAbs_Cone, GeomAbs_Cylinder
        from OCP.GProp import GProp_GProps
        from OCP.TopAbs import TopAbs_FACE
        from OCP.TopExp import TopExp_Explorer
        from OCP.TopoDS import TopoDS
    except ImportError:
        return _empty_analysis(
            "Geometry analysis dependency (cadquery) is not installed on this server."
        )

    try:
        with tempfile.NamedTemporaryFile(suffix=".step", delete=True) as tmp:
            tmp.write(step_bytes)
            tmp.flush()
            result = cq.importers.importStep(tmp.name)
            shape = result.val().wrapped

            bbox = result.val().BoundingBox()

            volume_props = GProp_GProps()
            BRepGProp.VolumeProperties_s(shape, volume_props)
            volume_mm3 = volume_props.Mass()

            surface_props = GProp_GProps()
            BRepGProp.SurfaceProperties_s(shape, surface_props)
            surface_area_mm2 = surface_props.Mass()

            face_type_names = {
                0: "planar",
                1: "cylindrical",
                2: "conical",
                4: "spherical",
                5: "toroidal",
            }
            face_counts: Counter[str] = Counter()
            cylindrical_groups_map: dict[tuple, tuple[float, tuple, tuple]] = {}

            explorer = TopExp_Explorer(shape, TopAbs_FACE)
            while explorer.More():
                face = TopoDS.Face_s(explorer.Current())
                surf = BRepAdaptor_Surface(face, True)
                surf_type = surf.GetType()
                type_name = face_type_names.get(int(surf_type), "other")
                face_counts[type_name] += 1

                if surf_type == GeomAbs_Cylinder:
                    cyl = surf.Cylinder()
                    radius = cyl.Radius()
                    axis_dir = cyl.Axis().Direction()
                    axis_loc = cyl.Location()
                    key = (
                        round(radius, AXIS_GROUP_DECIMALS),
                        round(axis_dir.X(), AXIS_GROUP_DECIMALS),
                        round(axis_dir.Y(), AXIS_GROUP_DECIMALS),
                        round(axis_dir.Z(), AXIS_GROUP_DECIMALS),
                        round(axis_loc.X(), AXIS_GROUP_DECIMALS),
                        round(axis_loc.Y(), AXIS_GROUP_DECIMALS),
                        round(axis_loc.Z(), AXIS_GROUP_DECIMALS),
                    )
                    cylindrical_groups_map[key] = (
                        radius,
                        (axis_dir.X(), axis_dir.Y(), axis_dir.Z()),
                        (axis_loc.X(), axis_loc.Y(), axis_loc.Z()),
                    )
                elif surf_type == GeomAbs_Cone:
                    face_counts["conical"] = face_counts.get("conical", 0)

                explorer.Next()

            bbox_dims = (bbox.xlen, bbox.ylen, bbox.zlen)
            bbox_volume = bbox_dims[0] * bbox_dims[1] * bbox_dims[2]
            solidity_ratio = (volume_mm3 / bbox_volume) if bbox_volume > 0 else 0.0

            cylindrical_groups = list(cylindrical_groups_map.values())
            suggested_operations, hole_count_estimate, notes = _classify_operations(
                bbox_dims, solidity_ratio, cylindrical_groups
            )

            return StepAnalysis(
                bounding_box_mm=BoundingBox(x=bbox_dims[0], y=bbox_dims[1], z=bbox_dims[2]),
                volume_mm3=volume_mm3,
                surface_area_mm2=surface_area_mm2,
                solidity_ratio=solidity_ratio,
                face_counts=dict(face_counts),
                cylindrical_radii_mm=sorted({round(g[0], 3) for g in cylindrical_groups}),
                suggested_operations=suggested_operations,
                hole_count_estimate=hole_count_estimate,
                notes=notes,
            )
    except Exception as exc:  # noqa: BLE001 -- malformed STEP files must never 500 the endpoint
        return _empty_analysis(f"Could not analyze this STEP file: {exc}")


class TessellatedMesh(BaseModel):
    # Flat [x0, y0, z0, x1, y1, z1, ...] vertex buffer and [a, b, c, ...] triangle index
    # buffer -- the shapes the client portal previews stay small enough that JSON is fine.
    vertices: list[float]
    triangles: list[int]


class StepQuoteAnalysis(BaseModel):
    analysis: StepAnalysis
    mesh: TessellatedMesh | None = None


def tessellate_step_bytes(step_bytes: bytes) -> TessellatedMesh | None:
    try:
        import cadquery as cq
    except ImportError:
        return None
    try:
        with tempfile.NamedTemporaryFile(suffix=".step", delete=True) as tmp:
            tmp.write(step_bytes)
            tmp.flush()
            shape = cq.importers.importStep(tmp.name).val()
            bbox = shape.BoundingBox()
            diagonal = (bbox.xlen**2 + bbox.ylen**2 + bbox.zlen**2) ** 0.5
            # Preview-quality tessellation: coarse enough to keep the JSON payload small,
            # fine enough that holes and pockets are recognizable in the 3D preview.
            tolerance = max(0.05, diagonal / 250)
            vertices, triangles = shape.tessellate(tolerance)
            flat_vertices: list[float] = []
            for vertex in vertices:
                flat_vertices.extend((round(vertex.x, 3), round(vertex.y, 3), round(vertex.z, 3)))
            flat_triangles: list[int] = []
            for tri in triangles:
                flat_triangles.extend(tri)
            return TessellatedMesh(vertices=flat_vertices, triangles=flat_triangles)
    except Exception:  # noqa: BLE001 -- a preview failure must never block the estimate
        return None


@router.post("/step/quote-analysis", response_model=StepQuoteAnalysis)
async def quote_analysis(file: UploadFile = File(...)) -> StepQuoteAnalysis:
    """Analysis plus a preview mesh in one upload, for the client instant-quote page.

    The STEP file is imported twice (once per helper); acceptable for the portal's
    file sizes and keeps both helpers independently simple.
    """
    filename = file.filename or ""
    if not filename.lower().endswith((".step", ".stp")):
        raise HTTPException(status_code=400, detail="Uploaded file must be a .step or .stp file")

    step_bytes = await file.read()
    if not has_geometry_support():
        return StepQuoteAnalysis(
            analysis=_empty_analysis(
                "Geometry analysis dependency (cadquery) is not installed on this server."
            ),
            mesh=None,
        )
    return StepQuoteAnalysis(
        analysis=analyze_step_bytes(step_bytes),
        mesh=tessellate_step_bytes(step_bytes),
    )


@router.post("/step/analyze-geometry", response_model=StepAnalysis)
async def analyze_geometry(file: UploadFile = File(...)) -> StepAnalysis:
    filename = file.filename or ""
    if not filename.lower().endswith((".step", ".stp")):
        raise HTTPException(status_code=400, detail="Uploaded file must be a .step or .stp file")

    if not has_geometry_support():
        raise HTTPException(
            status_code=503,
            detail=(
                "STEP geometry analysis is not configured on this server: the optional "
                "'geometry' dependency (cadquery) is not installed (see README.md, "
                "pip install -e \".[geometry]\"). This feature is optional -- you can still "
                "enter operations manually."
            ),
        )

    step_bytes = await file.read()
    return analyze_step_bytes(step_bytes)
