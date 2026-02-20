# SonicBridge 100% Free Deployment Guide 🚀

Since this project uses heavy AI (SpeechBrain) and WebSockets, we split the deployment across three free services.

---

## 1. AI Microservice (Hugging Face Spaces)
**Free Tier:** 16GB RAM (CPU), Unlimited usage.

1. Go to [Hugging Face Spaces](https://huggingface.co/new-space).
2. Name your space (e.g., `sonic-ai`).
3. Select **Docker** as the SDK.
4. Choose **Blank** template.
5. Once the space is created, go to **Files and versions** -> **Upload files**.
6. Upload everything from `/server/speechbrain_service/` (including the `Dockerfile`, `main.py`, and `requirements.txt`).
7. Hugging Face will build and deploy. Once "Running", you will have a URL like: `https://saidheeraj-sonic-ai.hf.space`.

---

## 2. Node Backend (Render.com)
**Free Tier:** WebSockets enabled, 512MB RAM.

1. Go to [Render Dashboard](https://dashboard.render.com/).
2. **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Settings:
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. **Environment Variables:**
   - `SARVAM_API_KEY`: your_key
   - `SPEECHBRAIN_URL`: `https://your-name-sonic-ai.hf.space` (from Step 1)
   - `PORT`: `10000` (Render default)

*Note: Render free services sleep after 15m. The first request after a break will take ~30s.*

---

## 3. Frontend (Vercel)
**Free Tier:** Global CDN, SSL included.

1. Go to [Vercel](https://vercel.com/new).
2. Connect your GitHub repository.
3. Settings:
   - **Root Directory:** `client`
   - **Framework Preset:** `Vite`
4. **Environment Variables:**
   - `VITE_WS_URL`: `wss://your-render-app-name.onrender.com` (use `wss://` for secure websockets)

---

## ✅ Deployment Checklist
1. [ ] Uploaded Python files to Hugging Face.
2. [ ] Configured Node Backend on Render with Hugging Face URL.
3. [ ] Configured Vercel with Render's `wss://` URL.
4. [ ] Refresh Vercel and test your room!
