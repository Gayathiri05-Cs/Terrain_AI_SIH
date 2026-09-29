import React, { useState } from 'react';
import { useProcessing } from './hooks/useProcessing';
import { useTerrain } from './hooks/useTerrain';
import { useFlood } from './hooks/useFlood';
import { Terrain3D } from './components/Terrain3D';
import { RasterMapCanvas } from './components/RasterMapCanvas';
import { CrossSectionChart } from './components/CrossSectionChart';
import { ImageUploader } from './components/ImageUploader';
import { FloodSimulator } from './components/FloodSimulator';
import { ValidationPanel } from './components/ValidationPanel';
import { ExportPanel } from './components/ExportPanel';
import { DEMO_DATASET_PRESETS } from './utils/demoDatasets';
import { MapLayerMode } from './types/terrain';

type NavWorkspace =
  | 'MAP_3D_CONSOLE'
  | 'UPLOAD_PIPELINE'
  | 'DSM_SURFACE_ANALYSIS'
  | 'FLOOD_SIMULATION'
  | 'VALIDATION_EXPORT';

export function App() {
  const [activeNav, setActiveNav] = useState<NavWorkspace>('MAP_3D_CONSOLE');
  const [fullViewport3D, setFullViewport3D] = useState<boolean>(false);

  const {
    project,
    processingStage,
    progressPercent,
    progressMessage,
    errorMessage,
    loadDemoPreset,
    runCustomUpload,
  } = useProcessing();

  const { settings, updateSettings, selectedProbe, setSelectedProbe } = useTerrain();

  const {
    waterLevel,
    setWaterLevel,
    floodResult,
    isPlaying,
    setIsPlaying,
    animationSpeed,
    setAnimationSpeed,
    handleReset,
  } = useFlood(project, settings.useRefinedDsm);

  const elevUnit = project.calibration.mode === 'MODE_B_CALIBRATED' ? 'm' : 'rel';

  return (
    <div className="min-h-screen bg-[#07090E] text-[#F1F5F9] flex flex-col">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="h-14 border-b border-slate-800/90 bg-[#0A0E17] px-6 flex items-center justify-between shrink-0 z-20">
        {/* Zone 1: Single text element Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('MAP_3D_CONSOLE');
          }}
          className="font-display text-lg font-bold tracking-wider text-slate-100 whitespace-nowrap"
        >
          TERRAIN-X
        </a>

        {/* Zone 2: 5 Single-line clean text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium">
          {(
            [
              ['MAP_3D_CONSOLE', '3D Map Console'],
              ['UPLOAD_PIPELINE', 'Upload & Pipeline'],
              ['DSM_SURFACE_ANALYSIS', 'DSM & Slope'],
              ['FLOOD_SIMULATION', 'Flood Simulation'],
              ['VALIDATION_EXPORT', 'Validation & Export'],
            ] as Array<[NavWorkspace, string]>
          ).map(([id, label]) => {
            const isActive = activeNav === id;
            return (
              <button
                key={id}
                onClick={() => setActiveNav(id)}
                className={`py-4 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-cyan-400 text-slate-100 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 2 Primary Actions (Dataset Selector + Upload Aerial Image CTA) */}
        <div className="flex items-center gap-3">
          <select
            aria-label="Select terrain dataset"
            value={project.isDemoDataset ? project.demoScenarioId || 'alaknanda_valley' : 'custom'}
            onChange={(e) => {
              if (e.target.value !== 'custom') {
                loadDemoPreset(e.target.value, project.depth.modelVariant, project.segmentationAvailable);
              }
            }}
            className="bg-[#07090E] border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 max-w-[220px] truncate"
          >
            {DEMO_DATASET_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
            {!project.isDemoDataset && (
              <option value="custom">Custom: {project.inputFilename}</option>
            )}
          </select>

          <button
            onClick={() => setActiveNav('UPLOAD_PIPELINE')}
            className="px-3.5 py-1.5 text-xs font-semibold bg-cyan-500 text-slate-950 rounded hover:bg-cyan-400 transition-colors whitespace-nowrap cursor-pointer"
          >
            Upload Aerial Image
          </button>
        </div>
      </header>

      {/* Mobile Workspace Switcher */}
      <div className="flex md:hidden items-center gap-1 px-4 py-2 bg-[#0A0E17] border-b border-slate-800 overflow-x-auto">
        {(
          [
            ['MAP_3D_CONSOLE', '3D Map'],
            ['UPLOAD_PIPELINE', 'Upload'],
            ['DSM_SURFACE_ANALYSIS', 'DSM & Slope'],
            ['FLOOD_SIMULATION', 'Flood Sim'],
            ['VALIDATION_EXPORT', 'Validation'],
          ] as Array<[NavWorkspace, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveNav(id)}
            className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${
              activeNav === id ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* FULL VIEWPORT 3D MAP OVERRIDE */}
      {fullViewport3D ? (
        <main className="flex-1 w-full h-[calc(100vh-3.5rem)] relative">
          <Terrain3D
            project={project}
            floodResult={floodResult}
            waterLevel={waterLevel}
            onWaterLevelChange={setWaterLevel}
            settings={settings}
            onUpdateSettings={updateSettings}
            selectedProbe={selectedProbe}
            onSelectProbePoint={setSelectedProbe}
            fullViewportMode={true}
            onToggleFullViewport={() => setFullViewport3D(false)}
          />
        </main>
      ) : (
        <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-5 space-y-6">
          {/* SCIENTIFIC TRANSPARENCY & PROJECT STATUS RIBBON */}
          <section className="bg-[#0D1322] border border-slate-800/90 rounded p-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="font-semibold text-slate-100">{project.inputFilename}</span>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-slate-300">
                {project.originalImageWidth}×{project.originalImageHeight} px (Mesh Grid: {project.gridWidth}×{project.gridHeight})
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-cyan-400">
                Depth Model: Depth Anything V2 ({project.depth.modelVariant})
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-slate-300">
                {project.geospatial.isGeoreferenced
                  ? `CRS: ${project.geospatial.crs}`
                  : 'Non-georeferenced image'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <span
                className={
                  project.calibration.mode === 'MODE_B_CALIBRATED'
                    ? 'text-emerald-400 font-semibold'
                    : 'text-amber-400 font-semibold'
                }
              >
                {project.calibration.mode === 'MODE_B_CALIBRATED'
                  ? `● Reference: ${project.calibration.referenceType}`
                  : '▲ Reference: Not Available (Uncalibrated)'}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300">
                Validation:{' '}
                {project.validation.available
                  ? `RMSE ${project.validation.rmse?.toFixed(2)}m (r=${project.validation.correlation?.toFixed(2)})`
                  : 'Not Available'}
              </span>
            </div>
          </section>

          {/* ==============================================================
              WORKSPACE 1: COMPLETE 3D MAP CONSOLE & RESULT DASHBOARD
             ============================================================== */}
          {activeNav === 'MAP_3D_CONSOLE' && (
            <div className="space-y-6">
              {/* Asymmetric Split Console: Left Control Column + Main 3D Map Viewport */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                {/* Left Parameter & Telemetry Column (4 cols on XL) */}
                <aside className="xl:col-span-4 bg-[#0D1322] border border-slate-800/90 rounded p-4 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-100">
                          3D Terrain & Map Controls
                        </h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Single Image to 3D Terrain & Disaster Impact Analysis
                        </p>
                      </div>
                      <button
                        onClick={() => setFullViewport3D(true)}
                        className="px-2.5 py-1 bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 rounded text-[11px] font-medium hover:bg-cyan-500/25 transition-colors"
                      >
                        Expand 3D Map
                      </button>
                    </div>

                    {/* Key Quantitative Telemetry Grid */}
                    <div className="grid grid-cols-2 gap-2.5 font-mono tabular-nums">
                      <div className="bg-[#07090E] border border-slate-800/90 rounded p-2.5">
                        <div className="text-[10px] text-slate-400">ELEVATION RANGE</div>
                        <div className="text-sm font-semibold text-slate-100 mt-0.5">
                          {project.terrainAnalysis.minElevation.toFixed(1)} – {project.terrainAnalysis.maxElevation.toFixed(1)}{' '}
                          <span className="text-[10px] text-slate-400">{elevUnit}</span>
                        </div>
                        <div className="text-[10px] text-cyan-400 mt-0.5">
                          Span: {project.terrainAnalysis.elevationRange.toFixed(1)} {elevUnit}
                        </div>
                      </div>

                      <div className="bg-[#07090E] border border-slate-800/90 rounded p-2.5">
                        <div className="text-[10px] text-slate-400">MEAN ELEVATION / SLOPE</div>
                        <div className="text-sm font-semibold text-slate-100 mt-0.5">
                          {project.terrainAnalysis.meanElevation.toFixed(1)} {elevUnit}{' '}
                          <span className="text-slate-400">·</span> {project.terrainAnalysis.averageSlopeDegrees.toFixed(1)}°
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Max Slope: {project.terrainAnalysis.maxSlopeDegrees.toFixed(1)}°
                        </div>
                      </div>

                      <div className="bg-[#07090E] border border-slate-800/90 rounded p-2.5">
                        <div className="text-[10px] text-slate-400">CONFIDENCE SCORE</div>
                        <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                          {(project.confidence.averageConfidence * 100).toFixed(1)}% Mean
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          High: {project.confidence.highConfidencePercent}% · Low: {project.confidence.lowConfidencePercent}%
                        </div>
                      </div>

                      <div className="bg-[#07090E] border border-slate-800/90 rounded p-2.5">
                        <div className="text-[10px] text-slate-400">FLOOD INUNDATION</div>
                        <div className="text-sm font-semibold text-sky-400 mt-0.5">
                          {floodResult.floodedAreaPercent.toFixed(1)}% Area
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Max Depth: {floodResult.maxFloodDepth.toFixed(1)} {elevUnit}
                        </div>
                      </div>
                    </div>

                    {/* Surface Texture & Scientific Color Draping */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        3D Surface Drape Layer
                      </label>
                      <select
                        value={settings.layerMode}
                        onChange={(e) => updateSettings({ layerMode: e.target.value as MapLayerMode })}
                        className="w-full bg-[#07090E] border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="RGB_DSM_BLEND">RGB Ortho + Hypsometric Relief Blend</option>
                        <option value="RGB_ORTHO">Original RGB Aerial Texture</option>
                        <option value="HYPSOMETRIC_DSM">Metric DSM Hypsometric Elevation</option>
                        <option value="SLOPE_GRADIENT">Slope Steepness Gradient (0°–65°)</option>
                        <option value="CONFIDENCE_MAP">Pixel Reliability / Confidence Map</option>
                        <option value="LAND_COVER">Semantic Terrain / Object Classes</option>
                        <option value="RAW_VS_REFINED_DIFF">Raw vs. Edge-Refined DSM Residual</option>
                        <option value="DEPTH_PLASMA">Depth Anything V2 Relative Depth</option>
                      </select>
                    </div>

                    {/* 3D Flythrough Controller */}
                    <div className="bg-[#07090E] border border-slate-800 rounded p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200">
                          Automated 3D Terrain Flythrough
                        </span>
                        <button
                          onClick={() => updateSettings({ flythroughActive: !settings.flythroughActive })}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                            settings.flythroughActive
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                          }`}
                        >
                          {settings.flythroughActive ? 'Pause Flight' : 'Start Flight'}
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                        {(
                          [
                            ['ORBITAL_SURVEY', 'Orbital Survey'],
                            ['VALLEY_CORRIDOR', 'Valley Corridor'],
                            ['RIDGE_INSPECTION', 'Ridge Sweep'],
                          ] as const
                        ).map(([pat, label]) => (
                          <button
                            key={pat}
                            onClick={() => updateSettings({ flythroughPattern: pat, flythroughActive: true })}
                            className={`py-1 px-1.5 rounded border text-center truncate transition-colors ${
                              settings.flythroughPattern === pat
                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-medium'
                                : 'bg-[#0D1322] border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                            <span>Flight Speed</span>
                            <span>{settings.flythroughSpeed.toFixed(1)}×</span>
                          </div>
                          <input
                            type="range"
                            min={0.3}
                            max={3.0}
                            step={0.1}
                            value={settings.flythroughSpeed}
                            onChange={(e) => updateSettings({ flythroughSpeed: parseFloat(e.target.value) })}
                            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                            <span>Clearance Alt</span>
                            <span>+{settings.flythroughAltitudeOffset}m</span>
                          </div>
                          <input
                            type="range"
                            min={6}
                            max={45}
                            step={2}
                            value={settings.flythroughAltitudeOffset}
                            onChange={(e) =>
                              updateSettings({ flythroughAltitudeOffset: parseInt(e.target.value, 10) })
                            }
                            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Contour Interval & 3D Cross-Section Slicer */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          Contour Interval ({settings.contourIntervalMeters} {elevUnit})
                        </label>
                        <input
                          type="range"
                          min={Math.max(2, Math.round(project.terrainAnalysis.elevationRange / 25))}
                          max={Math.max(10, Math.round(project.terrainAnalysis.elevationRange / 4))}
                          step={1}
                          value={settings.contourIntervalMeters}
                          onChange={(e) =>
                            updateSettings({ contourIntervalMeters: parseInt(e.target.value, 10) })
                          }
                          className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                          3D Mesh Cutaway Slice
                        </label>
                        <select
                          value={settings.crossSectionAxis}
                          onChange={(e) =>
                            updateSettings({
                              crossSectionAxis: e.target.value as 'NONE' | 'X_AXIS' | 'Y_AXIS',
                            })
                          }
                          className="w-full bg-[#07090E] border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-200"
                        >
                          <option value="Y_AXIS">Active (N–S Plane)</option>
                          <option value="X_AXIS">Active (W–E Plane)</option>
                          <option value="NONE">Full Unclipped Mesh</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Scientific Source Attribution Footer */}
                  <div className="pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                    <div>DEPTH: AI Estimated (Depth Anything V2 {project.depth.modelVariant})</div>
                    <div>
                      DSM:{' '}
                      {project.calibration.mode === 'MODE_B_CALIBRATED'
                        ? `AI Estimated + Calibrated (Z = ${project.calibration.scale.toFixed(1)}·D + ${project.calibration.offset.toFixed(1)})`
                        : 'Uncalibrated Relative Surface'}
                    </div>
                  </div>
                </aside>

                {/* Main 3D WebGL Terrain & Map Viewport (8 cols on XL) */}
                <div className="xl:col-span-8 h-[580px] sm:h-[640px] bg-[#0D1322] border border-slate-800/90 rounded overflow-hidden">
                  <Terrain3D
                    project={project}
                    floodResult={floodResult}
                    waterLevel={waterLevel}
                    onWaterLevelChange={setWaterLevel}
                    settings={settings}
                    onUpdateSettings={updateSettings}
                    selectedProbe={selectedProbe}
                    onSelectProbePoint={setSelectedProbe}
                    fullViewportMode={false}
                    onToggleFullViewport={() => setFullViewport3D(true)}
                  />
                </div>
              </div>

              {/* Interactive Transect Profile & Flood Simulator Strip */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-6">
                  <CrossSectionChart
                    project={project}
                    axis={settings.crossSectionAxis === 'X_AXIS' ? 'X_AXIS' : 'Y_AXIS'}
                    slicePosition={settings.crossSectionPosition}
                    waterLevel={waterLevel}
                    onChangeSlicePosition={(pos) => updateSettings({ crossSectionPosition: pos })}
                    onChangeAxis={(ax) => updateSettings({ crossSectionAxis: ax })}
                  />
                </div>

                <div className="lg:col-span-6">
                  <FloodSimulator
                    project={project}
                    floodResult={floodResult}
                    waterLevel={waterLevel}
                    onWaterLevelChange={setWaterLevel}
                    isPlaying={isPlaying}
                    onTogglePlay={() => setIsPlaying((p) => !p)}
                    onReset={handleReset}
                    animationSpeed={animationSpeed}
                    onAnimationSpeedChange={setAnimationSpeed}
                  />
                </div>
              </div>

              {/* 6-Panel Multi-Modal Scientific Raster Result Grid */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      TERRAIN-X Pipeline Stage Outputs (Hover Any Raster to Inspect Matrix Values)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Synchronized 2D orthographic layers corresponding to the 3D terrain reconstruction
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <RasterMapCanvas
                    project={project}
                    mode="RGB"
                    title="01. Input RGB Aerial Orthophoto"
                    subtitle={`${project.inputFilename} (${project.originalImageWidth}×${project.originalImageHeight})`}
                    sourceBadge="SOURCE RGB"
                  />
                  <RasterMapCanvas
                    project={project}
                    mode="DEPTH_PLASMA"
                    title="02. Depth Anything V2 Relative Depth"
                    subtitle={`Normalized [0, 1] structure · Mean: ${project.depth.meanRelativeDepth.toFixed(3)}`}
                    sourceBadge="AI ESTIMATED"
                  />
                  <RasterMapCanvas
                    project={project}
                    mode="REFINED_DSM"
                    title="03. Edge-Aware Refined DSM"
                    subtitle={
                      project.calibration.mode === 'MODE_B_CALIBRATED'
                        ? `Calibrated against ${project.calibration.referenceType}`
                        : 'Uncalibrated Relative Structure (Mode A)'
                    }
                    sourceBadge={
                      project.calibration.mode === 'MODE_B_CALIBRATED'
                        ? 'AI + CALIBRATED'
                        : 'RELATIVE DSM'
                    }
                  />
                  <RasterMapCanvas
                    project={project}
                    mode="CONFIDENCE"
                    title="04. Pixel-Level Confidence Map"
                    subtitle={`Mean Confidence: ${(project.confidence.averageConfidence * 100).toFixed(1)}%`}
                    sourceBadge="RELIABILITY"
                  />
                  <RasterMapCanvas
                    project={project}
                    mode="SLOPE"
                    title="05. Surface Slope Steepness"
                    subtitle={`Mean: ${project.terrainAnalysis.averageSlopeDegrees.toFixed(1)}° · Max: ${project.terrainAnalysis.maxSlopeDegrees.toFixed(1)}°`}
                    sourceBadge="HORN 3×3 GRADIENT"
                  />
                  <RasterMapCanvas
                    project={project}
                    mode="FLOOD_MAP"
                    floodResult={floodResult}
                    title="06. Elevation-Based Flood Inundation"
                    subtitle={`Water Datum: ${waterLevel.toFixed(1)} ${elevUnit} (${floodResult.floodedAreaPercent.toFixed(1)}% flooded)`}
                    sourceBadge="FLOOD MASK"
                  />
                </div>
              </section>
            </div>
          )}

          {/* ==============================================================
              WORKSPACE 2: UPLOAD & PIPELINE CONFIGURATION
             ============================================================== */}
          {activeNav === 'UPLOAD_PIPELINE' && (
            <div className="space-y-6">
              <ImageUploader
                onProcessCustomUpload={async (params) => {
                  await runCustomUpload(params);
                  setActiveNav('MAP_3D_CONSOLE');
                }}
                onSelectDemoPreset={(scenarioId, variant, seg, refOverride) => {
                  loadDemoPreset(scenarioId, variant, seg, refOverride);
                }}
                activeScenarioId={project.demoScenarioId}
                isDemoDataset={project.isDemoDataset}
                processingStage={processingStage}
                progressPercent={progressPercent}
                progressMessage={progressMessage}
                errorMessage={errorMessage}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RasterMapCanvas
                  project={project}
                  mode="RGB"
                  title="Preprocessed Input RGB"
                  subtitle="Orientation & aspect preserved for 3D texture draping"
                  sourceBadge="INPUT"
                />
                <RasterMapCanvas
                  project={project}
                  mode="DEPTH_GRAY"
                  title="Raw Relative Depth (Grayscale)"
                  subtitle={`Depth Anything V2 (${project.depth.modelVariant})`}
                  sourceBadge="RAW DEPTH"
                />
                <RasterMapCanvas
                  project={project}
                  mode="SEGMENTATION"
                  title="Semantic Terrain / Object Classes"
                  subtitle="Ground, Building, Vegetation, Road, Water"
                  sourceBadge="SEGMENTATION"
                />
              </div>
            </div>
          )}

          {/* ==============================================================
              WORKSPACE 3: DSM, EDGE-AWARE REFINEMENT, SLOPE & BUILDINGS
             ============================================================== */}
          {activeNav === 'DSM_SURFACE_ANALYSIS' && (
            <div className="space-y-6">
              {/* Raw DSM vs Edge-Aware Refined DSM Comparison */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <RasterMapCanvas
                  project={project}
                  mode="RAW_DSM"
                  title="Raw Unfiltered DSM"
                  subtitle="Direct calibrated depth prior to edge-aware smoothing"
                  sourceBadge="RAW DSM"
                />
                <RasterMapCanvas
                  project={project}
                  mode="REFINED_DSM"
                  title="Edge-Aware Refined DSM"
                  subtitle="Guided RGB filter: smooths ground noise, preserves roof edges"
                  sourceBadge="REFINED DSM"
                />
                <RasterMapCanvas
                  project={project}
                  mode="SLOPE"
                  title="Geotechnical Slope Analysis"
                  subtitle={`Steep hazard (>30°): ${project.terrainAnalysis.steepHazardPercent}% of terrain`}
                  sourceBadge="SLOPE MAP"
                />
              </div>

              <CrossSectionChart
                project={project}
                axis={settings.crossSectionAxis === 'X_AXIS' ? 'X_AXIS' : 'Y_AXIS'}
                slicePosition={settings.crossSectionPosition}
                waterLevel={waterLevel}
                onChangeSlicePosition={(pos) => updateSettings({ crossSectionPosition: pos })}
                onChangeAxis={(ax) => updateSettings({ crossSectionAxis: ax })}
              />

              {/* Extracted Building Heights Table */}
              <div className="bg-[#0D1322] border border-slate-800/90 rounded p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Semantic Building Height Estimation (Median Building DSM − Nearby Ground DSM)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Calculated from connected building roof components relative to adjacent ground ring elevation
                    </p>
                  </div>
                  <span className="text-xs font-mono text-cyan-400">
                    {project.buildings.length} Structures Identified
                  </span>
                </div>

                {!project.segmentationAvailable || project.buildings.length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono py-4">
                    No building structures detected or semantic segmentation is disabled for this scene.
                  </p>
                ) : (
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                      <thead>
                        <tr className="bg-[#07090E] text-slate-400 text-[10px] border-b border-slate-800">
                          <th className="py-2 px-3">BUILDING ID</th>
                          <th className="py-2 px-3">ROOF MEDIAN DSM</th>
                          <th className="py-2 px-3">NEARBY GROUND DSM</th>
                          <th className="py-2 px-3">ESTIMATED HEIGHT</th>
                          <th className="py-2 px-3">FOOTPRINT</th>
                          <th className="py-2 px-3">CONFIDENCE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {project.buildings.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-900/50">
                            <td className="py-2 px-3 text-slate-100 font-semibold">{b.id}</td>
                            <td className="py-2 px-3 text-slate-300">
                              {b.roofMedianDsm.toFixed(2)} {elevUnit}
                            </td>
                            <td className="py-2 px-3 text-slate-400">
                              {b.nearbyGroundDsm.toFixed(2)} {elevUnit}
                            </td>
                            <td className="py-2 px-3 text-cyan-400 font-semibold">
                              +{b.estimatedHeight.toFixed(2)} {elevUnit}
                            </td>
                            <td className="py-2 px-3 text-slate-300">
                              {b.footprintSqMeters !== null
                                ? `${b.footprintSqMeters.toFixed(0)} m²`
                                : `${b.footprintPixels} px`}
                            </td>
                            <td className="py-2 px-3 text-emerald-400">
                              {(b.confidence * 100).toFixed(0)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==============================================================
              WORKSPACE 4: ELEVATION-BASED FLOOD IMPACT SIMULATION
             ============================================================== */}
          {activeNav === 'FLOOD_SIMULATION' && (
            <div className="space-y-6">
              <FloodSimulator
                project={project}
                floodResult={floodResult}
                waterLevel={waterLevel}
                onWaterLevelChange={setWaterLevel}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying((p) => !p)}
                onReset={handleReset}
                animationSpeed={animationSpeed}
                onAnimationSpeedChange={setAnimationSpeed}
              />

              {/* Reused Single 3D Terrain Engine with Interactive Water Plane + 2D Flood Mask */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-8 h-[520px] bg-[#0D1322] border border-slate-800/90 rounded overflow-hidden">
                  <Terrain3D
                    project={project}
                    floodResult={floodResult}
                    waterLevel={waterLevel}
                    onWaterLevelChange={setWaterLevel}
                    settings={{ ...settings, showWaterSurface: true }}
                    onUpdateSettings={updateSettings}
                    selectedProbe={selectedProbe}
                    onSelectProbePoint={setSelectedProbe}
                  />
                </div>
                <div className="lg:col-span-4 flex flex-col gap-4">
                  <RasterMapCanvas
                    project={project}
                    mode="FLOOD_MAP"
                    floodResult={floodResult}
                    title="2D Nadir Flood Inundation Mask"
                    subtitle={`Flooded cells: ${floodResult.floodedPixelCount.toLocaleString()} (${floodResult.floodedAreaPercent.toFixed(1)}%)`}
                    sourceBadge="FLOOD OVERLAY"
                    heightClass="h-64"
                  />
                  <RasterMapCanvas
                    project={project}
                    mode="CONFIDENCE"
                    title="Flood Assessment Confidence Map"
                    subtitle={`Mean DSM Reliability: ${(project.confidence.averageConfidence * 100).toFixed(1)}%`}
                    sourceBadge="CONFIDENCE"
                    heightClass="h-44"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==============================================================
              WORKSPACE 5: VALIDATION & EXPORT
             ============================================================== */}
          {activeNav === 'VALIDATION_EXPORT' && (
            <div className="space-y-6">
              <ValidationPanel
                project={project}
                onSwitchToCalibratedDemo={() =>
                  loadDemoPreset('alaknanda_valley', project.depth.modelVariant, true)
                }
              />
              <ExportPanel project={project} floodResult={floodResult} />
            </div>
          )}
        </main>
      )}
    </div>
  );
}

export default App;
