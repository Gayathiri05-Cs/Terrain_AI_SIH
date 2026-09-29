import React, { useRef, useState } from 'react';
import { DepthModelVariant, ProcessingStage } from '../types/depth';
import { ReferenceDataType } from '../types/terrain';
import { DEMO_DATASET_PRESETS } from '../utils/demoDatasets';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Layers } from 'lucide-react';

interface ImageUploaderProps {
  onProcessCustomUpload: (params: {
    imageFile: File;
    referenceFile: File | null;
    referenceType: ReferenceDataType;
    modelVariant: DepthModelVariant;
    enableSegmentation: boolean;
  }) => Promise<void>;
  onSelectDemoPreset: (
    scenarioId: string,
    modelVariant: DepthModelVariant,
    enableSegmentation: boolean,
    overrideRef?: ReferenceDataType
  ) => void;
  activeScenarioId?: string;
  isDemoDataset: boolean;
  processingStage: ProcessingStage;
  progressPercent: number;
  progressMessage: string;
  errorMessage: string | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onProcessCustomUpload,
  onSelectDemoPreset,
  activeScenarioId,
  isDemoDataset,
  processingStage,
  progressPercent,
  progressMessage,
  errorMessage,
}) => {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const refInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedRefFile, setSelectedRefFile] = useState<File | null>(null);
  const [referenceType, setReferenceType] = useState<ReferenceDataType>('SRTM_DEM');
  const [modelVariant, setModelVariant] = useState<DepthModelVariant>('LARGE');
  const [enableSegmentation, setEnableSegmentation] = useState<boolean>(true);

  const isBusy =
    processingStage !== 'IDLE' &&
    processingStage !== 'COMPLETE' &&
    processingStage !== 'ERROR';

  const handleRunPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImage) return;
    await onProcessCustomUpload({
      imageFile: selectedImage,
      referenceFile: selectedRefFile,
      referenceType,
      modelVariant,
      enableSegmentation,
    });
  };

  return (
    <div className="space-y-6">
      {/* Demo Dataset Quick-Switch Bar */}
      <div className="bg-[#0D1322] border border-slate-800/90 rounded p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Bundled Scientific Demo Datasets
            </h3>
            <p className="text-xs text-slate-400">
              Pre-configured satellite & UAV scenes with SRTM, Airborne LiDAR, and Uncalibrated Mode A test cases
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400">
            Instant WebGL 3D Reconstruction
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DEMO_DATASET_PRESETS.map((preset) => {
            const isSelected = isDemoDataset && activeScenarioId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={isBusy}
                onClick={() =>
                  onSelectDemoPreset(preset.id, modelVariant, enableSegmentation)
                }
                className={`text-left p-3.5 rounded border transition-all ${
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500/60 text-slate-100'
                    : 'bg-[#07090E] border-slate-800/90 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                  <span className={preset.referenceType !== 'NONE' ? 'text-emerald-400' : 'text-amber-400'}>
                    {preset.referenceType !== 'NONE' ? `● MODE B (${preset.referenceType})` : '▲ MODE A (UNCALIBRATED)'}
                  </span>
                  <span>{preset.isGeoreferenced ? 'GeoTIFF' : 'JPG'}</span>
                </div>
                <div className="text-xs font-semibold text-slate-100 mb-1">
                  {preset.title}
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  {preset.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Aerial RGB + Reference DEM/GCP Upload Form */}
      <form
        onSubmit={handleRunPipeline}
        className="bg-[#0D1322] border border-slate-800/90 rounded p-5 space-y-5"
      >
        <div className="border-b border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Custom Aerial / Satellite RGB & Reference Elevation Ingestion
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload any nadir RGB image (JPG, PNG, GeoTIFF). Supply optional DEM/SRTM/GCP data for Mode B metric calibration.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Max File Size: 35 MB
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1. Primary RGB Image Dropzone */}
          <div
            onClick={() => imageInputRef.current?.click()}
            className="border border-dashed border-slate-700 hover:border-cyan-500/60 bg-[#07090E] rounded p-4 cursor-pointer transition-colors flex flex-col justify-between"
          >
            <input
              ref={imageInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.tif,.tiff,.geotiff"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedImage(e.target.files[0]);
                }
              }}
            />
            <div className="flex items-start gap-3">
              <Upload className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-100">
                  1. Primary Aerial / Satellite RGB Image (Required)
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports .JPG, .JPEG, .PNG, and .TIF/.GeoTIFF. GeoTIFF CRS, affine transform, and bounds are automatically extracted.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
              {selectedImage ? (
                <span className="text-emerald-400 truncate">
                  Selected: {selectedImage.name} ({(selectedImage.size / 1024).toFixed(1)} KB)
                </span>
              ) : (
                <span className="text-slate-400">Click to browse aerial RGB raster...</span>
              )}
              <span className="text-cyan-400 underline ml-2 shrink-0">Browse</span>
            </div>
          </div>

          {/* 2. Optional Reference Elevation / GCP Dropzone */}
          <div
            onClick={() => refInputRef.current?.click()}
            className="border border-dashed border-slate-700 hover:border-cyan-500/60 bg-[#07090E] rounded p-4 cursor-pointer transition-colors flex flex-col justify-between"
          >
            <input
              ref={refInputRef}
              type="file"
              accept=".csv,.json,.tif,.tiff"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedRefFile(e.target.files[0]);
                  const ext = e.target.files[0].name.split('.').pop()?.toLowerCase();
                  if (ext === 'csv' || ext === 'json') {
                    setReferenceType('GCP_POINTS');
                  } else {
                    setReferenceType('GEOTIFF_DEM');
                  }
                }
              }}
            />
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-100">
                  2. Reference Elevation / GCP Control File (Optional)
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supply SRTM/DEM GeoTIFF, LiDAR DSM, or GCP CSV/JSON (columns: id, normX, normY, elevation) to fit Z = S × D + B.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
              {selectedRefFile ? (
                <span className="text-emerald-400 truncate">
                  Reference: {selectedRefFile.name}
                </span>
              ) : (
                <span className="text-slate-400">Optional — leave empty for Mode A or synthetic SRTM</span>
              )}
              <span className="text-cyan-400 underline ml-2 shrink-0">Browse</span>
            </div>
          </div>
        </div>

        {/* Pipeline Configuration Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Depth Anything V2 Backbone Variant
            </label>
            <select
              value={modelVariant}
              onChange={(e) => setModelVariant(e.target.value as DepthModelVariant)}
              className="w-full bg-[#07090E] border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="LARGE">Depth Anything V2 — LARGE (Default High Detail)</option>
              <option value="BASE">Depth Anything V2 — BASE (Balanced)</option>
              <option value="SMALL">Depth Anything V2 — SMALL (Fast Inference)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Calibration Reference Mode
            </label>
            <select
              value={referenceType}
              onChange={(e) => setReferenceType(e.target.value as ReferenceDataType)}
              className="w-full bg-[#07090E] border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="NONE">MODE A — No Reference (Relative Depth Only)</option>
              <option value="SRTM_DEM">MODE B — SRTM 30m Reference Calibration</option>
              <option value="GEOTIFF_DEM">MODE B — Supplied GeoTIFF DEM Raster</option>
              <option value="GCP_POINTS">MODE B — Ground Control Points (CSV/JSON)</option>
              <option value="LIDAR_DSM">MODE B — Reference LiDAR DSM</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Terrain / Object Semantic Segmentation
            </label>
            <button
              type="button"
              onClick={() => setEnableSegmentation((v) => !v)}
              className={`w-full px-3 py-2 rounded border text-xs font-mono text-left flex items-center justify-between transition-colors ${
                enableSegmentation
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                  : 'bg-[#07090E] border-slate-800 text-slate-400'
              }`}
            >
              <span>{enableSegmentation ? 'Enabled (Buildings/Ground/Water)' : 'Disabled (Depth-Only Fallback)'}</span>
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Error Display */}
        {errorMessage && (
          <div className="bg-rose-950/40 border border-rose-500/50 rounded p-3 flex items-center gap-2.5 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Job Progress Telemetry Bar */}
        {processingStage !== 'IDLE' && (
          <div className="bg-[#07090E] border border-slate-800 rounded p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-2 text-cyan-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>STAGE: {processingStage}</span>
              </span>
              <span className="text-slate-300 tabular-nums">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-[11px] font-mono text-slate-400">{progressMessage}</div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-slate-400">
            Scientific constraint: Absolute metric elevation is reported only when calibrated in Mode B.
          </p>
          <button
            type="submit"
            disabled={!selectedImage || isBusy}
            className={`px-5 py-2.5 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
              selectedImage && !isBusy
                ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isBusy ? 'Processing Pipeline...' : 'Run TERRAIN-X Pipeline'}
          </button>
        </div>
      </form>
    </div>
  );
};
