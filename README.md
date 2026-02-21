<div align="center">
  <img src="./client/public/favicon.png" alt="SonicBridge Logo" width="350"/>
  <br/>
  <h1>SonicBridge 🎙️⚡🌐</h1>
  <p><strong>Real-time AI speech translation for classrooms, meetings, and live events.</strong></p>
  <br/>

  [![Live Demo](https://img.shields.io/badge/🔴_LIVE_DEMO-sonic--bridge--cyan.vercel.app-00C853?style=for-the-badge)](https://sonic-bridge-cyan.vercel.app)
  [![GitHub](https://img.shields.io/badge/GitHub-SonicBridge-181717?style=for-the-badge&logo=github)](https://github.com/SaiDheeraj-19/SonicBridge)

</div>

---

**SonicBridge** is a production-ready, real-time speech-to-speech translation platform built for **classrooms, meetings, and conferences**. A speaker talks naturally in their language — listeners hear the translated speech in their chosen language, live. Built with Sarvam AI's Indic language models for unmatched accuracy across 10+ Indian languages.

## 🎯 Use Cases

| Scenario | How SonicBridge Helps |
|----------|----------------------|
| 🏫 **Classrooms** | Professor lectures in English → Students hear in Telugu, Hindi, Tamil, etc. with scrollable transcript |
| 🏢 **Corporate Meetings** | Multi-lingual teams collaborate without language barriers |
| 🎤 **Conferences & Events** | Speaker broadcasts to hundreds of participants in their preferred language |
| 🏥 **Healthcare** | Doctors communicate with patients across language barriers |

## ✨ Key Features

### Core Platform
- **Real-Time Speech Translation** — Speak in one language, listeners hear in another within ~4-6 seconds
- **10+ Indian Languages** — Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Odia, Punjabi
- **Text + Voice Output** — Participants see translated text AND hear TTS audio simultaneously
- **Room-Based Sessions** — Secure 8-character room codes, shareable via one-click copy

### Classroom-Grade Intelligence
- **Sentence Accumulation** — Waits for complete sentences (`.` `?` `!`) before translating, producing coherent output instead of fragments
- **Smart Silence Detection** — Tracks consecutive voiced/silent chunks. Teacher pausing to write on the board generates zero hallucinations
- **Anti-Hallucination System** — 3-layer filter: exact match (40+ words), short fragment detection, repetitive text detection
- **Scrolling Transcript** — Students see a scrollable list of individually translated sentences with timestamps for reference

### Audio Engineering
- **Bulletproof Audio Queue** — Safety timeouts, double-advance guards, and a 3-second watchdog prevent audio from ever getting stuck
- **Browser Autoplay Unlock** — Tap-to-enable overlay satisfies browser policies, then auto-plays all queued audio
- **2x Gain Boost** — TTS output amplified through Web Audio GainNode for clear classroom playback
- **AudioWorklet Processing** — 128ms buffer (2048 samples @ 16kHz) for low-latency capture without blocking the UI thread

### Voice Isolation Pipeline
- **Layer 1**: Browser-level noise suppression, echo cancellation, auto-gain (WebRTC constraints)
- **Layer 2**: RNNoise neural suppression (production-ready, disabled in dev)
- **Layer 3**: Energy-based VAD with zero-crossing rate analysis (threshold: 200 + ZCR filter)
- **Layer 4**: SpeechBrain speaker verification via cosine similarity (auto-detected microservice)

## 🏗️ Architecture

```
┌─────────────────────┐     WebSocket (Binary PCM)     ┌──────────────────────┐
│   HOST (Browser)    │ ──────────────────────────────▶ │   Node.js Server     │
│                     │                                 │                      │
│ • getUserMedia      │                                 │ • VAD + Silence Track│
│ • AudioWorklet      │                                 │ • WAV Header Inject  │
│ • PCM 16kHz 16-bit  │                                 │ • Buffer → Sarvam STT│
└─────────────────────┘                                 │ • Translate → TTS    │
                                                        │ • Sentence Accumulate│
┌─────────────────────┐     WebSocket (JSON + WAV)      │                      │
│ PARTICIPANT (Browser)│ ◀──────────────────────────────│ • Broadcast per-lang │
│                     │                                 └──────────────────────┘
│ • Translated Text   │                                          │
│ • TTS Audio Playback│                                          ▼
│ • Scrolling List    │                                 ┌──────────────────────┐
│ • GainNode 2x Boost │                                 │   Sarvam AI APIs     │
└─────────────────────┘                                 │ • STT (saaras:v2.5)  │
                                                        │ • Translation        │
                                                        │ • TTS (streaming)    │
                                                        └──────────────────────┘
```

### Tech Stack

<div align="center">
  <table>
    <tr>
      <td align="center"><strong>Frontend</strong><br/><code>React 19 + Vite</code><br/><code>Tailwind CSS</code><br/><code>Web Audio API</code></td>
      <td align="center"><strong>Backend</strong><br/><code>Node.js + Express</code><br/><code>ws WebSockets</code><br/><code>Binary Audio Streams</code></td>
      <td align="center"><strong>AI Pipeline</strong><br/><code>Sarvam AI STT</code><br/><code>Sarvam Translation</code><br/><code>Sarvam TTS</code></td>
      <td align="center"><strong>Infrastructure</strong><br/><code>Vercel (Frontend)</code><br/><code>Render (Backend)</code><br/><code>Docker (Optional)</code></td>
    </tr>
  </table>
</div>

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Sarvam AI API Key → [sarvam.ai](https://www.sarvam.ai/)

### Environment Setup

Create `.env` in the `server/` directory:
```env
SARVAM_API_KEY=your_sarvam_api_key_here
PORT=5000
```

Create `.env` in the `client/` directory:
```env
VITE_WS_URL=ws://localhost:5000
```

### Installation

```bash
# 1. Clone
git clone https://github.com/SaiDheeraj-19/SonicBridge.git
cd SonicBridge

# 2. Start Backend
cd server
npm install
npm run dev

# 3. Start Frontend (new terminal)
cd ../client
npm install
npm run dev
```

Visit `http://localhost:5173` to launch your first session.

### Docker (Optional)

```bash
docker-compose up --build
```

## 🎧 How It Works

### For the Host (Speaker)
1. **Create Room** — Click "Create Room" to generate a unique 8-character code
2. **Share Code** — Copy the room code or share the URL with participants
3. **Start Speaking** — Click the mic button and speak naturally
4. **Live Transcript** — See your speech transcribed in real-time on screen

### For Participants (Listeners)
1. **Join Room** — Enter the room code and select your target language
2. **Tap to Enable Audio** — One tap unlocks browser audio playback
3. **Listen & Read** — Hear translated speech audio + see scrolling text transcript
4. **Scroll Back** — Review previous sentences anytime during the session

## ⚡ Latency Breakdown

| Pipeline Stage | Latency |
|----------------|---------|
| Audio capture (AudioWorklet) | ~128ms |
| WebSocket transport | ~10ms (local) / ~300ms (deployed) |
| VAD + silence detection | <1ms |
| STT buffer accumulation | ~2000ms |
| Sarvam STT API | ~500-1500ms |
| Sarvam Translation API | ~300-600ms |
| Sarvam TTS API | ~1000-2000ms |
| Audio decode + playback | ~50ms |
| **Total end-to-end** | **~4-6 seconds** |

## 📁 Project Structure

```
SonicBridge/
├── client/                      # React Frontend
│   ├── public/
│   │   └── audio-processor.js   # AudioWorklet (PCM capture)
│   ├── src/
│   │   ├── App.jsx              # Main app (Host + Participant views)
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.js  # Mic capture hook
│   │   │   └── useWebSocket.js      # WS connection hook
│   │   └── index.css            # Design system
│   └── vite.config.js
│
├── server/                      # Node.js Backend
│   ├── server.js                # WebSocket server + room management
│   ├── services/
│   │   ├── sarvamService.js     # Sarvam AI API integration
│   │   └── voiceIsolationService.js  # VAD + voice isolation
│   └── speechbrain_service/     # Optional Python microservice
│       ├── Dockerfile
│       └── README.md
│
├── docker-compose.yml
└── README.md
```

## 🛡️ Privacy & Security

- **No Audio Storage** — Audio data is processed in real-time and discarded after the session
- **Room Isolation** — Each session operates in an isolated room with a unique cryptographic code
- **Host-Only Audio** — Only the host can broadcast; participants are listen-only
- **Transient Sessions** — All data (transcripts, audio, state) is destroyed when the room closes

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

<br/>

<div align="center">
  <p>© 2026 SonicBridge · Built with ❤️ for breaking language barriers</p>
  <p><sub>v3.0.0 · Classroom-Ready Edition</sub></p>
</div>
