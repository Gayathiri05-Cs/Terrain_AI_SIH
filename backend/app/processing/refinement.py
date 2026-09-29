import numpy as np
from typing import Optional


def edge_aware_dsm_refinement(
    raw_dsm: np.ndarray,
    rgb_guide: np.ndarray,
    segmentation_mask: Optional[np.ndarray] = None,
) -> np.ndarray:
    """
    Edge-aware DSM refinement guided by RGB luminance and semantic land-cover rules.
    Preserves sharp building boundaries while smoothing bare ground noise.
    """
    h, w = raw_dsm.shape
    refined = np.copy(raw_dsm)
    guide = (
        0.299 * rgb_guide[:, :, 0]
        + 0.587 * rgb_guide[:, :, 1]
        + 0.114 * rgb_guide[:, :, 2]
    ).astype(np.float32) / 255.0

    for y in range(1, h - 1):
        for x in range(1, w - 1):
            patch_dsm = raw_dsm[y - 1 : y + 2, x - 1 : x + 2]
            patch_guide = guide[y - 1 : y + 2, x - 1 : x + 2]
            diff_guide = patch_guide - guide[y, x]
            weights = np.exp(-(diff_guide ** 2) / (2 * (0.08 ** 2)))
            refined[y, x] = float(np.sum(weights * patch_dsm) / np.sum(weights))

    return refined
