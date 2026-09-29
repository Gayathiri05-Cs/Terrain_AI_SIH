import numpy as np
from typing import Dict, Any, Optional


def compute_confidence_map(
    raw_dsm: np.ndarray,
    refined_dsm: np.ndarray,
    segmentation_mask: Optional[np.ndarray] = None,
    is_calibrated: bool = True,
) -> Dict[str, Any]:
    """
    Calculates pixel-level confidence in [0, 1] and summary percentages.
    """
    z_range = max(1.0, float(np.max(refined_dsm) - np.min(refined_dsm)))
    gy, gx = np.gradient(refined_dsm / z_range)
    grad_mag = np.sqrt(gx ** 2 + gy ** 2)
    refine_delta = np.abs(raw_dsm - refined_dsm) / z_range

    base_score = 0.90 if is_calibrated else 0.62
    conf = np.clip(base_score - grad_mag * 2.5 - refine_delta * 2.0, 0.08, 0.99)

    if segmentation_mask is not None:
        conf = np.where(segmentation_mask == 4, conf * 0.45, conf)

    total = conf.size
    high_pct = float(np.sum(conf >= 0.75) / total * 100.0)
    med_pct = float(np.sum((conf >= 0.45) & (conf < 0.75)) / total * 100.0)
    low_pct = float(np.sum(conf < 0.45) / total * 100.0)

    return {
        "confidence_grid": conf.astype(np.float32),
        "average_confidence": float(np.mean(conf)),
        "high_confidence_percent": round(high_pct, 2),
        "medium_confidence_percent": round(med_pct, 2),
        "low_confidence_percent": round(low_pct, 2),
    }
