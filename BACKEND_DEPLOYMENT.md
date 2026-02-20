# SonicBridge Backend Deployment (Railway)

The backend consists of two main services that should be deployed to **Railway.app** for best performance and WebSocket support.

## 1. Primary Backend (Node.js)
- **Repo Root:** `/server`
- **Build Method:** Docker (automatically uses `server/Dockerfile`)
- **Environment Variables:**
  - `SARVAM_API_KEY`: Your Sarvam API Key.
  - `SPEECHBRAIN_URL`: Link to your SpeechBrain service (see below).
  - `PORT`: `5001` (Railway will provide this automatically).

## 2. AI Microservice (SpeechBrain)
- **Repo Root:** `/server/speechbrain_service`
- **Build Method:** Docker (automatically uses `server/speechbrain_service/Dockerfile`)
- **Note:** This service requires ~2GB of RAM. If deployment fails, increase the Railway memory limit to 4GB.

---

## 🚀 Step-by-Step Instructions

### Step 1: Push Code to GitHub
Ensure all recent changes are pushed:
```bash
git add .
git commit -m "chore: prepare backend for Railway deployment"
git push
```

### Step 2: Railway Setup
1. Log in to [Railway.app](https://railway.app/).
2. Create a **New Project** -> **Enroll from GitHub**.
3. Select the `SonicBridge` repository.
4. **Deploy Node Backend:**
   - In the settings, change **Root Directory** to `server`.
   - Add the `SARVAM_API_KEY` variable.
5. **Deploy SpeechBrain Service:**
   - Add another service to the same project from the same repo.
   - Change **Root Directory** to `server/speechbrain_service`.
   - Railway will provide a public/internal URL for this service.
6. **Cross-Service Link:**
   - Copy the URL of the SpeechBrain service.
   - Go to the Node Backend service and add the variable `SPEECHBRAIN_URL` with that value.

### Step 3: Verify
- Check the logs in Railway.
- Visit `https://your-backend.railway.app/health` to confirm the server is live.
