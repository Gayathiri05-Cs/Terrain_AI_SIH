import { DepthAnalysisResult, GeospatialMetadata, ProcessingStage } from './depth';
import { FloodSimulationResult } from './flood';

export type CalibrationMode = 'MODE_A_UNCALIBRATED' | 'MODE_B_CALIBRATED';

export type ReferenceDataType = 'NONE' | 'SRTM_DEM' | 'GEOTIFF_DEM' | 'GCP_POINTS' | 'LIDAR_DSM';

/**
 * Land cover classes:
 * 0 = Ground
 * 1 = Building
 * 2 = Vegetation
 * 3 = Road
 * 4 = Water
 * 5 = Other
 */
export enum LandCoverClass {
  GROUND = 0,
  BUILDING = 1,
  VEGETATION = 2,
  ROAD = 3,
  WATER = 4,
  OTHER = 5,
}

export interface GroundControlPoint {
  id: string;
  name: string;
  normX: number; // [0..1]
  normY: number; // [0..1]
  lat?: number;
  lon?: number;
  referenceElevation: number;
  predictedDepth: number;
  calibratedElevation: number;
  residual: number;
  isInlier: boolean;
}

export interface CalibrationParameters {
  mode: CalibrationMode;
  referenceType: ReferenceDataType;
  scale: number; // S in Z = S * D + B
  offset: number; // B in Z = S * D + B
  validReferencePoints: number;
  inlierCount: number;
  calibrationResidualRmse: number;
  rSquared: number;
  gcps: GroundControlPoint[];
  statusMessage: string;
}

export interface ConfidenceStatistics {
  confidenceGrid: Float32Array; // [0..1]
  averageConfidence: number;
  highConfidencePercent: number; // >= 0.75
  mediumConfidencePercent: number; // 0.45 .. 0.75
  lowConfidencePercent: number; // < 0.45
}

export interface BuildingHeightRecord {
  id: string;
  centroidX: number; // [0..1]
  centroidY: number; // [0..1]
  gridMinX: number;
  gridMaxX: number;
  gridMinY: number;
  gridMaxY: number;
  roofMedianDsm: number;
  nearbyGroundDsm: number;
  estimatedHeight: number;
  footprintPixels: number;
  footprintSqMeters: number | null;
  confidence: number;
}

export interface ValidationMetrics {
  available: boolean;
  referenceSource: string;
  sampleCount: number;
  mae: number | null;
  rmse: number | null;
  correlation: number | null;
  bias: number | null;
  p90Error: number | null;
  scatterSamples: Array<{ reference: number; predicted: number; residual: number; landClass: LandCoverClass }>;
  message: string;
}

export interface TerrainAnalysisMetrics {
  minElevation: number;
  maxElevation: number;
  meanElevation: number;
  elevationRange: number;
  stdElevation: number;
  averageSlopeDegrees: number;
  maxSlopeDegrees: number;
  steepHazardPercent: number; // slope > 30 deg
  slopeGrid: Float32Array; // degrees [0..90]
  aspectGrid: Float32Array; // degrees [0..360]
  elevationHistogram: Array<{ binStart: number; binEnd: number; count: number; percentage: number }>;
  slopeHistogram: Array<{ label: string; range: string; count: number; percentage: number }>;
}

export interface TerrainProjectData {
  projectId: string;
  projectName: string;
  isDemoDataset: boolean;
  demoScenarioId?: string;
  inputFilename: string;
  originalImageWidth: number;
  originalImageHeight: number;
  gridWidth: number;
  gridHeight: number;
  rgbTextureDataUrl: string;
  rgbPixels: Uint8ClampedArray; // [gridHeight * gridWidth * 4]
  geospatial: GeospatialMetadata;
  stage: ProcessingStage;
  depth: DepthAnalysisResult;
  segmentationAvailable: boolean;
  segmentationGrid: Uint8Array; // LandCoverClass per pixel
  referenceDemGrid: Float32Array | null;
  calibration: CalibrationParameters;
  rawDsmGrid: Float32Array;
  refinedDsmGrid: Float32Array;
  edgeRefinementMethod: 'Guided Edge-Aware Filter' | 'Joint Bilateral Filter';
  confidence: ConfidenceStatistics;
  terrainAnalysis: TerrainAnalysisMetrics;
  buildings: BuildingHeightRecord[];
  validation: ValidationMetrics;
  initialFloodSimulation: FloodSimulationResult;
  timestamp: string;
}

export type MapLayerMode =
  | 'RGB_ORTHO'
  | 'HYPSOMETRIC_DSM'
  | 'RGB_DSM_BLEND'
  | 'SLOPE_GRADIENT'
  | 'CONFIDENCE_MAP'
  | 'LAND_COVER'
  | 'RAW_VS_REFINED_DIFF'
  | 'DEPTH_PLASMA';

export interface Terrain3DViewSettings {
  layerMode: MapLayerMode;
  useRefinedDsm: boolean;
  verticalExaggeration: number;
  wireframe: boolean;
  showWaterSurface: boolean;
  showContours: boolean;
  contourIntervalMeters: number;
  showBuildings3D: boolean;
  showGcpPins: boolean;
  showGeologicalSkirt: boolean;
  showCompassGrid: boolean;
  sunAzimuth: number;
  sunAltitude: number;
  meshSubdivisionStep: 1 | 2 | 4;
  crossSectionAxis: 'NONE' | 'X_AXIS' | 'Y_AXIS';
  crossSectionPosition: number; // [0..1]
  flythroughActive: boolean;
  flythroughSpeed: number;
  flythroughAltitudeOffset: number;
  flythroughPattern: 'ORBITAL_SURVEY' | 'VALLEY_CORRIDOR' | 'RIDGE_INSPECTION';
}

export interface ProbePointInspection {
  gridX: number;
  gridY: number;
  normX: number;
  normY: number;
  lat: number | null;
  lon: number | null;
  rawDsm: number;
  refinedDsm: number;
  relativeDepth: number;
  slopeDegrees: number;
  aspectDegrees: number;
  confidence: number;
  landCover: LandCoverClass;
  floodDepth: number;
  isFlooded: boolean;
}
