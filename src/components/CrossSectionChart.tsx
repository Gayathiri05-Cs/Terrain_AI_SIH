import React from 'react';
import { TerrainProjectData } from '../types/terrain';

interface CrossSectionChartProps {
  project: TerrainProjectData;
  axis: 'X_AXIS' | 'Y_AXIS';
  slicePosition: number; // [0..1]
  waterLevel: number;
  onChangeSlicePosition: (pos: number) => void;
  onChangeAxis: (axis: 'X_AXIS' | 'Y_AXIS') => void;
}

export const CrossSectionChart: React.FC<CrossSectionChartProps> = ({
  project,
  axis,
  slicePosition,
  waterLevel,
  onChangeSlicePosition,
  onChangeAxis,
}) => {
  const gw = project.gridWidth;
  const gh = project.gridHeight;
  const minE = project.terrainAnalysis.minElevation;
  const maxE = project.terrainAnalysis.maxElevation;
  const rangeE = Math.max(1.0, maxE - minE);
  const elevUnit = project.calibration.mode === 'MODE_B_CALIBRATED' ? 'm' : 'rel';

  const count = axis === 'X_AXIS' ? gh : gw;
  const fixedIndex =
    axis === 'X_AXIS'
      ? Math.min(gw - 1, Math.max(0, Math.round(slicePosition * (gw - 1))))
      : Math.min(gh - 1, Math.max(0, Math.round(slicePosition * (gh - 1))));

  const rawPoints: number[] = [];
  const refinedPoints: number[] = [];
  const refDemPoints: number[] = [];

  for (let i = 0; i < count; i++) {
    const idx = axis === 'X_AXIS' ? i * gw + fixedIndex : fixedIndex * gw + i;
    rawPoints.push(project.rawDsmGrid[idx]);
    refinedPoints.push(project.refinedDsmGrid[idx]);
    if (project.referenceDemGrid) {
      refDemPoints.push(project.referenceDemGrid[idx]);
    }
  }

  const svgW = 540;
  const svgH = 155;
  const padL = 42;
  const padR = 14;
  const padT = 14;
  const padB = 24;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const toX = (i: number) => padL + (i / (count - 1)) * plotW;
  const toY = (elev: number) => padT + (1 - (elev - minE) / rangeE) * plotH;

  const refinedPath = refinedPoints
    .map((e, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(e).toFixed(1)}`)
    .join(' ');
  const refinedAreaPath = `${refinedPath} L${toX(count - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${padL},${(
    padT + plotH
  ).toFixed(1)} Z`;

  const rawPath = rawPoints
    .map((e, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(e).toFixed(1)}`)
    .join(' ');

  const refPath =
    refDemPoints.length > 0
      ? refDemPoints.map((e, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(e).toFixed(1)}`).join(' ')
      : null;

  const waterY = Math.max(padT, Math.min(padT + plotH, toY(waterLevel)));

  return (
    <div className="bg-[#0D1322] border border-slate-800/90 rounded p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div>
          <h4 className="text-xs font-semibold text-slate-100">
            Terrain Elevation Transect & Edge-Refinement Profile
          </h4>
          <p className="text-[11px] text-slate-400">
            Comparing Raw DSM, Edge-Aware Refined DSM, Reference DEM, and Flood Water Level
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#07090E] p-0.5 rounded border border-slate-800">
            <button
              onClick={() => onChangeAxis('Y_AXIS')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                axis === 'Y_AXIS' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              West–East Slice
            </button>
            <button
              onClick={() => onChangeAxis('X_AXIS')}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                axis === 'X_AXIS' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              North–South Slice
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
            <span>Pos: {(slicePosition * 100).toFixed(0)}%</span>
            <input
              type="range"
              min={0.05}
              max={0.95}
              step={0.02}
              value={slicePosition}
              onChange={(e) => onChangeSlicePosition(parseFloat(e.target.value))}
              className="w-20 accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-36 bg-[#07090E] border border-slate-800 rounded">
        {/* Horizontal elevation grid lines */}
        {[0, 0.5, 1].map((frac) => {
          const y = padT + (1 - frac) * plotH;
          const val = minE + frac * rangeE;
          return (
            <g key={frac}>
              <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#1E293B" strokeDasharray="3 3" />
              <text x={padL - 5} y={y + 3} textAnchor="end" className="fill-slate-400 text-[9px] font-mono">
                {val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Flood water fill below waterY */}
        <rect
          x={padL}
          y={waterY}
          width={plotW}
          height={Math.max(0, padT + plotH - waterY)}
          fill="rgba(14, 165, 233, 0.18)"
        />
        <line
          x1={padL}
          y1={waterY}
          x2={svgW - padR}
          y2={waterY}
          stroke="#38BDF8"
          strokeWidth={1.2}
          strokeDasharray="4 2"
        />

        {/* Refined DSM shaded area + solid line */}
        <path d={refinedAreaPath} fill="rgba(6, 182, 212, 0.14)" />
        <path d={refinedPath} fill="none" stroke="#22D3EE" strokeWidth={1.75} />

        {/* Raw DSM dashed line */}
        <path d={rawPath} fill="none" stroke="#F59E0B" strokeWidth={1} strokeDasharray="2 2" opacity={0.8} />

        {/* Reference DEM line if available */}
        {refPath && (
          <path d={refPath} fill="none" stroke="#10B981" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.9} />
        )}

        {/* X axis labels */}
        <text x={padL} y={svgH - 6} className="fill-slate-400 text-[9px] font-mono">
          {axis === 'Y_AXIS' ? 'West (0%)' : 'North (0%)'}
        </text>
        <text x={svgW - padR} y={svgH - 6} textAnchor="end" className="fill-slate-400 text-[9px] font-mono">
          {axis === 'Y_AXIS' ? 'East (100%)' : 'South (100%)'}
        </text>
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-cyan-300">
            <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
            Refined DSM
          </span>
          <span className="flex items-center gap-1.5 text-amber-300">
            <span className="w-3 h-0.5 bg-amber-400 inline-block" />
            Raw Unfiltered DSM
          </span>
          {refPath && (
            <span className="flex items-center gap-1.5 text-emerald-300">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
              Reference {project.calibration.referenceType}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sky-300">
            <span className="w-3 h-0.5 bg-sky-400 inline-block" />
            Flood Level ({waterLevel.toFixed(1)} {elevUnit})
          </span>
        </div>
        <span>Unit: {elevUnit === 'm' ? 'Meters ASL' : 'Relative Units'}</span>
      </div>
    </div>
  );
};
