# SonicBridge Backend Deployment (Railway)

The backend consists of two main services that should be deployed to **Railway.app** for best performance and WebSocket support. (Use this if you have Railway credits).

## 1. Primary Backend (Node.js)
- **Repo Root:** `/server`
- **Build Method:** Docker (automatically uses `server/Dockerfile`)
- **Environment Variables:**
  - `SARVAM_API_KEY`: Your Sarvam API Key.
  - `SPEECHBRAIN_URL`: Link to your SpeechBrain service (see below).
  - `PORT`: `5001`.

## 2. AI Microservice (SpeechBrain)
- **Repo Root:** `/server/speechbrain_service`
- **Build Method:** Docker (automatically uses `server/speechbrain_service/Dockerfile`)
- **Note:** This service requires ~2GB of RAM.

---

## 🚀 Step-by-Step Instructions

### Step 1: Push Code to GitHub
Ensure all recent changes are pushed.

### Step 2: Railway Setup
1. Log in to [Railway.app](https://railway.app/).
2. Create a **New Project** -> **Deploy from GitHub repo**.
3. Select the `SonicBridge` repository.
4. Add the Node service (`/server`) and the Python service (`/server/speechbrain_service`).
5. Configure environment variables.
