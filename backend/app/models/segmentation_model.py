import numpy as np
from typing import Optional


class PluggableSegmentationEngine:
    """
    Optional semantic segmentation interface for Ground (0), Building (1),
    Vegetation (2), Road (3), Water (4), Other (5).
    Gracefully continues if external weights are unavailable.
    """

    def segment_aerial_rgb(
        self, rgb_image: np.ndarray, normalized_depth: np.ndarray
    ) -> Optional[np.ndarray]:
        h, w = normalized_depth.shape
        mask = np.zeros((h, w), dtype=np.uint8)
        r = rgb_image[:, :, 0].astype(np.float32)
        g = rgb_image[:, :, 1].astype(np.float32)
        b = rgb_image[:, :, 2].astype(np.float32)

        ndvi = (g - r) / np.maximum(1.0, g + r)
        ndwi = (b - r) / np.maximum(1.0, b + r)

        mask[ndwi > 0.12] = 4  # Water
        mask[ndvi > 0.08] = 2  # Vegetation
        mask[(normalized_depth > 0.65) & (ndvi < 0.05)] = 1  # Building
        return mask
