import { useState, useCallback } from 'react';
import { DepthModelVariant, ProcessingStage } from '../types/depth';
import { ReferenceDataType, TerrainProjectData } from '../types/terrain';
import { buildDemoTerrainProject } from '../utils/demoDatasets';
import { processUploadedAerialImage } from '../services/api';

export function useProcessing() {
  const [project, setProject] = useState<TerrainProjectData>(() =>
    buildDemoTerrainProject('alaknanda_valley', 'LARGE', true)
  );
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('COMPLETE');
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const [progressMessage, setProgressMessage] = useState<string>(
    'Loaded bundled Alaknanda Himalayan Hydro Valley Demo Dataset.'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDemoPreset = useCallback(
    (
      scenarioId: string,
      modelVariant: DepthModelVariant = 'LARGE',
      enableSegmentation: boolean = true,
      overrideRef?: ReferenceDataType
    ) => {
      setErrorMessage(null);
      setProcessingStage('PROCESSING');
      setProgressPercent(45);
      setProgressMessage(`Loading & calibrating ${scenarioId} numerical arrays...`);

      setTimeout(() => {
        const nextProj = buildDemoTerrainProject(
          scenarioId,
          modelVariant,
          enableSegmentation,
          overrideRef
        );
        setProject(nextProj);
        setProcessingStage('COMPLETE');
        setProgressPercent(100);
        setProgressMessage(
          nextProj.calibration.mode === 'MODE_B_CALIBRATED'
            ? `Loaded ${nextProj.projectName} — Calibrated against ${nextProj.calibration.referenceType}.`
            : 'Image processed, but no reference elevation was supplied. Showing uncalibrated estimated DSM.'
        );
      }, 60);
    },
    []
  );

  const runCustomUpload = useCallback(
    async (params: {
      imageFile: File;
      referenceFile: File | null;
      referenceType: ReferenceDataType;
      modelVariant: DepthModelVariant;
      enableSegmentation: boolean;
    }) => {
      setErrorMessage(null);
      try {
        const result = await processUploadedAerialImage({
          ...params,
          onStageChange: (stage, pct, msg) => {
            setProcessingStage(stage);
            setProgressPercent(pct);
            setProgressMessage(msg);
          },
        });
        setProject(result);
        if (result.calibration.mode === 'MODE_A_UNCALIBRATED') {
          setProgressMessage(
            'Image processed, but no reference elevation was supplied. Showing uncalibrated estimated DSM.'
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to process uploaded aerial image.';
        setProcessingStage('ERROR');
        setErrorMessage(message);
      }
    },
    []
  );

  return {
    project,
    processingStage,
    progressPercent,
    progressMessage,
    errorMessage,
    loadDemoPreset,
    runCustomUpload,
  };
}
