# API Documentation (Local Demo)

Base URL: `http://localhost:3000`

- `GET /health`
  - Simple health check.

- `GET /api/dashboard`
  - Returns high-level metrics:
    - total_intersections
    - active_alerts
    - detected_ambulances
    - avg_congestion (0..1)
    - avg_delay (approx seconds)
    - avg_queue

- `GET /api/sim/state`
  - Returns the full current simulation state:
    - time
    - intersections[] (id, name, lat, lng, phase, queues[], traffic[])

- `POST /api/sim/step`
  - Advances the simulation by one step:
    - Pulls TomTom traffic around each intersection
    - Updates queues and phases using pressure-based logic
  - Returns:
    - { state, action }

- `POST /api/ambulance/detect`
  - Demo endpoint simulating an ambulance detection model.

- `POST /api/ambulance/update`
  - Demo endpoint for future GPS updates (used by simulator.js).
