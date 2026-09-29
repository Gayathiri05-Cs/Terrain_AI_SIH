import numpy as np
from app.models.depth_model import DepthAnythingV2Engine
from app.processing.calibration import calibrate_depth_to_dsm
from app.processing.terrain_analysis import analyze_terrain_surface
from app.processing.confidence import compute_confidence_map
from app.processing.flood_simulation import simulate_elevation_flood
from app.utils.validation import evaluate_dsm_validation


def test_depth_and_calibration_pipeline():
    engine = DepthAnythingV2Engine("SMALL")
    rgb = np.random.randint(0, 255, (32, 32, 3), dtype=np.uint8)
    depth_res = engine.predict_relative_depth(rgb)
    assert depth_res["normalized_depth"].shape == (32, 32)
    assert 0.0 <= float(np.min(depth_res["normalized_depth"])) <= 1.0

    # Test Mode B Calibration Z = 200 * D + 50
    ref_dem = depth_res["normalized_depth"] * 200.0 + 50.0
    cal_res = calibrate_depth_to_dsm(depth_res["normalized_depth"], ref_dem)
    assert cal_res["mode"] == "MODE_B_CALIBRATED"
    assert abs(cal_res["scale"] - 200.0) < 1e-2
    assert abs(cal_res["offset"] - 50.0) < 1e-2


def test_core_flood_equation():
    dsm = np.array([[10.0, 25.0], [18.0, 40.0]], dtype=np.float32)
    water_level = 20.0
    res = simulate_elevation_flood(dsm, water_level)

    # water level >= elevation -> flooded
    assert bool(res["flooded_mask"][0, 0]) is True
    assert bool(res["flooded_mask"][1, 0]) is True
    # water level < elevation -> not flooded
    assert bool(res["flooded_mask"][0, 1]) is False
    assert bool(res["flooded_mask"][1, 1]) is False

    assert abs(float(res["flood_depth"][0, 0]) - 10.0) < 1e-5
    assert abs(float(res["flood_depth"][0, 1]) - 0.0) < 1e-5


def test_validation_and_terrain_metrics():
    dsm = np.linspace(100.0, 200.0, 64, dtype=np.float32).reshape((8, 8))
    terrain = analyze_terrain_surface(dsm, 2.0)
    assert terrain["min_elevation"] == 100.0
    assert terrain["max_elevation"] == 200.0

    conf = compute_confidence_map(dsm, dsm)
    assert 0.0 <= conf["average_confidence"] <= 1.0

    no_val = evaluate_dsm_validation(dsm, None)
    assert no_val["available"] is False
