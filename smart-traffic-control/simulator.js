// Ambulance route simulator (optional helper script)

const axios = require('axios');

const AMBULANCE_ID = process.argv[2] || 'AMB-SIM-001';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

let lat = 18.5204; // Pune-ish
let lng = 73.8567;

function randomStep() {
  lat += (Math.random() - 0.5) * 0.01;
  lng += (Math.random() - 0.5) * 0.01;
}

async function sendUpdate() {
  randomStep();
  try {
    await axios.post(`${SERVER_URL}/api/ambulance/update`, {
      id: AMBULANCE_ID,
      position: { lat, lng },
      status: 'en_route',
      timestamp: Date.now(),
    });
    console.log('Sent update from', AMBULANCE_ID, lat.toFixed(4), lng.toFixed(4));
  } catch (err) {
    console.error('Error sending update:', err.message);
  }
}

console.log('Starting ambulance simulator for', AMBULANCE_ID);
setInterval(sendUpdate, 5000);
