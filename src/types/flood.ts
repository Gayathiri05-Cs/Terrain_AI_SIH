export interface FloodSimulationResult {
  waterLevelMeters: number;
  minAllowedLevel: number;
  maxAllowedLevel: number;
  floodedPixelCount: number;
  totalPixelCount: number;
  floodedAreaPercent: number;
  floodedAreaSqMeters: number | null; // Only non-null when georeferenced / metric resolution known
  maxFloodDepth: number;
  meanFloodDepth: number; // Across flooded pixels
  affectedBuildingsCount: number;
  totalBuildingsCount: number;
  affectedBuildingIds: string[];
  floodMask: Uint8Array; // 1 = flooded, 0 = dry
  floodDepthGrid: Float32Array; // waterLevel - elevation where flooded, else 0
}

export interface FloodAnimationState {
  isPlaying: boolean;
  speedMultiplier: number; // 0.5x, 1x, 2x, 4x
  currentWaterLevel: number;
}
