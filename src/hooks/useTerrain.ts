import { useState, useCallback } from 'react';
import { ProbePointInspection, Terrain3DViewSettings } from '../types/terrain';

export function useTerrain() {
  const [settings, setSettings] = useState<Terrain3DViewSettings>({
    layerMode: 'RGB_DSM_BLEND',
    useRefinedDsm: true,
    verticalExaggeration: 1.4,
    wireframe: false,
    showWaterSurface: true,
    showContours: true,
    contourIntervalMeters: 25,
    showBuildings3D: true,
    showGcpPins: true,
    showGeologicalSkirt: true,
    showCompassGrid: true,
    sunAzimuth: 135,
    sunAltitude: 48,
    meshSubdivisionStep: 1,
    crossSectionAxis: 'Y_AXIS',
    crossSectionPosition: 0.48,
    flythroughActive: false,
    flythroughSpeed: 1.0,
    flythroughAltitudeOffset: 16,
    flythroughPattern: 'ORBITAL_SURVEY',
  });

  const [selectedProbe, setSelectedProbe] = useState<ProbePointInspection | null>(null);

  const updateSettings = useCallback((partial: Partial<Terrain3DViewSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  return {
    settings,
    updateSettings,
    selectedProbe,
    setSelectedProbe,
  };
}
