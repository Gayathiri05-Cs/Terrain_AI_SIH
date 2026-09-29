export type DepthModelVariant = 'SMALL' | 'BASE' | 'LARGE';

export type ProcessingStage =
  | 'IDLE'
  | 'QUEUED'
  | 'PROCESSING'
  | 'CALIBRATING'
  | 'REFINING'
  | 'GENERATING_DSM'
  | 'BUILDING_3D_MODEL'
  | 'COMPLETE'
  | 'ERROR';

export interface GeospatialMetadata {
  isGeoreferenced: boolean;
  crs: string | null;
  transform: [number, number, number, number, number, number] | null; // [originX, pixelWidth, rotX, originY, rotY, pixelHeight]
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  resolutionMeters: number | null;
  width: number;
  height: number;
  format: 'JPG' | 'JPEG' | 'PNG' | 'GeoTIFF';
  statusNote: string;
}

export interface DepthAnalysisResult {
  modelVariant: DepthModelVariant;
  deviceUsed: 'CUDA GPU' | 'CPU Fallback' | 'WebGL Tensor Engine';
  inferenceTimeMs: number;
  gridWidth: number;
  gridHeight: number;
  rawDepth: Float32Array; // [gridHeight * gridWidth]
  normalizedDepth: Float32Array; // [0..1]
  minRelativeDepth: number;
  maxRelativeDepth: number;
  meanRelativeDepth: number;
  stdRelativeDepth: number;
}
