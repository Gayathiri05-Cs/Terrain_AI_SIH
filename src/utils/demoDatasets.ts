import { DepthModelVariant, GeospatialMetadata } from '../types/depth';
import { LandCoverClass, ReferenceDataType, TerrainProjectData } from '../types/terrain';
import {
  analyzeTerrainDsm,
  calibrateTerrainDsm,
  computeConfidenceMap,
  computeSemanticSegmentation,
  computeValidationMetrics,
  extractBuildingHeights,
  predictRelativeDepth,
  refineDsmEdgeAware,
  simulateFloodImpact,
} from './calculations';

export interface DemoDatasetPreset {
  id: string;
  title: string;
  region: string;
  subtitle: string;
  filename: string;
  referenceType: ReferenceDataType;
  isGeoreferenced: boolean;
  crs: string | null;
  resolutionMeters: number | null;
  defaultWaterLevelOffset: number;
}

export const DEMO_DATASET_PRESETS: DemoDatasetPreset[] = [
  {
    id: 'alaknanda_valley',
    title: 'Alaknanda Himalayan Hydro Valley (Demo Dataset)',
    region: 'Chamoli Sector, Uttarakhand · 30.412°N, 79.321°E',
    subtitle: 'Georeferenced Aerial Ortho + SRTM 30m DEM + 16 Survey GCPs (Mode B Calibrated)',
    filename: 'CARTOSAT3_ALAKNANDA_VALLEY_ORTHO.tif',
    referenceType: 'SRTM_DEM',
    isGeoreferenced: true,
    crs: 'EPSG:32644 (WGS 84 / UTM Zone 44N)',
    resolutionMeters: 2.0,
    defaultWaterLevelOffset: 0.28,
  },
  {
    id: 'chennai_urban_basin',
    title: 'Adyar Coastal Urban Floodplain (Demo Dataset)',
    region: 'South Basin, Chennai · 13.011°N, 80.256°E',
    subtitle: 'High-Res Urban Aerial RGB + Airborne LiDAR Reference DSM (Mode B Calibrated)',
    filename: 'UAV_ADYAR_URBAN_CORRIDOR_DSM.tif',
    referenceType: 'LIDAR_DSM',
    isGeoreferenced: true,
    crs: 'EPSG:32644 (WGS 84 / UTM Zone 44N)',
    resolutionMeters: 1.2,
    defaultWaterLevelOffset: 0.34,
  },
  {
    id: 'western_ghats_uncalibrated',
    title: 'Western Ghats Escarpment Catchment (Demo Dataset)',
    region: 'Idukki Highlands · Non-Georeferenced Drone Frame',
    subtitle: 'Raw RGB Frame Only — No Reference DEM Supplied (Mode A Relative Structure)',
    filename: 'DRONE_FRAME_0842_RAW_RGB.jpg',
    referenceType: 'NONE',
    isGeoreferenced: false,
    crs: null,
    resolutionMeters: null,
    defaultWaterLevelOffset: 0.25,
  },
];

/**
 * Generates a complete, numerically evaluated TerrainProjectData for any of the 3 bundled Demo Datasets.
 */
export function buildDemoTerrainProject(
  scenarioId: string = 'alaknanda_valley',
  modelVariant: DepthModelVariant = 'LARGE',
  enableSegmentation: boolean = true,
  overrideReferenceType?: ReferenceDataType
): TerrainProjectData {
  const preset = DEMO_DATASET_PRESETS.find((p) => p.id === scenarioId) || DEMO_DATASET_PRESETS[0];
  const gridWidth = 128;
  const gridHeight = 128;
  const total = gridWidth * gridHeight;

  const rgbPixels = new Uint8ClampedArray(total * 4);
  const seedRelativeStructure = new Float32Array(total);
  const referenceDemGrid = new Float32Array(total);
  const explicitSeg = new Uint8Array(total);

  // Build deterministic, realistic terrain geometry + aerial RGB appearance
  for (let y = 0; y < gridHeight; y++) {
    const ny = y / (gridHeight - 1);
    for (let x = 0; x < gridWidth; x++) {
      const nx = x / (gridWidth - 1);
      const idx = y * gridWidth + x;

      if (preset.id === 'alaknanda_valley') {
        // Meandering river canyon running N->S with terraced valley benches and steep alpine walls
        const riverCenter = 0.48 + 0.14 * Math.sin(ny * Math.PI * 2.2 + 0.3) + 0.05 * Math.cos(ny * Math.PI * 4.5);
        const distToRiver = Math.abs(nx - riverCenter);
        const riverChannelWidth = 0.055 + 0.015 * Math.sin(ny * 5.0);

        // Canyon cross-profile
        const canyonSlope = Math.pow(Math.max(0, distToRiver - riverChannelWidth * 0.6), 1.35) * 2.4;
        const ridgeModulation =
          0.22 * Math.sin(nx * 9.5 + ny * 4.2) * Math.cos(ny * 7.8 - nx * 3.1) +
          0.11 * Math.sin(nx * 19.0 + ny * 15.0) * Math.min(1, distToRiver * 3.5) +
          0.18 * (1 - ny); // Higher elevation toward northern upstream boundary

        let normElev = Math.max(0.02, Math.min(0.96, 0.06 + canyonSlope + ridgeModulation));
        let landClass = LandCoverClass.GROUND;

        // River channel water
        if (distToRiver < riverChannelWidth) {
          normElev = 0.045 + (1 - ny) * 0.06;
          landClass = LandCoverClass.WATER;
        }
        // Valley road along eastern bank
        else if (Math.abs(nx - (riverCenter + riverChannelWidth + 0.035)) < 0.016) {
          landClass = LandCoverClass.ROAD;
        }
        // Alpine forest canopy bands on mid-slopes
        else if (distToRiver > 0.14 && distToRiver < 0.34 && Math.sin(nx * 32 + ny * 27) > -0.25) {
          landClass = LandCoverClass.VEGETATION;
          normElev += 0.025;
        }

        // Terraced settlement buildings along safe river benches
        const bldgClusters = [
          { cx: riverCenter - 0.12, cy: 0.28, w: 0.045, h: 0.035, dh: 0.065 },
          { cx: riverCenter - 0.15, cy: 0.36, w: 0.038, h: 0.032, dh: 0.055 },
          { cx: riverCenter + 0.13, cy: 0.44, w: 0.048, h: 0.036, dh: 0.072 },
          { cx: riverCenter + 0.16, cy: 0.52, w: 0.042, h: 0.034, dh: 0.060 },
          { cx: riverCenter - 0.11, cy: 0.64, w: 0.050, h: 0.038, dh: 0.078 },
          { cx: riverCenter + 0.11, cy: 0.74, w: 0.045, h: 0.035, dh: 0.068 },
          { cx: riverCenter - 0.16, cy: 0.79, w: 0.040, h: 0.030, dh: 0.052 },
          { cx: riverCenter + 0.18, cy: 0.22, w: 0.038, h: 0.030, dh: 0.058 },
        ];

        for (const b of bldgClusters) {
          if (Math.abs(nx - b.cx) < b.w * 0.5 && Math.abs(ny - b.cy) < b.h * 0.5) {
            landClass = LandCoverClass.BUILDING;
            normElev += b.dh;
            break;
          }
        }

        // Reference SRTM Metric Elevation in meters (540m valley floor to 895m ridges)
        const metricElev = 540.0 + normElev * 355.0;
        referenceDemGrid[idx] = metricElev + (Math.sin(x * 1.7 + y * 2.3) * 1.8);
        seedRelativeStructure[idx] = normElev;
        explicitSeg[idx] = landClass;

        // Synthesize realistic nadir satellite RGB color with directional sun hillshade
        const shade = 0.85 + 0.22 * Math.cos((nx - riverCenter) * 6.0 + 0.6);
        const microTex = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        const grain = (Math.abs(microTex) - 0.5) * 14;

        let r = 118, g = 112, b = 98;
        if (landClass === LandCoverClass.WATER) {
          r = 24;
          g = 94 + distToRiver * 180;
          b = 132 + distToRiver * 140;
        } else if (landClass === LandCoverClass.VEGETATION) {
          r = 42 * shade;
          g = 96 * shade;
          b = 52 * shade;
        } else if (landClass === LandCoverClass.BUILDING) {
          r = 212;
          g = 198;
          b = 186;
        } else if (landClass === LandCoverClass.ROAD) {
          r = 104;
          g = 108;
          b = 114;
        } else if (normElev > 0.74) {
          // High alpine scree / snow-dusted ridge
          const snowMix = Math.min(1, (normElev - 0.74) * 3.5);
          r = (132 * (1 - snowMix) + 225 * snowMix) * shade;
          g = (124 * (1 - snowMix) + 232 * snowMix) * shade;
          b = (116 * (1 - snowMix) + 242 * snowMix) * shade;
        } else {
          r = (128 + normElev * 35) * shade;
          g = (118 + normElev * 24) * shade;
          b = (96 + normElev * 18) * shade;
        }

        rgbPixels[idx * 4] = clampByte(r + grain);
        rgbPixels[idx * 4 + 1] = clampByte(g + grain);
        rgbPixels[idx * 4 + 2] = clampByte(b + grain);
        rgbPixels[idx * 4 + 3] = 255;
      } else if (preset.id === 'chennai_urban_basin') {
        // Coastal urban floodplain with tidal canal, arterial grid roads, commercial towers & residential blocks
        const canalY = 0.52 + 0.08 * Math.sin(nx * Math.PI * 2.0);
        const distCanal = Math.abs(ny - canalY);
        let normElev =
          0.14 +
          0.22 * Math.pow(Math.min(1, distCanal * 2.2), 1.1) +
          0.12 * nx +
          0.06 * Math.sin(nx * 6.0) * Math.cos(ny * 6.0);

        let landClass = LandCoverClass.GROUND;

        if (distCanal < 0.065) {
          normElev = 0.04 + nx * 0.02;
          landClass = LandCoverClass.WATER;
        } else if (
          Math.abs((nx * 6) % 1 - 0.5) < 0.07 ||
          Math.abs((ny * 6) % 1 - 0.5) < 0.07
        ) {
          landClass = LandCoverClass.ROAD;
        } else {
          // Urban block cells
          const cellX = Math.floor(nx * 6);
          const cellY = Math.floor(ny * 6);
          const inBlockX = (nx * 6) % 1;
          const inBlockY = (ny * 6) % 1;

          if (inBlockX > 0.18 && inBlockX < 0.82 && inBlockY > 0.18 && inBlockY < 0.82 && distCanal > 0.11) {
            const hash = ((cellX * 37 + cellY * 19) % 7) / 7;
            if (hash > 0.22) {
              landClass = LandCoverClass.BUILDING;
              const bldgHeightNorm = 0.18 + hash * 0.42;
              normElev += bldgHeightNorm;
            } else {
              landClass = LandCoverClass.VEGETATION;
              normElev += 0.05;
            }
          } else if (distCanal > 0.07 && distCanal < 0.12) {
            landClass = LandCoverClass.VEGETATION;
            normElev += 0.03;
          }
        }

        // Metric elevation: 2.5m coastal canal to 42.5m commercial structures
        const metricElev = 2.5 + normElev * 40.0;
        referenceDemGrid[idx] = metricElev + Math.cos(x * 1.9 - y * 1.4) * 0.45;
        seedRelativeStructure[idx] = normElev;
        explicitSeg[idx] = landClass;

        const micro = ((Math.sin(x * 17.3 + y * 41.7) * 9182.3) % 1) * 10;
        let r = 136, g = 132, b = 122;
        if (landClass === LandCoverClass.WATER) {
          r = 22;
          g = 86;
          b = 124;
        } else if (landClass === LandCoverClass.ROAD) {
          r = 82;
          g = 88;
          b = 96;
        } else if (landClass === LandCoverClass.BUILDING) {
          r = 205 + (normElev - 0.3) * 70;
          g = 194 + (normElev - 0.3) * 60;
          b = 182 + (normElev - 0.3) * 55;
        } else if (landClass === LandCoverClass.VEGETATION) {
          r = 46;
          g = 114;
          b = 58;
        }

        rgbPixels[idx * 4] = clampByte(r + micro);
        rgbPixels[idx * 4 + 1] = clampByte(g + micro);
        rgbPixels[idx * 4 + 2] = clampByte(b + micro);
        rgbPixels[idx * 4 + 3] = 255;
      } else {
        // Western Ghats Escarpment (Mode A Uncalibrated Drone RGB)
        const escarpment =
          0.48 * (1 / (1 + Math.exp(-(nx * 7 - 3.2 + 0.8 * Math.sin(ny * 5))))) +
          0.24 * Math.sin(nx * 8 + ny * 5) * Math.cos(ny * 7) +
          0.15 * (1 - ny);

        let normElev = Math.max(0.03, Math.min(0.95, escarpment));
        let landClass = LandCoverClass.VEGETATION;

        if (normElev < 0.16 && nx < 0.32) {
          landClass = LandCoverClass.WATER;
          normElev = 0.08;
        } else if (Math.abs(ny - (0.35 + 0.25 * nx)) < 0.022) {
          landClass = LandCoverClass.ROAD;
        } else if (normElev > 0.68) {
          landClass = LandCoverClass.GROUND;
        }

        seedRelativeStructure[idx] = normElev;
        referenceDemGrid[idx] = 310 + normElev * 240;
        explicitSeg[idx] = landClass;

        const shade = 0.82 + 0.25 * Math.cos(nx * 5 - ny * 3);
        let r = 52 * shade, g = 108 * shade, b = 56 * shade;
        if (landClass === LandCoverClass.WATER) {
          r = 28;
          g = 92;
          b = 116;
        } else if (landClass === LandCoverClass.ROAD) {
          r = 122;
          g = 114;
          b = 104;
        } else if (landClass === LandCoverClass.GROUND) {
          r = 156 * shade;
          g = 126 * shade;
          b = 98 * shade;
        }

        rgbPixels[idx * 4] = clampByte(r);
        rgbPixels[idx * 4 + 1] = clampByte(g);
        rgbPixels[idx * 4 + 2] = clampByte(b);
        rgbPixels[idx * 4 + 3] = 255;
      }
    }
  }

  const rgbTextureDataUrl = rgbaToDataUrl(rgbPixels, gridWidth, gridHeight);

  const activeReferenceType = overrideReferenceType !== undefined ? overrideReferenceType : preset.referenceType;
  const hasReference = activeReferenceType !== 'NONE';

  const geospatial: GeospatialMetadata = {
    isGeoreferenced: preset.isGeoreferenced,
    crs: preset.crs,
    transform: preset.isGeoreferenced ? [79.312, 0.000018, 0, 30.421, 0, -0.000018] : null,
    bounds: preset.isGeoreferenced
      ? { north: 30.421, south: 30.398, east: 79.335, west: 79.312 }
      : null,
    resolutionMeters: preset.resolutionMeters,
    width: 1024,
    height: 1024,
    format: preset.isGeoreferenced ? 'GeoTIFF' : 'JPG',
    statusNote: preset.isGeoreferenced
      ? `Georeferenced GeoTIFF (${preset.crs}) — ${preset.resolutionMeters}m GSD resolution.`
      : 'Non-georeferenced image — No CRS or affine geotransform in source metadata.',
  };

  // 1. Depth Anything V2 Relative Depth Prediction
  const depth = predictRelativeDepth(rgbPixels, gridWidth, gridHeight, modelVariant, seedRelativeStructure);

  // 2. Semantic Segmentation (or combine explicit + spectral when enabled)
  const computedSeg = computeSemanticSegmentation(rgbPixels, depth.normalizedDepth, gridWidth, gridHeight);
  const segmentationGrid = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    segmentationGrid[i] = explicitSeg[i] !== LandCoverClass.GROUND ? explicitSeg[i] : computedSeg[i];
  }

  // 3. Terrain-Aware Calibration (Mode A vs Mode B)
  const { calibration, rawDsmGrid } = calibrateTerrainDsm(
    depth.normalizedDepth,
    enableSegmentation ? segmentationGrid : null,
    gridWidth,
    gridHeight,
    activeReferenceType,
    hasReference ? referenceDemGrid : null,
    null
  );

  // 4. Edge-Aware DSM Refinement
  const refinedDsmGrid = refineDsmEdgeAware(
    rawDsmGrid,
    rgbPixels,
    enableSegmentation ? segmentationGrid : null,
    gridWidth,
    gridHeight
  );

  // 5. Pixel-Level Confidence Map
  const confidence = computeConfidenceMap(
    rawDsmGrid,
    refinedDsmGrid,
    enableSegmentation ? segmentationGrid : null,
    calibration,
    gridWidth,
    gridHeight
  );

  // 6. Terrain & Slope Analysis
  const terrainAnalysis = analyzeTerrainDsm(
    refinedDsmGrid,
    gridWidth,
    gridHeight,
    geospatial.resolutionMeters || 2.0
  );

  // 7. Building Height Analysis
  const buildings = enableSegmentation
    ? extractBuildingHeights(
        refinedDsmGrid,
        segmentationGrid,
        confidence.confidenceGrid,
        gridWidth,
        gridHeight,
        geospatial.resolutionMeters
      )
    : [];

  // 8. Empirical Validation
  const validation = computeValidationMetrics(
    refinedDsmGrid,
    hasReference ? referenceDemGrid : null,
    enableSegmentation ? segmentationGrid : null,
    calibration,
    gridWidth,
    gridHeight
  );

  // 9. Initial Elevation-Based Flood Impact Simulation
  const defaultWaterLevel =
    terrainAnalysis.minElevation + terrainAnalysis.elevationRange * preset.defaultWaterLevelOffset;
  const initialFloodSimulation = simulateFloodImpact(
    refinedDsmGrid,
    defaultWaterLevel,
    terrainAnalysis.minElevation,
    terrainAnalysis.maxElevation,
    buildings,
    gridWidth,
    gridHeight,
    geospatial.resolutionMeters
  );

  return {
    projectId: `TX-${preset.id.toUpperCase()}-${Date.now().toString().slice(-4)}`,
    projectName: preset.title,
    isDemoDataset: true,
    demoScenarioId: preset.id,
    inputFilename: preset.filename,
    originalImageWidth: geospatial.width,
    originalImageHeight: geospatial.height,
    gridWidth,
    gridHeight,
    rgbTextureDataUrl,
    rgbPixels,
    geospatial,
    stage: 'COMPLETE',
    depth,
    segmentationAvailable: enableSegmentation,
    segmentationGrid,
    referenceDemGrid: hasReference ? referenceDemGrid : null,
    calibration,
    rawDsmGrid,
    refinedDsmGrid,
    edgeRefinementMethod: 'Guided Edge-Aware Filter',
    confidence,
    terrainAnalysis,
    buildings,
    validation,
    initialFloodSimulation,
    timestamp: new Date().toISOString(),
  };
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function rgbaToDataUrl(rgba: Uint8ClampedArray, width: number, height: number): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}
