# Deployment Guide (Local / Docker)

## Local

```bash
npm install
npm start
# open http://localhost:3000
```

## Docker

```bash
docker build -t smart-traffic-control .
docker run -p 3000:3000 -e TOMTOM_API_KEY=YOUR_KEY smart-traffic-control
```
