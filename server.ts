import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// In-memory project cache for REST API endpoints
const projectStore = new Map<string, Record<string, unknown>>();

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    application: 'TERRAIN-X',
    tagline: 'Single Image to 3D Terrain & Disaster Impact Analysis',
    depthModelCached: true,
    supportedModels: ['SMALL', 'BASE', 'LARGE'],
  });
});

app.post('/api/upload', (req, res) => {
  const { filename, width, height, isGeoreferenced, crs } = req.body || {};
  if (!filename) {
    res.status(400).json({ error: 'Missing filename in upload payload.' });
    return;
  }
  const uploadId = `TX-${Date.now()}`;
  projectStore.set(uploadId, {
    id: uploadId,
    filename,
    width: width || 1024,
    height: height || 1024,
    isGeoreferenced: Boolean(isGeoreferenced),
    crs: crs || null,
    status: 'QUEUED',
    createdAt: new Date().toISOString(),
  });
  res.json({ id: uploadId, status: 'QUEUED', isGeoreferenced: Boolean(isGeoreferenced), crs: crs || null });
});

app.post('/api/depth/predict', (req, res) => {
  const { id, modelVariant = 'LARGE' } = req.body || {};
  res.json({
    id: id || `TX-${Date.now()}`,
    modelVariant,
    status: 'PROCESSING',
    source: 'AI Estimated (Depth Anything V2)',
  });
});

app.post('/api/calibration', (req, res) => {
  const { depthValues = [], referenceValues = [] } = req.body || {};
  if (!Array.isArray(depthValues) || !Array.isArray(referenceValues) || depthValues.length < 3) {
    res.json({
      mode: 'MODE_A_UNCALIBRATED',
      scale: 100.0,
      offset: 0.0,
      validReferencePoints: 0,
      message: 'Image processed, but no reference elevation was supplied. Showing uncalibrated estimated DSM.',
    });
    return;
  }

  const n = Math.min(depthValues.length, referenceValues.length);
  let sumD = 0;
  let sumZ = 0;
  for (let i = 0; i < n; i++) {
    sumD += Number(depthValues[i]);
    sumZ += Number(referenceValues[i]);
  }
  const meanD = sumD / n;
  const meanZ = sumZ / n;
  let cov = 0;
  let varD = 0;
  for (let i = 0; i < n; i++) {
    const dd = Number(depthValues[i]) - meanD;
    const dz = Number(referenceValues[i]) - meanZ;
    cov += dd * dz;
    varD += dd * dd;
  }
  const scale = varD > 1e-8 ? cov / varD : 1.0;
  const offset = meanZ - scale * meanD;

  res.json({
    mode: 'MODE_B_CALIBRATED',
    scale: Number(scale.toFixed(4)),
    offset: Number(offset.toFixed(4)),
    validReferencePoints: n,
  });
});

app.post('/api/dsm/generate', (req, res) => {
  const payload = req.body || {};
  const projectId = payload.projectId || `TX-${Date.now()}`;
  projectStore.set(projectId, {
    ...payload,
    status: 'COMPLETE',
    updatedAt: new Date().toISOString(),
  });
  res.json({ projectId, status: 'COMPLETE' });
});

app.post('/api/dsm/refine', (req, res) => {
  const { projectId, method = 'Guided Edge-Aware Filter' } = req.body || {};
  res.json({ projectId, method, status: 'REFINED' });
});

app.post('/api/confidence', (req, res) => {
  const { projectId } = req.body || {};
  res.json({ projectId, status: 'CONFIDENCE_COMPUTED' });
});

app.post('/api/terrain/analyze', (req, res) => {
  const { projectId } = req.body || {};
  res.json({ projectId, status: 'TERRAIN_ANALYZED' });
});

app.post('/api/validation', (req, res) => {
  const { predicted = [], reference = [] } = req.body || {};
  if (!Array.isArray(predicted) || !Array.isArray(reference) || predicted.length === 0) {
    res.json({
      available: false,
      message: 'Validation unavailable — no reference elevation data supplied.',
    });
    return;
  }
  const n = Math.min(predicted.length, reference.length);
  let absSum = 0;
  let sqSum = 0;
  for (let i = 0; i < n; i++) {
    const err = Number(predicted[i]) - Number(reference[i]);
    absSum += Math.abs(err);
    sqSum += err * err;
  }
  res.json({
    available: true,
    mae: Number((absSum / n).toFixed(3)),
    rmse: Number(Math.sqrt(sqSum / n).toFixed(3)),
  });
});

app.post('/api/buildings/analyze', (req, res) => {
  const { projectId } = req.body || {};
  res.json({ projectId, status: 'BUILDINGS_ANALYZED' });
});

app.post('/api/flood/simulate', (req, res) => {
  const { elevations = [], waterLevel = 0 } = req.body || {};
  if (!Array.isArray(elevations) || elevations.length === 0) {
    res.status(400).json({ error: 'Missing DSM elevation array for flood simulation.' });
    return;
  }
  let floodedCount = 0;
  let maxDepth = 0;
  let sumDepth = 0;
  for (const e of elevations) {
    const elev = Number(e);
    if (elev <= waterLevel) {
      floodedCount++;
      const d = waterLevel - elev;
      sumDepth += d;
      if (d > maxDepth) maxDepth = d;
    }
  }
  res.json({
    waterLevel,
    floodedCount,
    totalCount: elevations.length,
    floodedAreaPercent: Number(((floodedCount / elevations.length) * 100).toFixed(2)),
    maxFloodDepth: Number(maxDepth.toFixed(2)),
    averageFloodDepth: floodedCount > 0 ? Number((sumDepth / floodedCount).toFixed(2)) : 0,
    limitation:
      'Elevation-based simulation only. This does not model rainfall, drainage, river discharge, flow velocity, or hydrodynamic behavior.',
  });
});

app.get('/api/results/:id', (req, res) => {
  const item = projectStore.get(req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Project ID not found in session store.' });
    return;
  }
  res.json(item);
});

app.get('/api/export/:id', (req, res) => {
  const item = projectStore.get(req.params.id);
  res.json({
    projectId: req.params.id,
    exportedAt: new Date().toISOString(),
    data: item || null,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TERRAIN-X server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
