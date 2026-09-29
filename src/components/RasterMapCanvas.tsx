import React, { useEffect, useRef, useState } from 'react';
import { LandCoverClass, TerrainProjectData } from '../types/terrain';
import { FloodSimulationResult } from '../types/flood';
import {
  getLandCoverColor,
  getLandCoverLabel,
  sampleScientificColor,
} from '../utils/calculations';

export type RasterVisualMode =
  | 'RGB'
  | 'DEPTH_GRAY'
  | 'DEPTH_PLASMA'
  | 'RAW_DSM'
  | 'REFINED_DSM'
  | 'SLOPE'
  | 'CONFIDENCE'
  | 'SEGMENTATION'
  | 'FLOOD_MAP';

interface RasterMapCanvasProps {
  project: TerrainProjectData;
  mode: RasterVisualMode;
  floodResult?: FloodSimulationResult;
  title: string;
  subtitle?: string;
  sourceBadge: string;
  heightClass?: string;
}

export const RasterMapCanvas: React.FC<RasterMapCanvasProps> = ({
  project,
  mode,
  floodResult,
  title,
  subtitle,
  sourceBadge,
  heightClass = 'h-60',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverText, setHoverText] = useState<string | null>(null);

  const gw = project.gridWidth;
  const gh = project.gridHeight;
  const minE = project.terrainAnalysis.minElevation;
  const maxE = project.terrainAnalysis.maxElevation;
  const rangeE = Math.max(1.0, maxE - minE);
  const elevUnit = project.calibration.mode === 'MODE_B_CALIBRATED' ? 'm' : 'rel';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = gw;
    canvas.height = gh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(gw, gh);
    const data = imgData.data;
    const total = gw * gh;

    for (let i = 0; i < total; i++) {
      let r = 0, g = 0, b = 0;

      if (mode === 'RGB') {
        r = project.rgbPixels[i * 4];
        g = project.rgbPixels[i * 4 + 1];
        b = project.rgbPixels[i * 4 + 2];
      } else if (mode === 'DEPTH_GRAY') {
        const v = Math.round(project.depth.normalizedDepth[i] * 255);
        r = v;
        g = v;
        b = v;
      } else if (mode === 'DEPTH_PLASMA') {
        [r, g, b] = sampleScientificColor(project.depth.normalizedDepth[i], 'PLASMA');
      } else if (mode === 'RAW_DSM') {
        const norm = (project.rawDsmGrid[i] - minE) / rangeE;
        [r, g, b] = sampleScientificColor(norm, 'HYPSOMETRIC');
      } else if (mode === 'REFINED_DSM') {
        const norm = (project.refinedDsmGrid[i] - minE) / rangeE;
        [r, g, b] = sampleScientificColor(norm, 'HYPSOMETRIC');
      } else if (mode === 'SLOPE') {
        const norm = Math.min(1, project.terrainAnalysis.slopeGrid[i] / 55);
        [r, g, b] = sampleScientificColor(norm, 'SLOPE');
      } else if (mode === 'CONFIDENCE') {
        [r, g, b] = sampleScientificColor(project.confidence.confidenceGrid[i], 'CONFIDENCE');
      } else if (mode === 'SEGMENTATION') {
        [r, g, b] = getLandCoverColor(project.segmentationGrid[i] as LandCoverClass);
      } else if (mode === 'FLOOD_MAP') {
        const rOrig = project.rgbPixels[i * 4];
        const gOrig = project.rgbPixels[i * 4 + 1];
        const bOrig = project.rgbPixels[i * 4 + 2];
        if (floodResult && floodResult.floodMask[i] === 1) {
          const depthRatio = Math.min(1, floodResult.floodDepthGrid[i] / Math.max(1, floodResult.maxFloodDepth));
          r = Math.round(rOrig * 0.25 + (14 + (1 - depthRatio) * 35) * 0.75);
          g = Math.round(gOrig * 0.25 + (116 + (1 - depthRatio) * 80) * 0.75);
          b = Math.round(bOrig * 0.25 + (215 + (1 - depthRatio) * 35) * 0.75);
        } else {
          r = rOrig;
          g = gOrig;
          b = bOrig;
        }
      }

      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
  }, [project, mode, floodResult, gw, gh, minE, rangeE]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const gx = Math.min(gw - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * gw)));
    const gy = Math.min(gh - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * gh)));
    const idx = gy * gw + gx;

    if (mode === 'DEPTH_GRAY' || mode === 'DEPTH_PLASMA') {
      setHoverText(`(${gx},${gy}) · Rel Depth: ${project.depth.normalizedDepth[idx].toFixed(3)}`);
    } else if (mode === 'RAW_DSM') {
      setHoverText(`(${gx},${gy}) · Raw DSM: ${project.rawDsmGrid[idx].toFixed(2)} ${elevUnit}`);
    } else if (mode === 'REFINED_DSM') {
      setHoverText(`(${gx},${gy}) · Refined DSM: ${project.refinedDsmGrid[idx].toFixed(2)} ${elevUnit}`);
    } else if (mode === 'SLOPE') {
      setHoverText(`(${gx},${gy}) · Slope: ${project.terrainAnalysis.slopeGrid[idx].toFixed(1)}°`);
    } else if (mode === 'CONFIDENCE') {
      setHoverText(`(${gx},${gy}) · Conf: ${(project.confidence.confidenceGrid[idx] * 100).toFixed(0)}%`);
    } else if (mode === 'SEGMENTATION') {
      setHoverText(`(${gx},${gy}) · ${getLandCoverLabel(project.segmentationGrid[idx] as LandCoverClass)}`);
    } else if (mode === 'FLOOD_MAP' && floodResult) {
      const d = floodResult.floodDepthGrid[idx];
      setHoverText(`(${gx},${gy}) · ${d > 0 ? `Flood Depth: ${d.toFixed(2)} ${elevUnit}` : 'Dry Ground'}`);
    } else {
      setHoverText(`(${gx},${gy}) · RGB (${project.rgbPixels[idx * 4]}, ${project.rgbPixels[idx * 4 + 1]}, ${project.rgbPixels[idx * 4 + 2]})`);
    }
  };

  return (
    <div className="bg-[#0D1322] border border-slate-800/90 rounded p-3.5 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="text-xs font-semibold text-slate-100">{title}</h4>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-[11px] font-mono text-cyan-400 shrink-0">{sourceBadge}</span>
      </div>

      <div className={`relative w-full ${heightClass} bg-[#07090E] border border-slate-800 rounded overflow-hidden`}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverText(null)}
          className="w-full h-full object-cover cursor-crosshair"
        />
        {hoverText && (
          <div className="absolute bottom-2 left-2 bg-[#07090E]/90 border border-slate-700/80 px-2 py-1 rounded text-[11px] font-mono text-slate-200 pointer-events-none">
            {hoverText}
          </div>
        )}
      </div>

      {/* Scientific Legend Bar */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
        {(mode === 'RAW_DSM' || mode === 'REFINED_DSM') && (
          <div className="flex flex-col gap-1">
            <div className="h-2 w-full rounded-sm bg-gradient-to-r from-[#12355B] via-[#5CA45C] via-[#CCA856] to-[#F4F6FA]" />
            <div className="flex justify-between text-[10px]">
              <span>{minE.toFixed(1)} {elevUnit}</span>
              <span>{((minE + maxE) * 0.5).toFixed(1)} {elevUnit}</span>
              <span>{maxE.toFixed(1)} {elevUnit}</span>
            </div>
          </div>
        )}

        {(mode === 'DEPTH_PLASMA' || mode === 'DEPTH_GRAY') && (
          <div className="flex flex-col gap-1">
            <div
              className={`h-2 w-full rounded-sm ${
                mode === 'DEPTH_PLASMA'
                  ? 'bg-gradient-to-r from-[#0F0C44] via-[#AC2D80] to-[#F8EB56]'
                  : 'bg-gradient-to-r from-black via-neutral-500 to-white'
              }`}
            />
            <div className="flex justify-between text-[10px]">
              <span>0.00 (Far / Low)</span>
              <span>0.50 (Mid)</span>
              <span>1.00 (Near / High)</span>
            </div>
          </div>
        )}

        {mode === 'SLOPE' && (
          <div className="flex flex-col gap-1">
            <div className="h-2 w-full rounded-sm bg-gradient-to-r from-[#145341] via-[#0E9488] via-[#EAB308] to-[#E11D48]" />
            <div className="flex justify-between text-[10px]">
              <span>0° Flat</span>
              <span>15° Moderate</span>
              <span>30° Steep</span>
              <span>{project.terrainAnalysis.maxSlopeDegrees.toFixed(0)}° Max</span>
            </div>
          </div>
        )}

        {mode === 'CONFIDENCE' && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" />
              High ({project.confidence.highConfidencePercent}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-amber-500 inline-block" />
              Med ({project.confidence.mediumConfidencePercent}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-rose-500 inline-block" />
              Low ({project.confidence.lowConfidencePercent}%)
            </span>
          </div>
        )}

        {mode === 'SEGMENTATION' && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            <span><span className="inline-block w-2 h-2 bg-[#94846C] mr-1" />Ground</span>
            <span><span className="inline-block w-2 h-2 bg-[#F43F5E] mr-1" />Building</span>
            <span><span className="inline-block w-2 h-2 bg-[#22C55E] mr-1" />Vegetation</span>
            <span><span className="inline-block w-2 h-2 bg-[#94A3B8] mr-1" />Road</span>
            <span><span className="inline-block w-2 h-2 bg-[#0EA5E9] mr-1" />Water</span>
          </div>
        )}

        {(mode === 'RGB' || mode === 'FLOOD_MAP') && (
          <div className="flex justify-between text-[10px]">
            <span>Grid: {gw}×{gh} cells</span>
            <span>·</span>
            <span>{project.geospatial.isGeoreferenced ? project.geospatial.crs : 'Pixel Coordinate Space'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
