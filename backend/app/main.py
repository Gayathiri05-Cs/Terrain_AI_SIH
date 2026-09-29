from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import numpy as np

from app.models.depth_model import DepthAnythingV2Engine
from app.models.segmentation_model import PluggableSegmentationEngine
from app.processing.calibration import calibrate_depth_to_dsm
from app.processing.refinement import edge_aware_dsm_refinement
from app.processing.confidence import compute_confidence_map
from app.processing.terrain_analysis import analyze_terrain_surface
from app.processing.flood_simulation import simulate_elevation_flood
from app.utils.validation import evaluate_dsm_validation

app = FastAPI(
    title="TERRAIN-X Geospatial & 3D Terrain Backend",
    description="Single Image to 3D Terrain & Disaster Impact Analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singleton cached model instances (loaded ONCE at startup)
depth_engine = DepthAnythingV2Engine(default_variant="LARGE")
seg_engine = PluggableSegmentationEngine()


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "application": "TERRAIN-X",
        "device": depth_engine.device,
        "model_variant": depth_engine.active_variant,
        "model_cached": depth_engine.is_loaded,
    }
