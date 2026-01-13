// Smart Traffic Control System - AI-ish Rule-based Signals + TomTom Traffic
// Backend: Node.js + Express

const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- TomTom config (use env or fallback to demo key) ---
const TOMTOM_API_KEY =
  process.env.TOMTOM_API_KEY || 'itBG0NdfsfLj9RbxP4mJ712aHfU0eu7K';

// --- Intersections (Pune examples) ---
const INTERSECTIONS = [
  {
    id: 0,
    name: 'Swargate Junction',
    lat: 18.5018,
    lng: 73.8583,
  },
  {
    id: 1,
    name: 'Kothrud Depot',
    lat: 18.5074,
    lng: 73.8077,
  },
  {
    id: 2,
    name: 'Shivaji Nagar',
    lat: 18.5308,
    lng: 73.847,
  },
  {
    id: 3,
    name: 'Hadapsar',
    lat: 18.5089,
    lng: 73.926,
  },
];

// --- Simulation state ---
let simTime = 0;
let intersections = [];
let detectedAmbulances = 0;

function initIntersections() {
  intersections = INTERSECTIONS.map((it) => ({
    id: it.id,
    name: it.name,
    lat: it.lat,
    lng: it.lng,
    phase: 0, // 0=N,1=E,2=S,3=W
    queues: [5, 5, 5, 5], // vehicles waiting per approach
    traffic: [0.3, 0.3, 0.3, 0.3], // congestion score per approach
  }));
}

initIntersections();

// --- TomTom helper: get congestion score 0..1 around (lat,lng) ---
async function getTrafficScore(lat, lng) {
  if (!TOMTOM_API_KEY) {
    return 0.3;
  }

  const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${TOMTOM_API_KEY}&point=${lat},${lng}&unit=KMPH`;
  try {
    const res = await axios.get(url, { timeout: 3000 });
    const data = res.data && res.data.flowSegmentData;
    if (!data) return 0.3;

    const current = data.currentSpeed;
    const free = data.freeFlowSpeed || current || 1;

    let congestion = 0;
    if (free > 0) {
      congestion = 1 - current / free;
    }
    congestion = Math.max(0, Math.min(1, congestion));
    return congestion;
  } catch (err) {
    console.error('TomTom traffic error:', err.message);
    // Fallback: mild congestion
    return 0.3;
  }
}

// --- Simulation step: AI-ish rule-based using traffic pressure ---
async function stepSimulation() {
  simTime += 1;

  // 1) Update congestion from TomTom for each intersection
  //    (sequential for simplicity)
  for (let i = 0; i < intersections.length; i++) {
    const inter = intersections[i];
    const congestion = await getTrafficScore(inter.lat, inter.lng);
    // same congestion for all approaches (can be extended later)
    inter.traffic = [congestion, congestion, congestion, congestion];
  }

  // 2) Decide phases & update queues
  intersections = intersections.map((inter) => {
    const { queues, traffic } = inter;

    // "pressure" = queue * congestion
    const pressures = queues.map((q, idx) => q * (traffic[idx] || 0.5));

    // pick direction with max pressure
    let bestIdx = 0;
    let bestValue = -Infinity;
    pressures.forEach((val, idx) => {
      if (val > bestValue) {
        bestValue = val;
        bestIdx = idx;
      }
    });

    const nextPhase = bestIdx;

    const newQueues = queues.map((q, idx) => {
      // Arrivals: more congestion => slightly higher arrival probability
      const arrivalProb = 0.3 + (traffic[idx] || 0.5) * 0.4;
      const arrivals = Math.random() < arrivalProb ? 1 : 0;
      let updated = q + arrivals;

      // Departures: cars leaving if this direction is green
      if (idx === nextPhase) {
        const departures = 2 + Math.floor(Math.random() * 2); // 2-3 cars
        updated = Math.max(0, updated - departures);
      }

      return updated;
    });

    return {
      ...inter,
      phase: nextPhase,
      queues: newQueues,
    };
  });
}

// --- Metrics for dashboard ---
function getMetrics() {
  const totalQueue = intersections
    .map((i) => i.queues.reduce((a, b) => a + b, 0))
    .reduce((a, b) => a + b, 0);

  const avgQueue = intersections.length > 0 ? totalQueue / (intersections.length * 4) : 0;

  const avgDelay = avgQueue * 2; // approx seconds

  const avgTraffic =
    intersections.length > 0
      ? intersections
          .map((i) => i.traffic.reduce((a, b) => a + b, 0) / 4)
          .reduce((a, b) => a + b, 0) / intersections.length
      : 0.3;

  const activeAlerts =
    (avgQueue > 6 ? 1 : 0) + (avgTraffic > 0.6 ? 1 : 0) + (detectedAmbulances > 0 ? 1 : 0);

  return {
    totalQueue,
    avgQueue,
    avgDelay,
    avgTraffic,
    activeAlerts,
  };
}

// --- API routes ---

app.get('/api/dashboard', (req, res) => {
  const metrics = getMetrics();
  res.json({
    total_intersections: intersections.length,
    active_alerts: metrics.activeAlerts,
    detected_ambulances: detectedAmbulances,
    avg_congestion: metrics.avgTraffic,
    avg_delay: metrics.avgDelay,
    avg_queue: metrics.avgQueue,
    last_updated: Date.now() / 1000,
  });
});

app.get('/api/sim/state', (req, res) => {
  res.json({
    time: simTime,
    intersections,
  });
});

app.post('/api/sim/step', async (req, res) => {
  await stepSimulation();
  res.json({
    state: {
      time: simTime,
      intersections,
    },
    action: 'traffic_pressure_based',
  });
});

app.post('/api/ambulance/detect', (req, res) => {
  // Fake detection: 40% chance of "ambulance detected"
  const detected = Math.random() < 0.4;
  let confidence = 0.2 + Math.random() * 0.7; // 0.2 - 0.9
  if (!detected) {
    confidence = 0.1 + Math.random() * 0.3;
  } else {
    detectedAmbulances += 1;
  }

  res.json({
    detected,
    confidence,
    message: detected ? 'Ambulance detected' : 'No ambulance detected in current frame',
  });
});

// Optional: endpoint for future ambulance GPS updates (simulator.js)
app.post('/api/ambulance/update', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Static files (frontend) ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Smart Traffic Control backend listening on http://localhost:${PORT}`);
  console.log('TomTom key:', TOMTOM_API_KEY ? 'configured' : 'missing');
});
