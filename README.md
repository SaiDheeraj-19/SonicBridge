<div align="center">
  <img src="./client/public/favicon.png" alt="SonicBridge Logo" width="350"/>
  <br/>
  <h1>SonicBridge 🎙️⚡🌐</h1>
  <p><strong>Bridging voices through real-time AI translation.</strong></p>
</div>

---

**SonicBridge** is a highly polished, production-ready, real-time speech-to-speech translation platform. It captures live audio from a Host, processes and translates it near-instantly using Sarvam AI's localized LLMs, and broadcasts the translated speech directly into the ears of all connected Listeners with ultra-low latency.

## ✨ Key Features

- **Real-Time AI Sync & Streaming**: End-to-end latency optimized to < 1.2s using WebSockets and buffered REST endpoints.
- **Premium User Interface**: Sleek, immersive dark mode design featuring interactive micro-animations, glassmorphism, and dynamic visualizations.
- **Native Browser Audio Hardware**: Utilizes the modern `AudioWorklet` and native Web Audio API for hardware-accelerated playback and microphone isolation.
- **Multi-Lingual Broadcasts**: A single Host can speak in English while Listeners individually hear translations in Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, or Bengali simultaneously.
- **AI Hallucination Filtering**: Intelligently detects and strips out common silence-induced AI STT hallucinations (e.g., "*Yeah*", "*Okay*") before they ever reach the translation pipeline.
- **One-Click Session Sharing**: Instantly generate and copy secure room keys and URLs to invite listeners straight from the dashboard.

## 🏗️ Architecture & Tech Stack

<div align="center">
  <table>
    <tr>
      <td align="center"><strong>Frontend Interface</strong><br/><code>React + Vite</code></td>
      <td align="center"><strong>Coordination Server</strong><br/><code>Node.js + ws WebSockets</code></td>
      <td align="center"><strong>AI Processing</strong><br/><code>SpeechBrain + PyTorch</code></td>
      <td align="center"><strong>AI Pipeline</strong><br/><code>Sarvam AI APIs</code></td>
    </tr>
  </table>
</div>

### 🛠️ Advanced Technical Deep-Dive

#### 1. The Frontend (High-Performance Audio)
- **React 19 & Vite**: Ultra-fast HMR and lean production builds.
- **Web Audio API & AudioWorklets**: Heavy audio processing (32-bit float to 16kHz 16-bit PCM conversion) is shifted to a background thread (`audio-processor.js`) to keep the UI at a buttery-smooth 60fps even during heavy streaming.
- **Tailwind CSS + Framer Motion**: A custom design system utilizing glassmorphism and hardware-accelerated micro-animations for a premium feel.

#### 2. The Coordination Layer (Node.js)
- **Node.js & WebSocket (ws)**: Handles real-time binary audio streams. It acts as an "audio switchboard," injecting RIFF headers to compile raw PCM into valid WAV chunks in-memory.
- **Buffer Management**: Instead of maintaining unreliable external upstream WebSockets, the server uses a custom buffering technique—trading minimal latency for a 100% stable connection profile against REST endpoints.

#### 3. AI & Vocal Intelligence (SpeechBrain Service)
- **SpeechBrain & PyTorch**: A dedicated Python/FastAPI service for **Layer 4 Voice Locking**. It generates unique biometric voice embeddings to ensure the session only translates the Host, ignoring background noise.
- **RNNoise & VAD**: Neural network-based noise suppression and Voice Activity Detection filter out silence/static before it hits the cloud APIs, saving quota and improving accuracy.
- **Sarvam AI APIs**: The primary engine for multilingual STT, translation, and high-fidelity TTS across 7+ Indian languages.

#### 4. Infrastructure & DevOps
- **Docker & Compose**: Containerization of the client, backend, and the specialized AI microservice for consistent environment parity.
- **Redis**: Low-latency session state and data synchronization.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Sarvam AI API Key (Get it from [sarvam.ai](https://www.sarvam.ai/))

### Environment Setup

Create a `.env` file in the `server` directory and add your key:
```env
SARVAM_API_KEY=your_sarvam_api_key_here
PORT=5000
```

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/SaiDheeraj-19/SonicBridge.git
cd SonicBridge
```

**2. Start the Backend Server**
```bash
cd server
npm install
npm run dev
```

**3. Start the Frontend Application**
```bash
cd ../client
npm install
npm run dev
```

Visit `http://localhost:5173` to launch your first session.

## 🎧 How It Works

1. **Host Instantiation**: The host creates a unique 8-character cryptographic room code (`ROOM ID`).
2. **Audio Intake**: The browser captures the Host's microphone via `getUserMedia`, isolates the vocal track via WebRTC constraints, and converts the 32-bit float array into a raw 16kHz PCM data stream via a custom `audio-processor.js` Web Worker.
3. **Pipeline**: The Node.js server buffers ~1.2 second chunks of the stream, injecting RIFF headers to immediately compile them into valid `WAV` blobs in-memory for Sarvam AI.
4. **Broadcast**: The translated text strings and returning AI-generated Base64 voice audio bytes are injected backward through the WebSocket and blasted out to every authenticated participant tuned into that `ROOM ID`.

## 🛡️ License & Legal

*Your privacy is prioritized.*
Audio data is processed in real-time and is NOT stored on our servers after the session expires. Speech models are transient and bound strictly to the active room session lifecycle.

<br/>

<div align="center">
  <p className="text-[10px] opacity-20 tracking-widest uppercase">© 2026 SonicBridge Systems. v2.1.0</p>
</div>
