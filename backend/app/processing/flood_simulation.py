import numpy as np
from typing import Dict, Any


def simulate_elevation_flood(dsm: np.ndarray, water_level: float) -> Dict[str, Any]:
    """
    Elevation-based flood impact simulator:
    if terrainElevation <= waterLevel:
        flooded = True
        floodDepth = waterLevel - terrainElevation
    else:
        flooded = False
        floodDepth = 0
    """
    flood_mask = dsm <= water_level
    flood_depth = np.where(flood_mask, water_level - dsm, 0.0).astype(np.float32)

    flooded_count = int(np.sum(flood_mask))
    total_count = int(dsm.size)
    flooded_pct = (flooded_count / total_count) * 100.0 if total_count > 0 else 0.0
    max_depth = float(np.max(flood_depth)) if flooded_count > 0 else 0.0
    avg_depth = float(np.mean(flood_depth[flood_mask])) if flooded_count > 0 else 0.0

    return {
        "water_level": float(water_level),
        "flooded_mask": flood_mask,
        "flood_depth": flood_depth,
        "flooded_count": flooded_count,
        "total_count": total_count,
        "flooded_area_percent": round(flooded_pct, 2),
        "max_flood_depth": round(max_depth, 2),
        "average_flood_depth": round(avg_depth, 2),
        "limitation": "Elevation-based simulation only. Does not model rainfall, drainage, river discharge, flow velocity, or hydrodynamic behavior.",
    }
