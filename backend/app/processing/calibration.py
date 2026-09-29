import numpy as np
from typing import Dict, Any, Optional


def calibrate_depth_to_dsm(
    normalized_depth: np.ndarray,
    reference_elevation: Optional[np.ndarray] = None,
    segmentation_mask: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    """
    Fits Z = S * D + B using valid non-NaN, non-water correspondences between
    Predicted Depth (D) and Reference Elevation (Z).
    """
    if reference_elevation is None:
        raw_dsm = normalized_depth * 100.0
        return {
            "mode": "MODE_A_UNCALIBRATED",
            "scale": 100.0,
            "offset": 0.0,
            "valid_points": 0,
            "residual_rmse": 0.0,
            "dsm": raw_dsm,
        }

    valid_mask = np.isfinite(normalized_depth) & np.isfinite(reference_elevation)
    if segmentation_mask is not None:
        valid_mask = valid_mask & (segmentation_mask != 4)  # Exclude unreliable water pixels

    d_valid = normalized_depth[valid_mask].ravel()
    z_valid = reference_elevation[valid_mask].ravel()

    if len(d_valid) < 3:
        raw_dsm = normalized_depth * 100.0
        return {
            "mode": "MODE_A_UNCALIBRATED",
            "scale": 100.0,
            "offset": 0.0,
            "valid_points": int(len(d_valid)),
            "residual_rmse": 0.0,
            "dsm": raw_dsm,
        }

    # Robust linear regression Z = S * D + B
    A = np.vstack([d_valid, np.ones_like(d_valid)]).T
    scale, offset = np.linalg.lstsq(A, z_valid, rcond=None)[0]

    predicted_valid = scale * d_valid + offset
    residual_rmse = float(np.sqrt(np.mean((predicted_valid - z_valid) ** 2)))
    calibrated_dsm = (scale * normalized_depth + offset).astype(np.float32)

    return {
        "mode": "MODE_B_CALIBRATED",
        "scale": float(scale),
        "offset": float(offset),
        "valid_points": int(len(d_valid)),
        "residual_rmse": residual_rmse,
        "dsm": calibrated_dsm,
    }
