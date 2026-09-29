import { useState, useEffect, useMemo, useCallback } from 'react';
import { TerrainProjectData } from '../types/terrain';
import { simulateFloodImpact } from '../utils/calculations';

export function useFlood(project: TerrainProjectData, useRefinedDsm: boolean = true) {
  const [waterLevel, setWaterLevel] = useState<number>(
    project.initialFloodSimulation.waterLevelMeters
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [animationSpeed, setAnimationSpeed] = useState<number>(1.0);

  // Sync default water level when project changes
  useEffect(() => {
    setIsPlaying(false);
    setWaterLevel(project.initialFloodSimulation.waterLevelMeters);
  }, [project.projectId, project.initialFloodSimulation.waterLevelMeters]);

  // Animate rising water surge
  useEffect(() => {
    if (!isPlaying) return;
    const minE = project.terrainAnalysis.minElevation;
    const maxE = project.terrainAnalysis.maxElevation;
    const step = ((maxE - minE) / 180) * animationSpeed;

    const timer = setInterval(() => {
      setWaterLevel((prev) => {
        if (prev + step >= maxE) {
          setIsPlaying(false);
          return maxE;
        }
        return Number((prev + step).toFixed(2));
      });
    }, 50);

    return () => clearInterval(timer);
  }, [isPlaying, animationSpeed, project.terrainAnalysis.minElevation, project.terrainAnalysis.maxElevation]);

  // Evaluate flood mask on cached DSM without re-running AI inference
  const floodResult = useMemo(() => {
    const activeDsm = useRefinedDsm ? project.refinedDsmGrid : project.rawDsmGrid;
    return simulateFloodImpact(
      activeDsm,
      waterLevel,
      project.terrainAnalysis.minElevation,
      project.terrainAnalysis.maxElevation,
      project.buildings,
      project.gridWidth,
      project.gridHeight,
      project.geospatial.resolutionMeters
    );
  }, [
    project.refinedDsmGrid,
    project.rawDsmGrid,
    project.terrainAnalysis.minElevation,
    project.terrainAnalysis.maxElevation,
    project.buildings,
    project.gridWidth,
    project.gridHeight,
    project.geospatial.resolutionMeters,
    useRefinedDsm,
    waterLevel,
  ]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setWaterLevel(project.initialFloodSimulation.waterLevelMeters);
  }, [project.initialFloodSimulation.waterLevelMeters]);

  return {
    waterLevel,
    setWaterLevel,
    floodResult,
    isPlaying,
    setIsPlaying,
    animationSpeed,
    setAnimationSpeed,
    handleReset,
  };
}
