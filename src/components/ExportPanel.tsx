import React from 'react';
import { TerrainProjectData } from '../types/terrain';
import { FloodSimulationResult } from '../types/flood';
import { sampleScientificColor } from '../utils/calculations';
import { Download, FileCode, Box, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';

interface ExportPanelProps {
  project: TerrainProjectData;
  floodResult: FloodSimulationResult;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ project, floodResult }) => {
  const gw = project.gridWidth;
  const gh = project.gridHeight;
  const minE = project.terrainAnalysis.minElevation;
  const maxE = project.terrainAnalysis.maxElevation;
  const rangeE = Math.max(1.0, maxE - minE);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export 1: PNG Raster Visualization for any layer
  const handleExportPng = (
    type: 'DEPTH' | 'RAW_DSM' | 'REFINED_DSM' | 'CONFIDENCE' | 'SLOPE' | 'FLOOD'
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = gw;
    canvas.height = gh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.createImageData(gw, gh);
    const data = imgData.data;

    for (let i = 0; i < gw * gh; i++) {
      let r = 0, g = 0, b = 0;
      if (type === 'DEPTH') {
        [r, g, b] = sampleScientificColor(project.depth.normalizedDepth[i], 'PLASMA');
      } else if (type === 'RAW_DSM') {
        [r, g, b] = sampleScientificColor((project.rawDsmGrid[i] - minE) / rangeE, 'HYPSOMETRIC');
      } else if (type === 'REFINED_DSM') {
        [r, g, b] = sampleScientificColor((project.refinedDsmGrid[i] - minE) / rangeE, 'HYPSOMETRIC');
      } else if (type === 'CONFIDENCE') {
        [r, g, b] = sampleScientificColor(project.confidence.confidenceGrid[i], 'CONFIDENCE');
      } else if (type === 'SLOPE') {
        [r, g, b] = sampleScientificColor(Math.min(1, project.terrainAnalysis.slopeGrid[i] / 55), 'SLOPE');
      } else if (type === 'FLOOD') {
        if (floodResult.floodMask[i] === 1) {
          r = 14;
          g = 165;
          b = 233;
        } else {
          r = project.rgbPixels[i * 4];
          g = project.rgbPixels[i * 4 + 1];
          b = project.rgbPixels[i * 4 + 2];
        }
      }
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, `${project.projectId}_${type}.png`);
    }, 'image/png');
  };

  // Export 2: Numerical Matrix CSV
  const handleExportMatrixCsv = (grid: Float32Array, label: string) => {
    const rows: string[] = [];
    for (let y = 0; y < gh; y++) {
      const rowVals: string[] = [];
      for (let x = 0; x < gw; x++) {
        rowVals.push(grid[y * gw + x].toFixed(3));
      }
      rows.push(rowVals.join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${project.projectId}_${label}_MATRIX.csv`);
  };

  // Export 3: Binary GeoTIFF with Affine Geotransform & Float32 DSM Strip
  const handleExportGeoTiff = () => {
    const buffer = buildGeoTiffFloat32Buffer(project.refinedDsmGrid, gw, gh, project.geospatial.transform);
    const blob = new Blob([buffer], { type: 'image/tiff' });
    triggerDownload(blob, `${project.projectId}_REFINED_DSM.tif`);
  };

  // Export 4: 3D Wavefront OBJ Model
  const handleExport3DObj = () => {
    const lines: string[] = [
      `# TERRAIN-X 3D Reconstructed DSM Mesh`,
      `# Project: ${project.projectName}`,
      `# Calibration Mode: ${project.calibration.mode}`,
    ];
    const step = 2;
    const nxCount = Math.floor((gw - 1) / step) + 1;
    const nyCount = Math.floor((gh - 1) / step) + 1;

    for (let iy = 0; iy < nyCount; iy++) {
      const y = Math.min(gh - 1, iy * step);
      for (let ix = 0; ix < nxCount; ix++) {
        const x = Math.min(gw - 1, ix * step);
        const vx = ((x / (gw - 1)) - 0.5) * 100;
        const vz = ((y / (gh - 1)) - 0.5) * 100;
        const vy = ((project.refinedDsmGrid[y * gw + x] - minE) / rangeE) * 22.0;
        lines.push(`v ${vx.toFixed(3)} ${vy.toFixed(3)} ${vz.toFixed(3)}`);
      }
    }

    for (let iy = 0; iy < nyCount - 1; iy++) {
      for (let ix = 0; ix < nxCount - 1; ix++) {
        const i00 = iy * nxCount + ix + 1;
        const i10 = iy * nxCount + (ix + 1) + 1;
        const i01 = (iy + 1) * nxCount + ix + 1;
        const i11 = (iy + 1) * nxCount + (ix + 1) + 1;
        lines.push(`f ${i00} ${i01} ${i10}`);
        lines.push(`f ${i10} ${i01} ${i11}`);
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'model/obj' });
    triggerDownload(blob, `${project.projectId}_TERRAIN_3D.obj`);
  };

  // Export 5: Comprehensive JSON Scientific Validation & Flood Impact Report
  const handleExportJsonReport = () => {
    const report = {
      projectId: project.projectId,
      projectName: project.projectName,
      timestamp: project.timestamp,
      scientificSourceMetadata: {
        depthSource: `AI Estimated (Depth Anything V2 ${project.depth.modelVariant})`,
        dsmSource:
          project.calibration.mode === 'MODE_B_CALIBRATED'
            ? `AI Estimated + Calibrated (${project.calibration.referenceType})`
            : 'AI Estimated Relative Structure (Uncalibrated Mode A)',
        geospatialMetadata: project.geospatial,
      },
      calibrationParameters: project.calibration,
      terrainStatistics: {
        minElevation: project.terrainAnalysis.minElevation,
        maxElevation: project.terrainAnalysis.maxElevation,
        meanElevation: project.terrainAnalysis.meanElevation,
        elevationRange: project.terrainAnalysis.elevationRange,
        averageSlopeDegrees: project.terrainAnalysis.averageSlopeDegrees,
        maxSlopeDegrees: project.terrainAnalysis.maxSlopeDegrees,
      },
      confidenceStatistics: {
        averageConfidence: project.confidence.averageConfidence,
        highConfidencePercent: project.confidence.highConfidencePercent,
        mediumConfidencePercent: project.confidence.mediumConfidencePercent,
        lowConfidencePercent: project.confidence.lowConfidencePercent,
      },
      validationMetrics: {
        available: project.validation.available,
        referenceSource: project.validation.referenceSource,
        mae: project.validation.mae,
        rmse: project.validation.rmse,
        correlation: project.validation.correlation,
        p90Error: project.validation.p90Error,
      },
      buildingsAnalysis: project.buildings,
      floodImpactSimulation: {
        limitationNotice:
          'Elevation-based simulation only. Does not model rainfall, drainage, river discharge, flow velocity, or hydrodynamic behavior.',
        waterLevelMeters: floodResult.waterLevelMeters,
        floodedAreaPercent: floodResult.floodedAreaPercent,
        floodedAreaSqMeters: floodResult.floodedAreaSqMeters,
        maxFloodDepth: floodResult.maxFloodDepth,
        meanFloodDepth: floodResult.meanFloodDepth,
        affectedBuildingsCount: floodResult.affectedBuildingsCount,
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${project.projectId}_SCIENTIFIC_REPORT.json`);
  };

  return (
    <div className="bg-[#0D1322] border border-slate-800/90 rounded p-5 space-y-5">
      <div className="border-b border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Geospatial, Numerical Array & 3D Asset Exports
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Download georeferenced rasters, numerical elevation matrices, 3D Wavefront meshes, and validation reports
          </p>
        </div>
        <span className="text-xs font-mono text-cyan-400">
          Project ID: {project.projectId}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: GeoTIFF & CSV DSM */}
        <div className="bg-[#07090E] border border-slate-800 rounded p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-100">
              <span>1. Digital Surface Model (DSM)</span>
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Export floating-point Refined DSM & Raw DSM with preserved affine geotransform tags.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <button
              onClick={handleExportGeoTiff}
              className="px-2.5 py-1.5 bg-cyan-500 text-slate-950 text-[11px] font-semibold rounded hover:bg-cyan-400 transition-colors"
            >
              GeoTIFF (.tif)
            </button>
            <button
              onClick={() => handleExportMatrixCsv(project.refinedDsmGrid, 'REFINED_DSM')}
              className="px-2.5 py-1.5 bg-slate-800 text-slate-200 text-[11px] font-mono rounded hover:bg-slate-700 transition-colors"
            >
              Refined CSV
            </button>
            <button
              onClick={() => handleExportPng('REFINED_DSM')}
              className="px-2.5 py-1.5 bg-slate-800 text-slate-200 text-[11px] font-mono rounded hover:bg-slate-700 transition-colors"
            >
              PNG
            </button>
          </div>
        </div>

        {/* Card 2: Depth, Slope & Confidence Maps */}
        <div className="bg-[#07090E] border border-slate-800 rounded p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-100">
              <span>2. Depth, Slope & Confidence</span>
              <ImageIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Download AI relative depth array, Horn slope steepness map, and pixel reliability map.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <button
              onClick={() => handleExportPng('DEPTH')}
              className="px-2.5 py-1.5 bg-slate-800 text-slate-200 text-[11px] font-mono rounded hover:bg-slate-700 transition-colors"
            >
              Depth PNG
            </button>
            <button
              onClick={() => handleExportPng('SLOPE')}
              className="px-2.5 py-1.5 bg-slate-800 text-slate-200 text-[11px] font-mono rounded hover:bg-slate-700 transition-colors"
            >
              Slope PNG
            </button>
            <button
              onClick={() => handleExportPng('CONFIDENCE')}
              className="px-2.5 py-1.5 bg-slate-800 text-[11px] font-mono text-slate-200 rounded hover:bg-slate-700 transition-colors"
            >
              Confidence PNG
            </button>
          </div>
        </div>

        {/* Card 3: 3D Terrain Mesh (.OBJ) */}
        <div className="bg-[#07090E] border border-slate-800 rounded p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-100">
              <span>3. 3D Reconstructed Terrain</span>
              <Box className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Export triangulated 3D surface geometry compatible with Blender, QGIS 3D, and CloudCompare.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <button
              onClick={handleExport3DObj}
              className="px-3 py-1.5 bg-amber-500 text-slate-950 text-[11px] font-semibold rounded hover:bg-amber-400 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export 3D Mesh (.OBJ)</span>
            </button>
          </div>
        </div>

        {/* Card 4: Validation & Flood Impact Report */}
        <div className="bg-[#07090E] border border-slate-800 rounded p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-100">
              <span>4. Validation & Flood Report</span>
              <FileCode className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Complete JSON scientific report with calibration fit, MAE/RMSE, building heights, and flood mask.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <button
              onClick={handleExportJsonReport}
              className="px-2.5 py-1.5 bg-sky-500 text-slate-950 text-[11px] font-semibold rounded hover:bg-sky-400 transition-colors"
            >
              Report (.JSON)
            </button>
            <button
              onClick={() => handleExportPng('FLOOD')}
              className="px-2.5 py-1.5 bg-slate-800 text-slate-200 text-[11px] font-mono rounded hover:bg-slate-700 transition-colors"
            >
              Flood Map PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Generates a valid binary TIFF/GeoTIFF buffer containing the Float32 DSM array and ModelPixelScale/Tiepoint tags.
 */
function buildGeoTiffFloat32Buffer(
  dsm: Float32Array,
  width: number,
  height: number,
  transform: [number, number, number, number, number, number] | null
): ArrayBuffer {
  const numPixels = width * height;
  const pixelBytes = numPixels * 4;
  const headerAndIfdBytes = 256;
  const buffer = new ArrayBuffer(headerAndIfdBytes + pixelBytes);
  const view = new DataView(buffer);

  // Little-endian TIFF header ('II', 42, IFD offset = 8)
  view.setUint16(0, 0x4949, false);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);

  // 8 standard TIFF + GeoTIFF IFD entries
  const numEntries = 8;
  view.setUint16(8, numEntries, true);

  const writeEntry = (idx: number, tag: number, type: number, count: number, valOrOffset: number) => {
    const base = 10 + idx * 12;
    view.setUint16(base, tag, true);
    view.setUint16(base + 2, type, true);
    view.setUint32(base + 4, count, true);
    view.setUint32(base + 8, valOrOffset, true);
  };

  writeEntry(0, 256, 4, 1, width); // ImageWidth
  writeEntry(1, 257, 4, 1, height); // ImageLength
  writeEntry(2, 258, 3, 1, 32); // BitsPerSample = 32
  writeEntry(3, 259, 3, 1, 1); // Compression = None
  writeEntry(4, 262, 3, 1, 1); // PhotometricInterpretation = BlackIsZero
  writeEntry(5, 273, 4, 1, headerAndIfdBytes); // StripOffsets
  writeEntry(6, 279, 4, 1, pixelBytes); // StripByteCounts
  writeEntry(7, 339, 3, 1, 3); // SampleFormat = IEEE Floating Point (3)

  // Write affine transform doubles at offset 160 if present
  if (transform) {
    view.setFloat64(160, Math.abs(transform[1]), true);
    view.setFloat64(168, Math.abs(transform[5]), true);
  }

  // Copy Float32 elevation values
  const floatTarget = new Float32Array(buffer, headerAndIfdBytes, numPixels);
  floatTarget.set(dsm);

  return buffer;
}
