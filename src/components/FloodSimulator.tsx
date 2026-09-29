import React from 'react';
import { FloodSimulationResult } from '../types/flood';
import { TerrainProjectData } from '../types/terrain';
import { Play, Pause, RotateCcw, AlertTriangle, Droplets } from 'lucide-react';

interface FloodSimulatorProps {
  project: TerrainProjectData;
  floodResult: FloodSimulationResult;
  waterLevel: number;
  onWaterLevelChange: (level: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  animationSpeed: number;
  onAnimationSpeedChange: (speed: number) => void;
}

export const FloodSimulator: React.FC<FloodSimulatorProps> = ({
  project,
  floodResult,
  waterLevel,
  onWaterLevelChange,
  isPlaying,
  onTogglePlay,
  onReset,
  animationSpeed,
  onAnimationSpeedChange,
}) => {
  const minE = project.terrainAnalysis.minElevation;
  const maxE = project.terrainAnalysis.maxElevation;
  const rangeE = Math.max(1.0, maxE - minE);
  const elevUnit = project.calibration.mode === 'MODE_B_CALIBRATED' ? 'm' : 'rel';

  return (
    <div className="space-y-4">
      {/* Mandatory Scientific Limitation Banner */}
      <div className="bg-amber-950/30 border border-amber-500/40 rounded p-3.5 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <span className="font-semibold text-amber-300">Scientific Limitation Notice: </span>
          Elevation-based simulation only. This does not model rainfall, drainage, river discharge, flow velocity, or hydrodynamic behavior. Inundation is evaluated via static planar intersection (<code className="font-mono text-amber-200">terrainElevation &lt;= waterLevel</code>) on the final DSM.
        </div>
      </div>

      {/* Main Interactive Water Level & Animation Controller */}
      <div className="bg-[#0D1322] border border-slate-800/90 rounded p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <span>Dynamic DSM Water Level Control</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Slider bounds derived directly from actual DSM range [{minE.toFixed(2)} – {maxE.toFixed(2)} {elevUnit}]
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause Surge' : 'Animate Surge'}</span>
            </button>

            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#07090E] text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <div className="flex items-center bg-[#07090E] border border-slate-800 rounded p-0.5 text-[11px] font-mono">
              {[0.5, 1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onAnimationSpeedChange(spd)}
                  className={`px-2 py-1 rounded transition-colors ${
                    animationSpeed === spd ? 'bg-slate-800 text-cyan-400 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Slider Rail */}
        <div className="bg-[#07090E] border border-slate-800 rounded p-3.5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-mono text-slate-400">TARGET WATERPLANE DATUM</span>
            <span className="text-xl font-mono font-bold text-cyan-400 tabular-nums">
              {waterLevel.toFixed(2)} <span className="text-xs font-normal text-slate-400">{elevUnit}</span>
            </span>
          </div>

          <input
            type="range"
            min={minE}
            max={maxE}
            step={Math.max(0.05, rangeE / 250)}
            value={waterLevel}
            onChange={(e) => onWaterLevelChange(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 h-2 bg-slate-800 rounded cursor-pointer"
          />

          <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1.5">
            <span>Min DSM: {minE.toFixed(2)} {elevUnit}</span>
            <span>Mean DSM: {project.terrainAnalysis.meanElevation.toFixed(2)} {elevUnit}</span>
            <span>Max DSM: {maxE.toFixed(2)} {elevUnit}</span>
          </div>
        </div>

        {/* Live Calculated Flood Impact Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#07090E] border border-slate-800/90 rounded p-3">
            <div className="text-[11px] font-mono text-slate-400">INUNDATED AREA</div>
            <div className="text-xl font-mono font-semibold text-slate-100 tabular-nums mt-1">
              {floodResult.floodedAreaPercent.toFixed(1)}
              <span className="text-xs text-slate-400 ml-1">%</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              {floodResult.floodedAreaSqMeters !== null
                ? `${(floodResult.floodedAreaSqMeters / 10000).toFixed(2)} ha (${floodResult.floodedAreaSqMeters.toLocaleString()} m²)`
                : `${floodResult.floodedPixelCount.toLocaleString()} / ${floodResult.totalPixelCount.toLocaleString()} cells`}
            </div>
          </div>

          <div className="bg-[#07090E] border border-slate-800/90 rounded p-3">
            <div className="text-[11px] font-mono text-slate-400">MAX FLOOD DEPTH</div>
            <div className="text-xl font-mono font-semibold text-cyan-400 tabular-nums mt-1">
              {floodResult.maxFloodDepth.toFixed(2)}
              <span className="text-xs text-slate-400 ml-1">{elevUnit}</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              At lowest basin point ({minE.toFixed(1)} {elevUnit})
            </div>
          </div>

          <div className="bg-[#07090E] border border-slate-800/90 rounded p-3">
            <div className="text-[11px] font-mono text-slate-400">AVERAGE FLOOD DEPTH</div>
            <div className="text-xl font-mono font-semibold text-slate-100 tabular-nums mt-1">
              {floodResult.meanFloodDepth.toFixed(2)}
              <span className="text-xs text-slate-400 ml-1">{elevUnit}</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              Across flooded cells only
            </div>
          </div>

          <div className="bg-[#07090E] border border-slate-800/90 rounded p-3">
            <div className="text-[11px] font-mono text-slate-400">AFFECTED BUILDINGS</div>
            <div
              className={`text-xl font-mono font-semibold tabular-nums mt-1 ${
                floodResult.affectedBuildingsCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {project.segmentationAvailable ? (
                <>
                  {floodResult.affectedBuildingsCount}
                  <span className="text-xs text-slate-400 ml-1">/ {floodResult.totalBuildingsCount}</span>
                </>
              ) : (
                <span className="text-xs text-slate-400">Seg. Disabled</span>
              )}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              {project.segmentationAvailable
                ? 'Structures intersecting flood mask'
                : 'Enable segmentation for building stats'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
