// Frontend logic for Smart Traffic Control (Node backend + TomTom)
/* global tt */

const API_BASE = ''; // same origin

// Global status
const appStatus = document.getElementById('app-status');

// Dashboard metric elements
const metricIntersections = document.getElementById('metric-intersections');
const metricAlerts = document.getElementById('metric-alerts');
const metricAmbulances = document.getElementById('metric-ambulances');
const metricCongestion = document.getElementById('metric-congestion');

// Ambulance UI
const btnDetectAmbulance = document.getElementById('btn-detect-ambulance');
const ambulanceLastEl = document.getElementById('ambulance-last');
const ambulanceConfEl = document.getElementById('ambulance-conf');

// Location + layers
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const toggleFlow = document.getElementById('toggle-flow');
const toggleIncidents = document.getElementById('toggle-incidents');

// Signals container (two places: overview & signals tab)
const signalsContainerOverview = document.getElementById('signals-container');
const signalsContainerSignalsTab = document.getElementById('signals-container-signals-tab');

// Clock
const clockEl = document.getElementById('clock');

// Tabs
const tabButtons = document.querySelectorAll('.nav-tab');
const tabPanels = document.querySelectorAll('.tab');

let map;
let flowTier;
let incidentsTier;

const TOMTOM_API_KEY = 'itBG0NdfsfLj9RbxP4mJ712aHfU0eu7K'; // same key

function setAppStatus(text) {
  if (appStatus) appStatus.textContent = text;
}

// ------- Clock -------

function updateClock() {
  if (!clockEl) return;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  clockEl.textContent = hours + ':' + minutes;
}

// ------- Backend integration -------

async function checkBackendHealth() {
  try {
    const res = await fetch('/health');
    if (!res.ok) throw new Error('not ok');
    setAppStatus('Backend: connected');
  } catch (err) {
    setAppStatus('Backend: offline');
  }
}

async function loadDashboardMetrics() {
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error('metrics error');
    const data = await res.json();
    metricIntersections.textContent = data.total_intersections;
    metricAlerts.textContent = data.active_alerts;
    metricAmbulances.textContent = data.detected_ambulances;
    metricCongestion.textContent = data.avg_congestion.toFixed(2);
  } catch (err) {
    console.error(err);
  }
}

// Ambulance detection
async function runAmbulanceDetection() {
  if (!btnDetectAmbulance) return;
  btnDetectAmbulance.disabled = true;
  btnDetectAmbulance.textContent = 'Detecting...';

  try {
    const res = await fetch('/api/ambulance/detect', {
      method: 'POST'
    });
    if (!res.ok) throw new Error('detection failed');
    const data = await res.json();
    ambulanceLastEl.textContent = data.message;
    ambulanceConfEl.textContent = (data.confidence * 100).toFixed(1) + '%';
    loadDashboardMetrics();
  } catch (err) {
    console.error(err);
    ambulanceLastEl.textContent = 'Error running detection';
    ambulanceConfEl.textContent = '–';
  } finally {
    btnDetectAmbulance.disabled = false;
    btnDetectAmbulance.textContent = 'Run Ambulance Detection';
  }
}

// ------- TomTom map -------

function initMap() {
  if (!window.tt) {
    console.error('TomTom SDK not available');
    return;
  }

  tt.setProductInfo('smart-traffic-control', '3.0.0');

  map = tt.map({
    key: TOMTOM_API_KEY,
    container: 'map',
    style: 'tomtom://vector/1/basic-main',
    center: [78.9629, 22.5937], // India
    zoom: 5
  });

  const styleBase = 'tomtom://vector/1/';
  const styleS1 = 's1';
  const styleRelative = 'relative';
  const refreshTimeInMillis = 30000;

  flowTier = new tt.TrafficFlowTilesTier({
    key: TOMTOM_API_KEY,
    style: styleBase + styleRelative,
    refresh: refreshTimeInMillis
  });

  incidentsTier = new tt.TrafficIncidentTier({
    key: TOMTOM_API_KEY,
    incidentDetails: { style: styleS1 },
    incidentTiles: { style: styleBase + styleS1 },
    refresh: refreshTimeInMillis
  });

  map.on('load', function () {
    syncFlowLayer();
    syncIncidentLayer();
  });
}

function syncFlowLayer() {
  if (!map || !flowTier) return;
  if (toggleFlow && toggleFlow.checked) {
    map.addTier(flowTier);
  } else {
    map.removeTier(flowTier.getId());
  }
}

function syncIncidentLayer() {
  if (!map || !incidentsTier) return;
  if (toggleIncidents && toggleIncidents.checked) {
    map.addTier(incidentsTier);
  } else {
    map.removeTier(incidentsTier.getId());
  }
}

// Search location via TomTom Fuzzy Search
async function searchLocation(query) {
  if (!query || !window.tt || !tt.services) return;

  try {
    const service = tt.services.fuzzySearch({
      key: TOMTOM_API_KEY,
      query: query,
      countrySet: 'IN',
      limit: 1
    });

    const results = await service.go();
    if (!results || !results.results || results.results.length === 0) {
      return;
    }

    const res = results.results[0];
    const position = res.position;

    const lon = position.lng;
    const lat = position.lat;

    map.flyTo({ center: [lon, lat], zoom: 13 });
  } catch (err) {
    console.error(err);
  }
}

// ------- Simulation: traffic signals -------

async function stepSimulation() {
  try {
    const res = await fetch('/api/sim/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'pressure_based' })
    });
    if (!res.ok) throw new Error('sim step failed');
    const data = await res.json();
    renderSignals(data.state);
  } catch (err) {
    console.error(err);
  }
}

function renderSignals(state) {
  if (!state) return;

  const lanes = ['North', 'East', 'South', 'West'];

  // Overview container
  if (signalsContainerOverview) {
    signalsContainerOverview.innerHTML = '';
  }

  // Signals tab container
  if (signalsContainerSignalsTab) {
    signalsContainerSignalsTab.innerHTML = '';
  }

  state.intersections.forEach(function (inter) {
    const makeCard = function () {
      const card = document.createElement('article');
      card.className = 'signal-card';

      const header = document.createElement('div');
      header.className = 'signal-header';

      const title = document.createElement('h3');
      title.textContent = inter.name || ('Intersection ' + inter.id);

      const pill = document.createElement('span');
      pill.className = 'phase-pill';
      pill.textContent = 'Phase ' + inter.phase;

      header.appendChild(title);
      header.appendChild(pill);
      card.appendChild(header);

      const queuesWrapper = document.createElement('div');
      queuesWrapper.className = 'signal-queues';

      inter.queues.forEach(function (q, idx) {
        const row = document.createElement('div');
        row.className = 'queue-item';
        if (idx === inter.phase) {
          row.classList.add('green');
        }

        const label = document.createElement('span');
        label.className = 'queue-label';
        label.textContent = lanes[idx];

        const value = document.createElement('span');
        value.className = 'queue-value';
        value.textContent = q.toFixed(0);

        row.appendChild(label);
        row.appendChild(value);
        queuesWrapper.appendChild(row);
      });

      card.appendChild(queuesWrapper);
      return card;
    };

    if (signalsContainerOverview) {
      signalsContainerOverview.appendChild(makeCard());
    }
    if (signalsContainerSignalsTab) {
      signalsContainerSignalsTab.appendChild(makeCard());
    }
  });
}

// ------- Tabs -------

function initTabs() {
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      tabButtons.forEach((b) => b.classList.toggle('nav-tab--active', b === btn));
      tabPanels.forEach((panel) => {
        panel.classList.toggle(
          'tab--active',
          panel.getAttribute('data-tab-panel') === target
        );
      });
    });
  });
}

// ------- Event listeners & boot -------

if (btnDetectAmbulance) {
  btnDetectAmbulance.addEventListener('click', runAmbulanceDetection);
}

if (toggleFlow) {
  toggleFlow.addEventListener('change', syncFlowLayer);
}
if (toggleIncidents) {
  toggleIncidents.addEventListener('change', syncIncidentLayer);
}

if (searchForm) {
  searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const query = (searchInput.value || '').trim();
    if (query) {
      searchLocation(query);
    }
  });
}

window.addEventListener('load', function () {
  initTabs();
  updateClock();
  setInterval(updateClock, 1000 * 30);

  checkBackendHealth();
  loadDashboardMetrics();
  initMap();

  stepSimulation();
  setInterval(function () {
    stepSimulation();
    loadDashboardMetrics();
  }, 1000);
});
