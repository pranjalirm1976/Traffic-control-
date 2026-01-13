# 🚦 Smart Traffic Control System - AI-style Signals + TomTom Traffic

This project simulates **real-time traffic light control** using an
AI-style rule-based controller that uses **live TomTom traffic data**
around several junctions in **Pune**, and visualises everything in a
futuristic calm dashboard UI.

## Features

- Node.js + Express backend
- TomTom Traffic Flow API integration
- AI-style rule-based controller:
  - Uses queue length × congestion ("pressure") to pick next green phase
- Simulated intersections in Pune:
  - Swargate, Kothrud Depot, Shivaji Nagar, Hadapsar
- Futuristic glass UI (no login):
  - Live TomTom traffic map of India
  - Signal cards showing phases & queues
  - Ambulance detection demo
  - Tabs: Overview, Signals, Ambulances, Analytics

## Run locally

```bash
npm install
npm start
# open http://localhost:3000
```

You can configure your TomTom key in `.env.example`.
