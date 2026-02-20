# SonicBridge 🎙️⚡🌐

**SonicBridge** is a production-ready, real-time speech-to-speech translation platform. It captures live audio from the host, processes it with advanced noise reduction, translates it via Sarvam AI, and plays back the translated speech with ultra-low latency.

## Key Features
- **Real-time Streaming**: End-to-end latency < 1.5s using WebSockets and AudioWorklet.
- **Premium UI**: Sleek dark mode design with electric blue accents and micro-animations.
- **Native Noise Suppression**: Leverages browser WebRTC APIs for high-quality audio capture.
- **Voice Isolation**: 4-layer architecture including Neural Noise Suppression and Speaker Verification.
- **Instant Playback**: Decodes and plays audio chunks as they arrive.
- **Secure Sessions**: Host-locking voice embeddings ensure only the host is translated.

---

## Technical Stack

### Frontend
- **React (Vite)**: Modern, fast frontend framework.
- **Tailwind CSS**: Custom dark-theme design system.
- **Web Audio API & AudioWorklet**: Sample-accurate audio processing in a separate thread.
- **WebSocket**: Full-duplex communication for chunks and metadata.
- **Framer Motion**: Smooth UI transitions and animations.

### Backend
- **Node.js & Express**: Scalable coordination backend.
- **Python (FastAPI)**: AI Microservice for SpeechBrain voice locking.
- **Sarvam AI APIs**:
  - **Saaras v2.5 (Streaming)**: Real-time ASR.
  - **Mayura v1**: Specialized translation.
  - **Bulbul v3**: Premium neural TTS.
- **Voice Isolation Layers**:
  1. Browser WebRTC Constraints
  2. Server RNNoise Filtering
  3. WebRTC Voice Activity Detection (VAD)
  4. Speaker Embedding Verification (SpeechBrain)

---

## Installation & Setup

### Prerequisites
- Node.js (v18+)
- Python 3.10+ (For SpeechBrain service)
- Sarvam AI API Key (Get it from [sarvam.ai](https://www.sarvam.ai/))

### Option 1: Docker (Fastest)
```bash
docker-compose up -d --build
```

### Option 2: Manual Setup

#### 1. AI Microservice (Python)
```bash
cd server/speechbrain_service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

#### 2. Backend (Node.js)
```bash
cd server
npm install
npm run dev
```

#### 3. Frontend (React)
```bash
cd client
npm install
npm run dev
```

### Environment Variables
Create a `.env` file in the `server` directory:
```env
SARVAM_API_KEY=your_key_here
SPEECHBRAIN_URL=http://localhost:8000
PORT=5000
```

---

## Project Structure
```text
/client
  /public
    audio-processor.js      # AudioWorklet Processor logic
  /src
    /components              # UI components
    /hooks                   # Custom hooks (WSS, Audio)
    App.jsx                  # Main interface
    index.css                # Tailwind & Global styles
/server
  /routes                    # API endpoints
  /services                  # Sarvam AI integration logic
  /utils                     # Logging and helpers
  server.js                  # WebSocket & Express server
```

---

## Deployment Note
- **Frontend**: Deploy to Vercel/Netlify.
- **Backend**: Deploy to EC2, Render, or DigitalOcean. Ensure WebSocket support is enabled in your proxy (Nginx).
- **Security**: Always use HTTPS for microphone permissions.

---
Built with ❤️ for real-time global communication.
