import React from 'react';
import { TerrainProjectData } from '../types/terrain';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ValidationPanelProps {
  project: TerrainProjectData;
  onSwitchToCalibratedDemo?: () => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  project,
  onSwitchToCalibratedDemo,
}) => {
  const { validation, calibration } = project;
  const minE = project.terrainAnalysis.minElevation;
  const maxE = project.terrainAnalysis.maxElevation;
  const rangeE = Math.max(1.0, maxE - minE);

  return (
    <div className="space-y-6">
      {/* Calibration Model Equation & RANSAC Fit Summary */}
      <div className="bg-[#0D1322] border border-slate-800/90 rounded p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Terrain-Aware Metric Calibration Model (Z = S × D + B)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {calibration.statusMessage}
            </p>
          </div>

          <span
            className={`text-xs font-mono font-semibold ${
              calibration.mode === 'MODE_B_CALIBRATED' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {calibration.mode === 'MODE_B_CALIBRATED'
              ? `● CALIBRATED (${calibration.referenceType})`
              : '▲ UNCALIBRATED (MODE A)'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-[#07090E] border border-slate-800 rounded p-3">
            <div className="text-[11px] font-mono text-slate-400">SCALE FACTOR (S)</div>
            <div className="text-xl font-mono font-semibold text-cyan-400 tabular-nums mt-1">
              {calibration.scale.toFixed(3)}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              Depth-to-elevation slope
            </div>
          </div>

          <div className="bg-[#07090E] border border-slate-800 rounded p-3">
            <div className="text-[11px] font-mono text-slate-400">DATUM OFFSET (B)</div>
            <div className="text-xl font-mono font-semibold text-slate-100 tabular-nums mt-1">
              {calibration.offset >= 0 ? `+${calibration.offset.toFixed(2)}` : calibration.offset.toFixed(2)}
              <span className="text-xs text-slate-400 ml-1">m</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              Base vertical datum shift
            </div>
          </div>

          <div className="bg-[#07090E] border border-slate-800 rounded p-3">
            <div className="text-[11px] font-mono text-slate-400">VALID REFERENCE POINTS</div>
            <div className="text-xl font-mono font-semibold text-slate-100 tabular-nums mt-1">
              {calibration.validReferencePoints.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              RANSAC Inliers: {calibration.inlierCount.toLocaleString()}
            </div>
          </div>

          <div className="bg-[#07090E] border border-slate-800 rounded p-3">
            <div className="text-[11px] font-mono text-slate-400">CALIBRATION RESIDUAL</div>
            <div className="text-xl font-mono font-semibold text-emerald-400 tabular-nums mt-1">
              {calibration.mode === 'MODE_B_CALIBRATED' ? (
                <>
                  {calibration.calibrationResidualRmse.toFixed(2)}
                  <span className="text-xs text-slate-400 ml-1">m</span>
                </>
              ) : (
                <span className="text-slate-500">N/A</span>
              )}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              R² Fit: {calibration.mode === 'MODE_B_CALIBRATED' ? calibration.rSquared.toFixed(4) : 'Uncalibrated'}
            </div>
          </div>
        </div>
      </div>

      {/* Empirical Validation Section */}
      {!validation.available ? (
        <div className="bg-[#0D1322] border border-amber-500/40 rounded p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-slate-100">
                Validation unavailable — no reference elevation data supplied.
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                A single RGB aerial image does not inherently contain exact metric elevation. Supply a reference DEM, SRTM raster, LiDAR DSM, or Ground Control Points (GCPs) to compute empirical MAE, RMSE, and correlation metrics.
              </p>
            </div>
          </div>
          {onSwitchToCalibratedDemo && (
            <button
              onClick={onSwitchToCalibratedDemo}
              className="px-4 py-2 bg-cyan-500 text-slate-950 text-xs font-semibold rounded hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              Load Calibrated SRTM Demo
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Calculated MAE, RMSE, Correlation Cards */}
          <div className="bg-[#0D1322] border border-slate-800/90 rounded p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Empirical Validation Against Reference ({validation.referenceSource})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{validation.message}</p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                N = {validation.sampleCount.toLocaleString()} correspondences
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-[#07090E] border border-slate-800 rounded p-3">
                <div className="text-[11px] font-mono text-slate-400">MAE (MEAN ABS ERROR)</div>
                <div className="text-2xl font-mono font-bold text-emerald-400 tabular-nums mt-1">
                  {validation.mae?.toFixed(2)}
                  <span className="text-xs font-normal text-slate-400 ml-1">m</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">1/N Σ |Z_pred − Z_ref|</div>
              </div>

              <div className="bg-[#07090E] border border-slate-800 rounded p-3">
                <div className="text-[11px] font-mono text-slate-400">RMSE (ROOT MEAN SQ)</div>
                <div className="text-2xl font-mono font-bold text-cyan-400 tabular-nums mt-1">
                  {validation.rmse?.toFixed(2)}
                  <span className="text-xs font-normal text-slate-400 ml-1">m</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">√(1/N Σ (Z_pred − Z_ref)²)</div>
              </div>

              <div className="bg-[#07090E] border border-slate-800 rounded p-3">
                <div className="text-[11px] font-mono text-slate-400">CORRELATION (r)</div>
                <div className="text-2xl font-mono font-bold text-slate-100 tabular-nums mt-1">
                  {validation.correlation?.toFixed(4)}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">Pearson linear r</div>
              </div>

              <div className="bg-[#07090E] border border-slate-800 rounded p-3">
                <div className="text-[11px] font-mono text-slate-400">P90 ABSOLUTE ERROR</div>
                <div className="text-2xl font-mono font-bold text-slate-100 tabular-nums mt-1">
                  {validation.p90Error?.toFixed(2)}
                  <span className="text-xs font-normal text-slate-400 ml-1">m</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">90th percentile error</div>
              </div>

              <div className="bg-[#07090E] border border-slate-800 rounded p-3">
                <div className="text-[11px] font-mono text-slate-400">MEAN BIAS</div>
                <div className="text-2xl font-mono font-bold text-slate-100 tabular-nums mt-1">
                  {validation.bias !== null && validation.bias >= 0
                    ? `+${validation.bias.toFixed(2)}`
                    : validation.bias?.toFixed(2)}
                  <span className="text-xs font-normal text-slate-400 ml-1">m</span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">Systematic offset</div>
              </div>
            </div>

            {/* 1:1 Reference vs Predicted DSM Scatter Plot & GCP Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              <div className="bg-[#07090E] border border-slate-800 rounded p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-2">
                  <span>Predicted DSM vs. Reference Elevation (1:1 Regression)</span>
                  <span className="text-[11px] font-mono text-cyan-400">r = {validation.correlation?.toFixed(3)}</span>
                </div>

                <svg viewBox="0 0 320 210" className="w-full h-52 bg-[#0B0F19] border border-slate-800/80 rounded">
                  <line x1={38} y1={178} x2={302} y2={14} stroke="#334155" strokeWidth={1.2} strokeDasharray="4 3" />
                  {validation.scatterSamples.map((pt, i) => {
                    const nx = Math.max(0, Math.min(1, (pt.reference - minE) / rangeE));
                    const ny = Math.max(0, Math.min(1, (pt.predicted - minE) / rangeE));
                    const cx = 38 + nx * 264;
                    const cy = 178 - ny * 164;
                    return (
                      <circle
                        key={i}
                        cx={cx}
                        cy={cy}
                        r={2.4}
                        fill={Math.abs(pt.residual) < (validation.rmse || 5) ? '#22D3EE' : '#F59E0B'}
                        fillOpacity={0.78}
                      />
                    );
                  })}
                  <text x={170} y={202} textAnchor="middle" className="fill-slate-400 text-[9px] font-mono">
                    Reference Elevation ({minE.toFixed(0)}m – {maxE.toFixed(0)}m)
                  </text>
                  <text
                    x={12}
                    y={100}
                    textAnchor="middle"
                    transform="rotate(-90 12 100)"
                    className="fill-slate-400 text-[9px] font-mono"
                  >
                    Predicted DSM (m)
                  </text>
                </svg>
              </div>

              {/* Ground Control Points Table */}
              <div className="bg-[#07090E] border border-slate-800 rounded p-3.5 flex flex-col">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-2">
                  <span>Ground Control Points (GCP) Residuals</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {calibration.gcps.length} Survey Checkpoints
                  </span>
                </div>

                <div className="overflow-y-auto max-h-52 border border-slate-800/80 rounded">
                  <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-[#0D1322] text-slate-400 text-[10px] border-b border-slate-800">
                        <th className="py-1.5 px-2.5">GCP ID</th>
                        <th className="py-1.5 px-2.5">Rel Depth</th>
                        <th className="py-1.5 px-2.5">Ref Z (m)</th>
                        <th className="py-1.5 px-2.5">DSM Z (m)</th>
                        <th className="py-1.5 px-2.5">Residual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {calibration.gcps.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-900/60">
                          <td className="py-1.5 px-2.5 text-slate-200 font-semibold">{g.id}</td>
                          <td className="py-1.5 px-2.5 text-slate-400">{g.predictedDepth.toFixed(3)}</td>
                          <td className="py-1.5 px-2.5 text-slate-200">{g.referenceElevation.toFixed(2)}</td>
                          <td className="py-1.5 px-2.5 text-cyan-400">{g.calibratedElevation.toFixed(2)}</td>
                          <td
                            className={`py-1.5 px-2.5 ${
                              g.isInlier ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {g.residual >= 0 ? `+${g.residual.toFixed(2)}` : g.residual.toFixed(2)} m
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
