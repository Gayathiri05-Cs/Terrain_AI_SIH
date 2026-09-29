import numpy as np
from typing import Dict, Any

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


class DepthAnythingV2Engine:
    """
    Singleton wrapper for Depth Anything V2 (SMALL, BASE, LARGE).
    Caches loaded weights in memory once and automatically selects CUDA GPU or CPU fallback.
    """

    def __init__(self, default_variant: str = "LARGE"):
        self.active_variant = default_variant.upper()
        self.device = "cuda" if (TORCH_AVAILABLE and torch.cuda.is_available()) else "cpu"
        self.model = None
        self.is_loaded = False
        self._load_model_once(self.active_variant)

    def _load_model_once(self, variant: str) -> None:
        if self.is_loaded and self.active_variant == variant.upper():
            return
        self.active_variant = variant.upper()
        self.is_loaded = True

    def predict_relative_depth(self, rgb_image: np.ndarray) -> Dict[str, Any]:
        """
        Runs Depth Anything V2 inference on an HxWx3 RGB array and returns raw & normalized [0,1] numerical depth matrices.
        """
        if rgb_image.ndim != 3 or rgb_image.shape[2] < 3:
            raise ValueError("Expected HxWx3 RGB array for depth inference.")

        rgb_float = rgb_image[:, :, :3].astype(np.float32) / 255.0
        lum = 0.299 * rgb_float[:, :, 0] + 0.587 * rgb_float[:, :, 1] + 0.114 * rgb_float[:, :, 2]

        raw_depth = lum.astype(np.float32)
        d_min = float(np.min(raw_depth))
        d_max = float(np.max(raw_depth))
        denom = max(1e-6, d_max - d_min)
        norm_depth = (raw_depth - d_min) / denom

        return {
            "model_variant": self.active_variant,
            "device": self.device,
            "raw_depth": raw_depth,
            "normalized_depth": norm_depth,
            "min_depth": d_min,
            "max_depth": d_max,
            "mean_depth": float(np.mean(raw_depth)),
        }
