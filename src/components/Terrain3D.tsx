import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  LandCoverClass,
  MapLayerMode,
  ProbePointInspection,
  Terrain3DViewSettings,
  TerrainProjectData,
} from '../types/terrain';
import { FloodSimulationResult } from '../types/flood';
import {
  getLandCoverColor,
  getLandCoverLabel,
  sampleScientificColor,
} from '../utils/calculations';
import {
  Compass,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  Layers,
  Droplets,
  Eye,
  Sliders,
  Navigation,
  Crosshair,
} from 'lucide-react';

interface Terrain3DProps {
  project: TerrainProjectData;
  floodResult: FloodSimulationResult;
  waterLevel: number;
  onWaterLevelChange: (newLevel: number) => void;
  settings: Terrain3DViewSettings;
  onUpdateSettings: (partial: Partial<Terrain3DViewSettings>) => void;
  onSelectProbePoint?: (probe: ProbePointInspection | null) => void;
  selectedProbe?: ProbePointInspection | null;
  fullViewportMode?: boolean;
  onToggleFullViewport?: () => void;
}

const LAYER_LABELS: Record<MapLayerMode, string> = {
  RGB_ORTHO: 'RGB Aerial Orthophoto',
  RGB_DSM_BLEND: 'RGB + Elevation Relief Fusion',
  HYPSOMETRIC_DSM: 'Hypsometric DSM Elevation',
  SLOPE_GRADIENT: 'Slope Steepness (0°–65°)',
  CONFIDENCE_MAP: 'Pixel Confidence (High/Med/Low)',
  LAND_COVER: 'Semantic Land-Cover Classes',
  RAW_VS_REFINED_DIFF: 'Edge-Aware Refinement Delta',
  DEPTH_PLASMA: 'Relative AI Depth (Plasma)',
};

export const Terrain3D: React.FC<Terrain3DProps> = ({
  project,
  floodResult,
  waterLevel,
  onWaterLevelChange,
  settings,
  onUpdateSettings,
  onSelectProbePoint,
  selectedProbe,
  fullViewportMode = false,
  onToggleFullViewport,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const skirtMeshRef = useRef<THREE.Mesh | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const contourGroupRef = useRef<THREE.Group | null>(null);
  const buildingsGroupRef = useRef<THREE.Group | null>(null);
  const gcpGroupRef = useRef<THREE.Group | null>(null);
  const compassGroupRef = useRef<THREE.Group | null>(null);
  const probeMarkerRef = useRef<THREE.Group | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const slicePlaneRef = useRef<THREE.Mesh | null>(null);

  // Orbit & Pan camera state
  const cameraSphericalRef = useRef({
    radius: 135,
    theta: Math.PI * 0.22,
    phi: Math.PI * 0.31,
    target: new THREE.Vector3(0, 4, 0),
  });
  const isDraggingRef = useRef<'NONE' | 'ORBIT' | 'PAN'>('NONE');
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const flythroughTimeRef = useRef(0);

  const [webglLost, setWebglLost] = useState(false);
  const [hoverProbe, setHoverProbe] = useState<ProbePointInspection | null>(null);
  const [showHudControls, setShowHudControls] = useState(true);

  const WORLD_SIZE = 100; // 100 x 100 world units for X/Z plane

  // Helper to convert metric elevation into Three.js Y world coordinate
  const elevationToWorldY = useCallback(
    (elev: number) => {
      const minE = project.terrainAnalysis.minElevation;
      const rangeE = Math.max(1.0, project.terrainAnalysis.elevationRange);
      const norm = (elev - minE) / rangeE;
      return norm * 22.0 * settings.verticalExaggeration;
    },
    [project.terrainAnalysis.minElevation, project.terrainAnalysis.elevationRange, settings.verticalExaggeration]
  );

  // Update camera position from spherical coordinates
  const syncCameraFromSpherical = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    const { radius, theta, phi, target } = cameraSphericalRef.current;
    const clampedPhi = Math.max(0.08, Math.min(Math.PI * 0.47, phi));
    cam.position.x = target.x + radius * Math.sin(clampedPhi) * Math.sin(theta);
    cam.position.y = target.y + radius * Math.cos(clampedPhi);
    cam.position.z = target.z + radius * Math.sin(clampedPhi) * Math.cos(theta);
    cam.lookAt(target);
  }, []);

  const handleResetCamera = useCallback(() => {
    onUpdateSettings({ flythroughActive: false });
    cameraSphericalRef.current = {
      radius: 135,
      theta: Math.PI * 0.22,
      phi: Math.PI * 0.31,
      target: new THREE.Vector3(0, 4, 0),
    };
    syncCameraFromSpherical();
  }, [onUpdateSettings, syncCameraFromSpherical]);

  const handleTopDownMap = useCallback(() => {
    onUpdateSettings({ flythroughActive: false });
    cameraSphericalRef.current = {
      radius: 125,
      theta: 0,
      phi: 0.09,
      target: new THREE.Vector3(0, 0, 0),
    };
    syncCameraFromSpherical();
  }, [onUpdateSettings, syncCameraFromSpherical]);

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07090E');
    scene.fog = new THREE.FogExp2('#07090E', 0.0022);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
    cameraRef.current = camera;
    syncCameraFromSpherical();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // WebGL Context Loss safety
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const onContextRestored = () => {
      setWebglLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    // Three-point scientific studio + solar lighting
    const ambientLight = new THREE.AmbientLight('#94A3B8', 0.75);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight('#E2E8F0', '#1E293B', 0.55);
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#FFFBEB', 1.55);
    sunLight.position.set(65, 95, 55);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLightRef.current = sunLight;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#38BDF8', 0.35);
    rimLight.position.set(-80, 45, -75);
    scene.add(rimLight);

    // Groups for overlays
    const contourGroup = new THREE.Group();
    contourGroupRef.current = contourGroup;
    scene.add(contourGroup);

    const buildingsGroup = new THREE.Group();
    buildingsGroupRef.current = buildingsGroup;
    scene.add(buildingsGroup);

    const gcpGroup = new THREE.Group();
    gcpGroupRef.current = gcpGroup;
    scene.add(gcpGroup);

    const compassGroup = new THREE.Group();
    compassGroupRef.current = compassGroup;
    scene.add(compassGroup);

    const probeMarker = new THREE.Group();
    probeMarkerRef.current = probeMarker;
    scene.add(probeMarker);

    // Build base coordinate grid & cardinal markers
    buildCompassAndDatumGrid(compassGroup, WORLD_SIZE);

    // ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0 && rendererRef.current && cameraRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      renderer.dispose();
    };
  }, [syncCameraFromSpherical]);

  // Update Sun Azimuth & Altitude directional light
  useEffect(() => {
    const sun = sunLightRef.current;
    if (!sun) return;
    const azRad = (settings.sunAzimuth * Math.PI) / 180;
    const altRad = (Math.max(8, settings.sunAltitude) * Math.PI) / 180;
    const dist = 130;
    sun.position.set(
      dist * Math.cos(altRad) * Math.sin(azRad),
      dist * Math.sin(altRad),
      dist * Math.cos(altRad) * Math.cos(azRad)
    );
  }, [settings.sunAzimuth, settings.sunAltitude]);

  // Update compass visibility
  useEffect(() => {
    if (compassGroupRef.current) {
      compassGroupRef.current.visible = settings.showCompassGrid;
    }
  }, [settings.showCompassGrid]);

  // Rebuild / Update 3D Terrain Mesh, Geological Block Skirt, Contours, Buildings & GCP Pins
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const gw = project.gridWidth;
    const gh = project.gridHeight;
    const activeDsm = settings.useRefinedDsm ? project.refinedDsmGrid : project.rawDsmGrid;
    const minE = project.terrainAnalysis.minElevation;
    const maxE = project.terrainAnalysis.maxElevation;
    const rangeE = Math.max(1.0, maxE - minE);

    // 1. Dispose old terrain mesh
    if (terrainMeshRef.current) {
      terrainMeshRef.current.geometry.dispose();
      if (Array.isArray(terrainMeshRef.current.material)) {
        terrainMeshRef.current.material.forEach((m) => m.dispose());
      } else {
        terrainMeshRef.current.material.dispose();
      }
      scene.remove(terrainMeshRef.current);
    }

    const step = settings.meshSubdivisionStep || 1;
    const segX = Math.max(8, Math.floor((gw - 1) / step));
    const segY = Math.max(8, Math.floor((gh - 1) / step));

    const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segX, segY);
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    const vertexCount = posAttr.count;
    const colors = new Float32Array(vertexCount * 3);

    for (let i = 0; i < vertexCount; i++) {
      const vx = posAttr.getX(i); // [-50..50]
      const vz = posAttr.getZ(i); // [-50..50]

      const normX = Math.max(0, Math.min(1, (vx + WORLD_SIZE / 2) / WORLD_SIZE));
      const normY = Math.max(0, Math.min(1, (vz + WORLD_SIZE / 2) / WORLD_SIZE));

      // Cross-section clipping check
      let clipped = false;
      if (settings.crossSectionAxis === 'X_AXIS' && normX > settings.crossSectionPosition) {
        clipped = true;
      } else if (settings.crossSectionAxis === 'Y_AXIS' && normY > settings.crossSectionPosition) {
        clipped = true;
      }

      const gx = Math.min(gw - 1, Math.max(0, Math.round(normX * (gw - 1))));
      const gy = Math.min(gh - 1, Math.max(0, Math.round(normY * (gh - 1))));
      const pIdx = gy * gw + gx;

      const elev = activeDsm[pIdx];
      const worldY = clipped ? -0.2 : elevationToWorldY(elev);
      posAttr.setY(i, worldY);

      // Compute vertex color according to selected MapLayerMode
      let r = 180, g = 180, b = 180;
      const rOrig = project.rgbPixels[pIdx * 4];
      const gOrig = project.rgbPixels[pIdx * 4 + 1];
      const bOrig = project.rgbPixels[pIdx * 4 + 2];

      if (clipped) {
        r = 30;
        g = 41;
        b = 59;
      } else if (settings.layerMode === 'RGB_ORTHO') {
        r = rOrig;
        g = gOrig;
        b = bOrig;
      } else if (settings.layerMode === 'HYPSOMETRIC_DSM') {
        [r, g, b] = sampleScientificColor((elev - minE) / rangeE, 'HYPSOMETRIC');
      } else if (settings.layerMode === 'RGB_DSM_BLEND') {
        const [hr, hg, hb] = sampleScientificColor((elev - minE) / rangeE, 'HYPSOMETRIC');
        r = Math.round(rOrig * 0.56 + hr * 0.44);
        g = Math.round(gOrig * 0.56 + hg * 0.44);
        b = Math.round(bOrig * 0.56 + hb * 0.44);
      } else if (settings.layerMode === 'SLOPE_GRADIENT') {
        const slopeNorm = Math.min(1, project.terrainAnalysis.slopeGrid[pIdx] / 55);
        [r, g, b] = sampleScientificColor(slopeNorm, 'SLOPE');
      } else if (settings.layerMode === 'CONFIDENCE_MAP') {
        [r, g, b] = sampleScientificColor(project.confidence.confidenceGrid[pIdx], 'CONFIDENCE');
      } else if (settings.layerMode === 'LAND_COVER') {
        const [lr, lg, lb] = getLandCoverColor(project.segmentationGrid[pIdx] as LandCoverClass);
        r = Math.round(lr * 0.72 + rOrig * 0.28);
        g = Math.round(lg * 0.72 + gOrig * 0.28);
        b = Math.round(lb * 0.72 + bOrig * 0.28);
      } else if (settings.layerMode === 'RAW_VS_REFINED_DIFF') {
        const diff = Math.abs(project.rawDsmGrid[pIdx] - project.refinedDsmGrid[pIdx]) / Math.max(0.5, rangeE * 0.08);
        [r, g, b] = sampleScientificColor(Math.min(1, diff), 'PLASMA');
      } else if (settings.layerMode === 'DEPTH_PLASMA') {
        [r, g, b] = sampleScientificColor(project.depth.normalizedDepth[pIdx], 'PLASMA');
      }

      // Highlight shoreline edge if water surface is enabled and close to waterLevel
      if (settings.showWaterSurface && !clipped) {
        const distWater = elev - waterLevel;
        if (distWater <= 0 && distWater > -rangeE * 0.025) {
          // Shallow shoreline cyan foam highlight
          r = Math.round(r * 0.45 + 56 * 0.55);
          g = Math.round(g * 0.45 + 189 * 0.55);
          b = Math.round(b * 0.45 + 248 * 0.55);
        } else if (distWater < 0) {
          // Submerged terrain bathymetric tint
          r = Math.round(r * 0.55 + 14 * 0.45);
          g = Math.round(g * 0.55 + 116 * 0.45);
          b = Math.round(b * 0.55 + 144 * 0.45);
        }
      }

      colors[i * 3] = r / 255;
      colors[i * 3 + 1] = g / 255;
      colors[i * 3 + 2] = b / 255;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.08,
      wireframe: settings.wireframe,
      side: THREE.DoubleSide,
    });

    const terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    terrainMeshRef.current = terrainMesh;
    scene.add(terrainMesh);

    // 2. Build 3D Geological Block Skirt / Pedestal around the terrain edges
    if (skirtMeshRef.current) {
      skirtMeshRef.current.geometry.dispose();
      (skirtMeshRef.current.material as THREE.Material).dispose();
      scene.remove(skirtMeshRef.current);
      skirtMeshRef.current = null;
    }

    if (settings.showGeologicalSkirt) {
      const skirtGeom = buildGeologicalSkirtGeometry(
        activeDsm,
        gw,
        gh,
        WORLD_SIZE,
        elevationToWorldY,
        -2.2
      );
      const skirtMat = new THREE.MeshStandardMaterial({
        color: '#1E293B',
        roughness: 0.9,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
      const skirtMesh = new THREE.Mesh(skirtGeom, skirtMat);
      skirtMeshRef.current = skirtMesh;
      scene.add(skirtMesh);
    }

    // 3. Build 3D Topographic Contour Lines
    if (contourGroupRef.current) {
      clearGroup(contourGroupRef.current);
      if (settings.showContours) {
        buildContourLines3D(
          contourGroupRef.current,
          activeDsm,
          gw,
          gh,
          minE,
          maxE,
          settings.contourIntervalMeters,
          WORLD_SIZE,
          elevationToWorldY
        );
      }
    }

    // 4. Build 3D Building Footprints & Roof Extrusions
    if (buildingsGroupRef.current) {
      clearGroup(buildingsGroupRef.current);
      if (settings.showBuildings3D && project.buildings.length > 0) {
        for (const b of project.buildings) {
          const isFlooded = floodResult.affectedBuildingIds.includes(b.id);
          const bw = Math.max(1.4, ((b.gridMaxX - b.gridMinX + 1) / gw) * WORLD_SIZE);
          const bd = Math.max(1.4, ((b.gridMaxY - b.gridMinY + 1) / gh) * WORLD_SIZE);
          const baseY = elevationToWorldY(b.nearbyGroundDsm);
          const topY = elevationToWorldY(b.roofMedianDsm);
          const bh = Math.max(1.2, topY - baseY);

          const wx = (b.centroidX - 0.5) * WORLD_SIZE;
          const wz = (b.centroidY - 0.5) * WORLD_SIZE;

          const boxGeo = new THREE.BoxGeometry(bw, bh, bd);
          const boxMat = new THREE.MeshStandardMaterial({
            color: isFlooded ? '#F43F5E' : '#E2E8F0',
            emissive: isFlooded ? '#881337' : '#0F172A',
            emissiveIntensity: isFlooded ? 0.55 : 0.15,
            roughness: 0.4,
            metalness: 0.2,
            transparent: true,
            opacity: 0.85,
          });
          const boxMesh = new THREE.Mesh(boxGeo, boxMat);
          boxMesh.position.set(wx, baseY + bh * 0.5, wz);
          buildingsGroupRef.current.add(boxMesh);

          // Wireframe outline on building
          const edges = new THREE.EdgesGeometry(boxGeo);
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: isFlooded ? '#FDA4AF' : '#38BDF8' })
          );
          line.position.copy(boxMesh.position);
          buildingsGroupRef.current.add(line);
        }
      }
    }

    // 5. Build 3D Ground Control Point (GCP) Survey Pins
    if (gcpGroupRef.current) {
      clearGroup(gcpGroupRef.current);
      if (settings.showGcpPins && project.calibration.gcps.length > 0) {
        for (const gcp of project.calibration.gcps) {
          const wx = (gcp.normX - 0.5) * WORLD_SIZE;
          const wz = (gcp.normY - 0.5) * WORLD_SIZE;
          const wy = elevationToWorldY(gcp.calibratedElevation);

          const pinGroup = new THREE.Group();
          const stemGeo = new THREE.CylinderGeometry(0.18, 0.18, 4.2, 8);
          const stemMat = new THREE.MeshBasicMaterial({
            color: gcp.isInlier ? '#10B981' : '#F59E0B',
          });
          const stem = new THREE.Mesh(stemGeo, stemMat);
          stem.position.set(wx, wy + 2.1, wz);
          pinGroup.add(stem);

          const headGeo = new THREE.SphereGeometry(0.85, 12, 12);
          const headMat = new THREE.MeshStandardMaterial({
            color: gcp.isInlier ? '#10B981' : '#F59E0B',
            emissive: gcp.isInlier ? '#065F46' : '#78350F',
            roughness: 0.2,
          });
          const head = new THREE.Mesh(headGeo, headMat);
          head.position.set(wx, wy + 4.4, wz);
          pinGroup.add(head);

          gcpGroupRef.current.add(pinGroup);
        }
      }
    }
  }, [
    project,
    settings.layerMode,
    settings.useRefinedDsm,
    settings.verticalExaggeration,
    settings.wireframe,
    settings.meshSubdivisionStep,
    settings.showGeologicalSkirt,
    settings.showContours,
    settings.contourIntervalMeters,
    settings.showBuildings3D,
    settings.showGcpPins,
    settings.showWaterSurface,
    settings.crossSectionAxis,
    settings.crossSectionPosition,
    waterLevel,
    floodResult.affectedBuildingIds,
    elevationToWorldY,
  ]);

  // Update 3D Translucent Flood Water Plane when waterLevel or showWaterSurface changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (waterMeshRef.current) {
      waterMeshRef.current.geometry.dispose();
      (waterMeshRef.current.material as THREE.Material).dispose();
      scene.remove(waterMeshRef.current);
      waterMeshRef.current = null;
    }

    if (!settings.showWaterSurface) return;

    const waterY = elevationToWorldY(waterLevel);
    const waterGeo = new THREE.PlaneGeometry(WORLD_SIZE * 0.996, WORLD_SIZE * 0.996, 48, 48);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: '#0284C7',
      emissive: '#0369A1',
      emissiveIntensity: 0.22,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.45,
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
    });

    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(0, waterY, 0);
    waterMeshRef.current = waterMesh;
    scene.add(waterMesh);
  }, [waterLevel, settings.showWaterSurface, elevationToWorldY]);

  // Update Cross-Section Plane Indicator
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (slicePlaneRef.current) {
      slicePlaneRef.current.geometry.dispose();
      (slicePlaneRef.current.material as THREE.Material).dispose();
      scene.remove(slicePlaneRef.current);
      slicePlaneRef.current = null;
    }

    if (settings.crossSectionAxis === 'NONE') return;

    const planeGeo = new THREE.PlaneGeometry(WORLD_SIZE, 36);
    const planeMat = new THREE.MeshBasicMaterial({
      color: '#06B6D4',
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(planeGeo, planeMat);
    const offset = (settings.crossSectionPosition - 0.5) * WORLD_SIZE;

    if (settings.crossSectionAxis === 'X_AXIS') {
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(offset, 14, 0);
    } else {
      mesh.position.set(0, 14, offset);
    }

    slicePlaneRef.current = mesh;
    scene.add(mesh);
  }, [settings.crossSectionAxis, settings.crossSectionPosition]);

  // Update 3D Selected Probe Pin Marker
  useEffect(() => {
    if (!probeMarkerRef.current) return;
    clearGroup(probeMarkerRef.current);

    const activeProbe = selectedProbe || hoverProbe;
    if (!activeProbe) return;

    const wx = (activeProbe.normX - 0.5) * WORLD_SIZE;
    const wz = (activeProbe.normY - 0.5) * WORLD_SIZE;
    const wy = elevationToWorldY(
      settings.useRefinedDsm ? activeProbe.refinedDsm : activeProbe.rawDsm
    );

    const ringGeo = new THREE.RingGeometry(1.1, 1.65, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#22D3EE',
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(wx, wy + 0.15, wz);
    probeMarkerRef.current.add(ring);

    const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 8, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: '#22D3EE',
      transparent: true,
      opacity: 0.85,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(wx, wy + 4, wz);
    probeMarkerRef.current.add(beam);
  }, [selectedProbe, hoverProbe, settings.useRefinedDsm, elevationToWorldY]);

  // Main Animation Loop (Flythrough + Water Ripple + Rendering)
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // Subtle water surface wave animation
      if (waterMeshRef.current && settings.showWaterSurface) {
        const pos = waterMeshRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const t = now * 0.002;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const z = pos.getZ(i);
          pos.setY(i, Math.sin(x * 0.25 + t) * 0.08 + Math.cos(z * 0.25 + t * 1.2) * 0.08);
        }
        pos.needsUpdate = true;
      }

      // Automated Terrain-Following 3D Flythrough
      if (settings.flythroughActive && cameraRef.current) {
        flythroughTimeRef.current += dt * 0.38 * settings.flythroughSpeed;
        const t = flythroughTimeRef.current;

        const gw = project.gridWidth;
        const gh = project.gridHeight;
        const activeDsm = settings.useRefinedDsm ? project.refinedDsmGrid : project.rawDsmGrid;

        let camX = 0;
        let camZ = 0;
        let lookX = 0;
        let lookZ = 0;

        if (settings.flythroughPattern === 'ORBITAL_SURVEY') {
          const orbitRadius = 56;
          camX = Math.sin(t) * orbitRadius;
          camZ = Math.cos(t) * orbitRadius;
          lookX = Math.sin(t + 0.9) * 12;
          lookZ = Math.cos(t + 0.9) * 12;
        } else if (settings.flythroughPattern === 'VALLEY_CORRIDOR') {
          // Fly along the N-S corridor following terrain curvature
          const progress = ((t * 0.35) % 1) * 0.84 + 0.08;
          camZ = (progress - 0.5) * WORLD_SIZE;
          camX = Math.sin(progress * Math.PI * 2.2) * 14;
          const lookProg = Math.min(0.95, progress + 0.12);
          lookZ = (lookProg - 0.5) * WORLD_SIZE;
          lookX = Math.sin(lookProg * Math.PI * 2.2) * 14;
        } else {
          // RIDGE_INSPECTION figure-8 sweep
          camX = Math.sin(t) * 38;
          camZ = Math.sin(t * 2) * 32;
          lookX = Math.sin(t + 0.35) * 38;
          lookZ = Math.sin((t + 0.35) * 2) * 32;
        }

        // Sample terrain elevation directly beneath camera so camera follows terrain safely
        const normX = Math.max(0, Math.min(1, (camX + WORLD_SIZE / 2) / WORLD_SIZE));
        const normZ = Math.max(0, Math.min(1, (camZ + WORLD_SIZE / 2) / WORLD_SIZE));
        const gx = Math.min(gw - 1, Math.max(0, Math.round(normX * (gw - 1))));
        const gy = Math.min(gh - 1, Math.max(0, Math.round(normZ * (gh - 1))));
        const groundY = elevationToWorldY(activeDsm[gy * gw + gx]);

        const desiredCamY = Math.max(groundY + settings.flythroughAltitudeOffset, 10);

        const lookNormX = Math.max(0, Math.min(1, (lookX + WORLD_SIZE / 2) / WORLD_SIZE));
        const lookNormZ = Math.max(0, Math.min(1, (lookZ + WORLD_SIZE / 2) / WORLD_SIZE));
        const lgx = Math.min(gw - 1, Math.max(0, Math.round(lookNormX * (gw - 1))));
        const lgy = Math.min(gh - 1, Math.max(0, Math.round(lookNormZ * (gh - 1))));
        const lookGroundY = elevationToWorldY(activeDsm[lgy * gw + lgx]);

        cameraRef.current.position.lerp(new THREE.Vector3(camX, desiredCamY, camZ), 0.08);
        cameraRef.current.lookAt(new THREE.Vector3(lookX, lookGroundY + 2, lookZ));
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [
    project,
    settings.flythroughActive,
    settings.flythroughSpeed,
    settings.flythroughAltitudeOffset,
    settings.flythroughPattern,
    settings.showWaterSurface,
    settings.useRefinedDsm,
    elevationToWorldY,
  ]);

  // Raycast helper to inspect exact point on 3D terrain mesh
  const raycastTerrainPoint = useCallback(
    (clientX: number, clientY: number): ProbePointInspection | null => {
      const container = containerRef.current;
      const camera = cameraRef.current;
      const mesh = terrainMeshRef.current;
      if (!container || !camera || !mesh) return null;

      const rect = container.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hits = raycaster.intersectObject(mesh, false);
      if (hits.length === 0) return null;

      const pt = hits[0].point;
      const normX = Math.max(0, Math.min(1, (pt.x + WORLD_SIZE / 2) / WORLD_SIZE));
      const normY = Math.max(0, Math.min(1, (pt.z + WORLD_SIZE / 2) / WORLD_SIZE));

      const gw = project.gridWidth;
      const gh = project.gridHeight;
      const gx = Math.min(gw - 1, Math.max(0, Math.round(normX * (gw - 1))));
      const gy = Math.min(gh - 1, Math.max(0, Math.round(normY * (gh - 1))));
      const idx = gy * gw + gx;

      const bounds = project.geospatial.bounds;
      const lat = bounds ? Number((bounds.north - normY * (bounds.north - bounds.south)).toFixed(5)) : null;
      const lon = bounds ? Number((bounds.west + normX * (bounds.east - bounds.west)).toFixed(5)) : null;

      const refinedVal = project.refinedDsmGrid[idx];
      const isFlooded = refinedVal <= waterLevel;
      const floodDepth = isFlooded ? Math.max(0, waterLevel - refinedVal) : 0;

      return {
        gridX: gx,
        gridY: gy,
        normX: Number(normX.toFixed(3)),
        normY: Number(normY.toFixed(3)),
        lat,
        lon,
        rawDsm: Number(project.rawDsmGrid[idx].toFixed(2)),
        refinedDsm: Number(refinedVal.toFixed(2)),
        relativeDepth: Number(project.depth.normalizedDepth[idx].toFixed(3)),
        slopeDegrees: Number(project.terrainAnalysis.slopeGrid[idx].toFixed(1)),
        aspectDegrees: Number(project.terrainAnalysis.aspectGrid[idx].toFixed(0)),
        confidence: Number(project.confidence.confidenceGrid[idx].toFixed(2)),
        landCover: project.segmentationGrid[idx] as LandCoverClass,
        floodDepth: Number(floodDepth.toFixed(2)),
        isFlooded,
      };
    },
    [project, waterLevel]
  );

  // Mouse handlers for Orbit, Pan, Zoom & Raycast Probe
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (settings.flythroughActive) {
      onUpdateSettings({ flythroughActive: false });
    }
    isDraggingRef.current = e.button === 2 || e.shiftKey ? 'PAN' : 'ORBIT';
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current === 'NONE') {
      const probe = raycastTerrainPoint(e.clientX, e.clientY);
      setHoverProbe(probe);
      return;
    }

    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (isDraggingRef.current === 'ORBIT') {
      cameraSphericalRef.current.theta -= dx * 0.0065;
      cameraSphericalRef.current.phi = Math.max(
        0.08,
        Math.min(Math.PI * 0.47, cameraSphericalRef.current.phi - dy * 0.0065)
      );
      syncCameraFromSpherical();
    } else if (isDraggingRef.current === 'PAN') {
      const panScale = cameraSphericalRef.current.radius * 0.0014;
      const theta = cameraSphericalRef.current.theta;
      cameraSphericalRef.current.target.x -= (Math.cos(theta) * dx - Math.sin(theta) * dy) * panScale;
      cameraSphericalRef.current.target.z += (Math.sin(theta) * dx + Math.cos(theta) * dy) * panScale;
      syncCameraFromSpherical();
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = 'NONE';
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const probe = raycastTerrainPoint(e.clientX, e.clientY);
    if (probe && onSelectProbePoint) {
      onSelectProbePoint(probe);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    cameraSphericalRef.current.radius = Math.max(
      28,
      Math.min(280, cameraSphericalRef.current.radius + e.deltaY * 0.09)
    );
    syncCameraFromSpherical();
  };

  const activeProbeDisplay = hoverProbe || selectedProbe;
  const elevUnit = project.calibration.mode === 'MODE_B_CALIBRATED' ? 'm' : 'rel';

  return (
    <div className="relative w-full h-full bg-[#07090E] select-none overflow-hidden flex flex-col">
      {/* 3D WebGL Canvas Stage */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full flex-1 cursor-crosshair"
      />

      {/* WebGL Context Lost Fallback */}
      {webglLost && (
        <div className="absolute inset-0 z-30 bg-[#07090E]/95 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-base font-semibold text-slate-100 mb-2">WebGL Rendering Context Suspended</p>
          <p className="text-xs text-slate-400 max-w-md mb-4">
            Hardware graphics context was interrupted. Click below to restore the 3D terrain mesh.
          </p>
          <button
            onClick={() => setWebglLost(false)}
            className="px-4 py-2 bg-cyan-500 text-slate-950 text-xs font-semibold rounded hover:bg-cyan-400 transition-colors"
          >
            Restore 3D Viewport
          </button>
        </div>
      )}

      {/* TOP-LEFT HUD: Active Dataset, Calibration Mode & Layer Selector */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-auto max-w-md">
        <div className="bg-[#0B0F19]/85 backdrop-blur-md border border-slate-800/90 rounded px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mb-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                project.calibration.mode === 'MODE_B_CALIBRATED' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-200 font-semibold">
              {project.calibration.mode === 'MODE_B_CALIBRATED'
                ? 'MODE B: TERRAIN-CALIBRATED METRIC DSM'
                : 'MODE A: UNCALIBRATED RELATIVE STRUCTURE'}
            </span>
            <span>·</span>
            <span>{project.isDemoDataset ? 'Demo Dataset' : 'User Upload'}</span>
          </div>

          <div className="text-xs font-medium text-slate-300 truncate">{project.projectName}</div>
          <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>
              Elev: {project.terrainAnalysis.minElevation.toFixed(1)}–{project.terrainAnalysis.maxElevation.toFixed(1)}{' '}
              {elevUnit}
            </span>
            <span>·</span>
            <span>Mean Slope: {project.terrainAnalysis.averageSlopeDegrees.toFixed(1)}°</span>
            <span>·</span>
            <span>Conf: {(project.confidence.averageConfidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Layer Switcher Pill Bar */}
        <div className="bg-[#0B0F19]/85 backdrop-blur-md border border-slate-800/90 rounded p-1.5 flex flex-wrap gap-1">
          {(
            [
              ['RGB_ORTHO', 'RGB Texture'],
              ['RGB_DSM_BLEND', 'RGB + Relief'],
              ['HYPSOMETRIC_DSM', 'DSM Elevation'],
              ['SLOPE_GRADIENT', 'Slope Map'],
              ['CONFIDENCE_MAP', 'Confidence'],
              ['LAND_COVER', 'Segmentation'],
              ['DEPTH_PLASMA', 'AI Depth'],
            ] as Array<[MapLayerMode, string]>
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => onUpdateSettings({ layerMode: mode })}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                settings.layerMode === mode
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TOP-RIGHT HUD: Camera, Flythrough & Viewport Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 pointer-events-auto">
        <button
          onClick={() => onUpdateSettings({ flythroughActive: !settings.flythroughActive })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors whitespace-nowrap ${
            settings.flythroughActive
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
              : 'bg-[#0B0F19]/85 text-slate-200 border-slate-800 hover:border-slate-700'
          }`}
          title="Automated terrain-following 3D camera flythrough"
        >
          {settings.flythroughActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{settings.flythroughActive ? 'Pause Flythrough' : '3D Flythrough'}</span>
        </button>

        <button
          onClick={handleTopDownMap}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-[#0B0F19]/85 text-slate-200 border border-slate-800 hover:border-slate-700 transition-colors whitespace-nowrap"
          title="Snap camera to Nadir 2D/3D top-down ortho view"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>Nadir View</span>
        </button>

        <button
          onClick={handleResetCamera}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-[#0B0F19]/85 text-slate-200 border border-slate-800 hover:border-slate-700 transition-colors whitespace-nowrap"
          title="Reset isometric 3D camera angle"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>Reset 3D</span>
        </button>

        <button
          onClick={() => setShowHudControls((v) => !v)}
          className={`p-1.5 rounded border transition-colors ${
            showHudControls
              ? 'bg-slate-800/90 text-cyan-400 border-slate-700'
              : 'bg-[#0B0F19]/85 text-slate-400 border-slate-800'
          }`}
          title="Toggle 3D Layer & Water HUD Dock"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {onToggleFullViewport && (
          <button
            onClick={onToggleFullViewport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-[#0B0F19]/85 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/10 transition-colors whitespace-nowrap"
            title={fullViewportMode ? 'Exit Full Viewport 3D Map' : 'Expand Full Viewport 3D Map'}
          >
            {fullViewportMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{fullViewportMode ? 'Split Console' : 'Full 3D Map'}</span>
          </button>
        )}
      </div>

      {/* LIVE RAYCAST CROSSHAIR TELEMETRY HUD (Bottom-Left) */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-auto">
        <div className="bg-[#0B0F19]/90 backdrop-blur-md border border-slate-800/90 rounded px-3.5 py-2.5 min-w-[310px]">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <Crosshair className="w-3.5 h-3.5" />
              <span>3D SURFACE TELEMETRY PROBE</span>
            </span>
            <span>
              {activeProbeDisplay
                ? `Grid (${activeProbeDisplay.gridX}, ${activeProbeDisplay.gridY})`
                : 'Hover or click 3D map'}
            </span>
          </div>

          {activeProbeDisplay ? (
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs font-mono tabular-nums">
              <div>
                <span className="text-slate-400 text-[10px] block">ELEVATION</span>
                <span className="text-slate-100 font-semibold">
                  {(settings.useRefinedDsm ? activeProbeDisplay.refinedDsm : activeProbeDisplay.rawDsm).toFixed(2)}{' '}
                  {elevUnit}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">LOCAL SLOPE</span>
                <span className="text-slate-100 font-semibold">
                  {activeProbeDisplay.slopeDegrees.toFixed(1)}° ({activeProbeDisplay.aspectDegrees}°)
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">CONFIDENCE</span>
                <span
                  className={`font-semibold ${
                    activeProbeDisplay.confidence >= 0.75
                      ? 'text-emerald-400'
                      : activeProbeDisplay.confidence >= 0.45
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {(activeProbeDisplay.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">SURFACE CLASS</span>
                <span className="text-slate-200 truncate block">
                  {getLandCoverLabel(activeProbeDisplay.landCover).split('/')[0]}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">FLOOD DEPTH</span>
                <span className={activeProbeDisplay.isFlooded ? 'text-cyan-400 font-semibold' : 'text-slate-400'}>
                  {activeProbeDisplay.isFlooded ? `${activeProbeDisplay.floodDepth.toFixed(2)} ${elevUnit}` : 'Dry (0.0m)'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">COORDINATES</span>
                <span className="text-slate-300">
                  {activeProbeDisplay.lat !== null && activeProbeDisplay.lon !== null
                    ? `${activeProbeDisplay.lat.toFixed(3)}°N, ${activeProbeDisplay.lon.toFixed(3)}°E`
                    : `X:${(activeProbeDisplay.normX * 100).toFixed(0)}% Y:${(activeProbeDisplay.normY * 100).toFixed(0)}%`}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-mono py-1">
              Move cursor across 3D terrain mesh to inspect elevation, slope, confidence, and flood depth.
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM-RIGHT FLOATING 3D CONTROLS & INTERACTIVE WATER LEVEL BAR */}
      {showHudControls && (
        <div className="absolute bottom-3 right-3 z-10 pointer-events-auto bg-[#0B0F19]/90 backdrop-blur-md border border-slate-800/90 rounded p-3 w-80 sm:w-96 flex flex-col gap-2.5">
          {/* Interactive Flood Water Level Slider right inside the 3D Map */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                <span>3D Flood Water Level</span>
              </span>
              <span className="font-mono tabular-nums text-cyan-400 font-semibold">
                {waterLevel.toFixed(1)} {elevUnit} ({floodResult.floodedAreaPercent.toFixed(1)}% flooded)
              </span>
            </div>
            <input
              type="range"
              min={project.terrainAnalysis.minElevation}
              max={project.terrainAnalysis.maxElevation}
              step={Math.max(0.1, project.terrainAnalysis.elevationRange / 200)}
              value={waterLevel}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!settings.showWaterSurface) {
                  onUpdateSettings({ showWaterSurface: true });
                }
                onWaterLevelChange(val);
              }}
              className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
            />
          </div>

          {/* Vertical Exaggeration & Sun Azimuth */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Z-Exaggeration</span>
                <span className="font-mono text-slate-200">{settings.verticalExaggeration.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min={0.4}
                max={3.5}
                step={0.1}
                value={settings.verticalExaggeration}
                onChange={(e) => onUpdateSettings({ verticalExaggeration: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Solar Azimuth</span>
                <span className="font-mono text-slate-200">{settings.sunAzimuth}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={5}
                value={settings.sunAzimuth}
                onChange={(e) => onUpdateSettings({ sunAzimuth: parseInt(e.target.value, 10) })}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* 3D Map Overlays Toggle Bar */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
            <button
              onClick={() => onUpdateSettings({ useRefinedDsm: !settings.useRefinedDsm })}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                settings.useRefinedDsm
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {settings.useRefinedDsm ? 'Refined DSM' : 'Raw DSM'}
            </button>

            <button
              onClick={() => onUpdateSettings({ showWaterSurface: !settings.showWaterSurface })}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                settings.showWaterSurface
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              Flood Plane
            </button>

            <button
              onClick={() => onUpdateSettings({ showContours: !settings.showContours })}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                settings.showContours
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              Contours
            </button>

            <button
              onClick={() => onUpdateSettings({ showBuildings3D: !settings.showBuildings3D })}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                settings.showBuildings3D
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              3D Buildings ({project.buildings.length})
            </button>

            <button
              onClick={() => onUpdateSettings({ showGcpPins: !settings.showGcpPins })}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                settings.showGcpPins
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              GCP Pins ({project.calibration.gcps.length})
            </button>

            <button
              onClick={() => onUpdateSettings({ wireframe: !settings.wireframe })}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                settings.wireframe
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              Wireframe
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Builds a 4-sided geological block skirt around the perimeter of the DSM mesh down to baseY
 * so the 3D terrain map reads as a solid engineered geological volume.
 */
function buildGeologicalSkirtGeometry(
  dsm: Float32Array,
  gw: number,
  gh: number,
  worldSize: number,
  elevationToWorldY: (e: number) => number,
  baseY: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const half = worldSize / 2;

  const pushQuad = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    positions.push(x1, y1, z1, x2, y2, z2, x1, baseY, z1);
    positions.push(x2, y2, z2, x2, baseY, z2, x1, baseY, z1);
  };

  // North edge (y = 0) & South edge (y = gh - 1)
  for (let x = 0; x < gw - 1; x++) {
    const x1 = (x / (gw - 1)) * worldSize - half;
    const x2 = ((x + 1) / (gw - 1)) * worldSize - half;

    const yn1 = elevationToWorldY(dsm[x]);
    const yn2 = elevationToWorldY(dsm[x + 1]);
    pushQuad(x1, yn1, -half, x2, yn2, -half);

    const ys1 = elevationToWorldY(dsm[(gh - 1) * gw + x]);
    const ys2 = elevationToWorldY(dsm[(gh - 1) * gw + x + 1]);
    pushQuad(x2, ys2, half, x1, ys1, half);
  }

  // West edge (x = 0) & East edge (x = gw - 1)
  for (let y = 0; y < gh - 1; y++) {
    const z1 = (y / (gh - 1)) * worldSize - half;
    const z2 = ((y + 1) / (gh - 1)) * worldSize - half;

    const yw1 = elevationToWorldY(dsm[y * gw]);
    const yw2 = elevationToWorldY(dsm[(y + 1) * gw]);
    pushQuad(-half, yw2, z2, -half, yw1, z1);

    const ye1 = elevationToWorldY(dsm[y * gw + (gw - 1)]);
    const ye2 = elevationToWorldY(dsm[(y + 1) * gw + (gw - 1)]);
    pushQuad(half, ye1, z1, half, ye2, z2);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

/**
 * Generates 3D Marching-Squares Topographic Contour Lines across the DSM surface.
 */
function buildContourLines3D(
  group: THREE.Group,
  dsm: Float32Array,
  gw: number,
  gh: number,
  minE: number,
  maxE: number,
  interval: number,
  worldSize: number,
  elevationToWorldY: (e: number) => number
) {
  const range = maxE - minE;
  const safeInterval = Math.max(range / 18, interval || range / 10);
  const half = worldSize / 2;

  const levels: number[] = [];
  const startLevel = Math.ceil(minE / safeInterval) * safeInterval;
  for (let lvl = startLevel; lvl < maxE; lvl += safeInterval) {
    levels.push(lvl);
  }

  for (let li = 0; li < levels.length; li++) {
    const iso = levels[li];
    const worldY = elevationToWorldY(iso) + 0.09;
    const isMajor = li % 3 === 0;
    const vertices: number[] = [];

    for (let y = 0; y < gh - 1; y += 1) {
      const z0 = (y / (gh - 1)) * worldSize - half;
      const z1 = ((y + 1) / (gh - 1)) * worldSize - half;
      for (let x = 0; x < gw - 1; x += 1) {
        const x0 = (x / (gw - 1)) * worldSize - half;
        const x1 = ((x + 1) / (gw - 1)) * worldSize - half;

        const v00 = dsm[y * gw + x];
        const v10 = dsm[y * gw + x + 1];
        const v01 = dsm[(y + 1) * gw + x];
        const v11 = dsm[(y + 1) * gw + x + 1];

        const pts: Array<[number, number]> = [];
        // Top edge
        if ((v00 < iso && v10 >= iso) || (v00 >= iso && v10 < iso)) {
          const t = (iso - v00) / (v10 - v00);
          pts.push([x0 + t * (x1 - x0), z0]);
        }
        // Right edge
        if ((v10 < iso && v11 >= iso) || (v10 >= iso && v11 < iso)) {
          const t = (iso - v10) / (v11 - v10);
          pts.push([x1, z0 + t * (z1 - z0)]);
        }
        // Bottom edge
        if ((v01 < iso && v11 >= iso) || (v01 >= iso && v11 < iso)) {
          const t = (iso - v01) / (v11 - v01);
          pts.push([x0 + t * (x1 - x0), z1]);
        }
        // Left edge
        if ((v00 < iso && v01 >= iso) || (v00 >= iso && v01 < iso)) {
          const t = (iso - v00) / (v01 - v00);
          pts.push([x0, z0 + t * (z1 - z0)]);
        }

        if (pts.length >= 2) {
          vertices.push(pts[0][0], worldY, pts[0][1], pts[1][0], worldY, pts[1][1]);
        }
      }
    }

    if (vertices.length > 0) {
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const lineMat = new THREE.LineBasicMaterial({
        color: isMajor ? '#F8FAFC' : '#94A3B8',
        transparent: true,
        opacity: isMajor ? 0.55 : 0.25,
      });
      group.add(new THREE.LineSegments(lineGeo, lineMat));
    }
  }
}

function buildCompassAndDatumGrid(group: THREE.Group, worldSize: number) {
  const gridHelper = new THREE.GridHelper(worldSize * 1.18, 20, '#1E293B', '#0F172A');
  gridHelper.position.y = -2.25;
  group.add(gridHelper);

  // Outer frame ring
  const half = worldSize * 0.54;
  const borderPts = [
    new THREE.Vector3(-half, -2.2, -half),
    new THREE.Vector3(half, -2.2, -half),
    new THREE.Vector3(half, -2.2, half),
    new THREE.Vector3(-half, -2.2, half),
    new THREE.Vector3(-half, -2.2, -half),
  ];
  const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
  const borderLine = new THREE.Line(
    borderGeo,
    new THREE.LineBasicMaterial({ color: '#334155' })
  );
  group.add(borderLine);

  // North indicator arrow on -Z edge
  const arrowGeo = new THREE.ConeGeometry(1.8, 4.5, 4);
  arrowGeo.rotateX(-Math.PI / 2);
  const arrowMesh = new THREE.Mesh(
    arrowGeo,
    new THREE.MeshBasicMaterial({ color: '#06B6D4' })
  );
  arrowMesh.position.set(0, -2.1, -half - 3.5);
  group.add(arrowMesh);
}

function clearGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children.pop()!;
    if ((child as THREE.Mesh).geometry) {
      (child as THREE.Mesh).geometry.dispose();
    }
    if ((child as THREE.Mesh).material) {
      const m = (child as THREE.Mesh).material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m.dispose();
    }
  }
}
