# SonicBridge 🎙️⚡🌐

**SonicBridge** is a production-ready, real-time speech-to-speech translation platform. It captures live audio from the host, processes it with advanced noise reduction, translates it via Sarvam AI, and plays back the translated speech with ultra-low latency.

## Key Features
- **Real-time Streaming**: End-to-end latency < 1.5s using WebSockets and AudioWorklet.
- **Premium UI**: Sleek dark mode design with electric blue accents and micro-animations.
- **Native Noise Suppression**: Leverages browser WebRTC APIs for high-quality audio capture.
- **Multi-language Support**: Supports 10+ Indian languages and English.
- **Instant Playback**: Decodes and plays audio chunks as they arrive.

---

## Technical Stack

### Frontend
- **React (Vite)**: Modern, fast frontend framework.
- **Tailwind CSS**: Custom dark-theme design system.
- **Web Audio API & AudioWorklet**: Sample-accurate audio processing in a separate thread.
- **WebSocket**: Full-duplex communication for chunks and metadata.
- **Framer Motion**: Smooth UI transitions and animations.

### Backend
- **Node.js & Express**: Scalable backend architecture.
- **WebSocket (ws)**: Persistent connections for low-latency streaming.
- **Sarvam AI APIs**:
  - **Streaming Saaras v3**: Real-time ASR with translation.
  - **Bulbul v1**: High-quality Indian language Text-to-Speech.
- **Structured Logging**: Performance and error tracking.

---

## Installation & Setup

### Prerequisites
- Node.js (v18+)
- Sarvam AI API Key (Get it from [sarvam.ai](https://www.sarvam.ai/))

### 1. Clone & Configure
```bash
# Clone the repository
git clone <repo-url>
cd SonicBridge

# Backend Setup
cd server
npm install
cp .env.example .env # Add your SARVAM_API_KEY
npm run dev

# Frontend Setup
cd ../client
npm install
npm run dev
```

### 2. Environment Variables
Create a `.env` file in the `server` directory:
```env
SARVAM_API_KEY=your_key_here
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
