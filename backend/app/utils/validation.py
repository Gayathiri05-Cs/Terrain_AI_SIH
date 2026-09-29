import numpy as np
from typing import Dict, Any, Optional


def evaluate_dsm_validation(
    predicted_dsm: np.ndarray,
    reference_dsm: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    """
    Computes empirical MAE, RMSE, and Pearson correlation when reference data is supplied.
    """
    if reference_dsm is None:
        return {
            "available": False,
            "mae": None,
            "rmse": None,
            "correlation": None,
            "message": "Validation unavailable — no reference elevation data supplied.",
        }

    valid = np.isfinite(predicted_dsm) & np.isfinite(reference_dsm)
    p = predicted_dsm[valid].ravel()
    r = reference_dsm[valid].ravel()

    if len(p) == 0:
        return {
            "available": False,
            "mae": None,
            "rmse": None,
            "correlation": None,
            "message": "Validation unavailable — no reference elevation data supplied.",
        }

    mae = float(np.mean(np.abs(p - r)))
    rmse = float(np.sqrt(np.mean((p - r) ** 2)))
    corr = float(np.corrcoef(p, r)[0, 1]) if len(p) > 1 else 0.0

    return {
        "available": True,
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "correlation": round(corr, 4),
    }
