import numpy as np
from typing import Dict, Any


def analyze_terrain_surface(dsm: np.ndarray, pixel_spacing_meters: float = 2.0) -> Dict[str, Any]:
    """
    Calculates elevation statistics and surface slope gradient in degrees.
    """
    min_elev = float(np.min(dsm))
    max_elev = float(np.max(dsm))
    mean_elev = float(np.mean(dsm))
    elev_range = max_elev - min_elev

    gy, gx = np.gradient(dsm, max(0.5, pixel_spacing_meters))
    slope_rad = np.arctan(np.sqrt(gx ** 2 + gy ** 2))
    slope_deg = np.degrees(slope_rad)

    return {
        "min_elevation": round(min_elev, 2),
        "max_elevation": round(max_elev, 2),
        "mean_elevation": round(mean_elev, 2),
        "elevation_range": round(elev_range, 2),
        "average_slope": round(float(np.mean(slope_deg)), 2),
        "max_slope": round(float(np.max(slope_deg)), 2),
        "slope_grid": slope_deg.astype(np.float32),
    }
