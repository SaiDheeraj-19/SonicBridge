# SonicBridge Production Deployment Guide

## Architecture Overview
SonicBridge is a high-performance, real-time translation system utilizing a multi-layered voice isolation pipeline.

- **Frontend:** React (Vite) + Tailwind CSS (Browser-side WebRTC noise suppression).
- **Primary Backend:** Node.js (Express) + WebSocket (Coordination, Sarvam API integration).
- **AI Microservice:** Python (FastAPI) + SpeechBrain (Speaker Verification & Enrollment).
- **Isolation Layers:** WebRTC constraints → RNNoise → VAD → SpeechBrain.

---

## 🚀 Environment Setup

### 1. API Keys
Create a `.env` file in the `server/` directory:
```env
PORT=5000
SARVAM_API_KEY=your_key_here
SPEECHBRAIN_URL=http://localhost:8000
```

### 2. Infrastructure Requirements
- **Server:** Ubuntu 22.04 LTS (Recommended)
- **Cores:** 4+ vCPU (For handling concurrent TTS/Translation)
- **RAM:** 8GB+ (SpeechBrain models require ~2GB)
- **GPU (Optional but Recommended):** NVIDIA T4 or better for <50ms speaker verification.

---

## 🛠 Deployment via Docker (Recommended)

Run the entire stack using the provided `docker-compose.yml`:

```bash
docker-compose up -d --build
```

This will spin up:
1. **SonicBridge Backend:** Node.js server.
2. **SpeechBrain Service:** Python embedding worker.
3. **Redis:** For state persistence across clusters.

---

## 🔒 Security & Optimization Notes

### SSL / WSS (Crucial for Production)
Browsers block `getUserMedia` on non-HTTPS origins.
Use NGINX as a reverse proxy with Let's Encrypt:
```nginx
location /ws {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
}
```

### RNNoise Integration
To activate the optional Layer 2 (RNNoise), install the native bindings on your production machine:
```bash
npm install node-rnnoise
```
Then update `voiceIsolationService.js` to process the PCM chunks via the `Rnnoise` instance.

### Performance Targets
- **VAD Threshold:** Current threshold is `50` (RMS). Adjust this in `voiceIsolationService.js` based on your microphone's noise floor.
- **Embedding Verification:** The 0.75 cosine similarity threshold is optimized for English/Hindi speaker locking. For higher security, increase to 0.82.

---

## 📦 Phase 2 Upgrades
- **Redis Scaling:** Connect Node.js to Redis to handle 10,000+ rooms across multiple containers.
- **Beamforming:** Use specialized hardware for host mic to increase STT accuracy.
- **Diarization:** Update `speechbrain_service` to allow multiple hosts (Panel Discussion mode).
