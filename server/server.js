import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import sarvamService from './services/sarvamService.js';
import voiceIsolationService from './services/voiceIsolationService.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.status(200).send('SonicBridge Backend is Running. Use this URL in your Vercel VITE_WS_URL as wss://...');
});

// Health check for deployment monitoring
app.get('/health', (req, res) => {
    res.status(200).send('SonicBridge Backend Active');
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Room logic
class Room {
    constructor(roomId, hostWs) {
        this.roomId = roomId;
        this.hostWs = hostWs;
        this.users = []; // Array of { ws, language }
        this.sarvamWs = null;
        this.hostEmbedding = null; // Stored SpeechBrain embedding for Layer 4 Voice Locking
        this.enrollmentBuffer = [];
        this.enrollmentLength = 0;
        this.isEnrolling = false;
    }
}

const rooms = new Map();

wss.on('connection', (ws) => {
    console.log('Client connected to SonicBridge WebSocket');

    let currentRoomId = null;
    let isHost = false;

    ws.on('message', async (message, isBinary) => {
        if (!isBinary) {
            try {
                const data = JSON.parse(message.toString());

                if (data.type === 'createRoom') {
                    // Start of new host session
                    if (isHost && currentRoomId && rooms.has(currentRoomId)) {
                        const oldRoom = rooms.get(currentRoomId);
                        if (oldRoom.sarvamWs) oldRoom.sarvamWs.close();
                        rooms.delete(currentRoomId);
                    }

                    const roomId = crypto.randomUUID().slice(0, 8).toUpperCase();
                    rooms.set(roomId, new Room(roomId, ws));

                    currentRoomId = roomId;
                    isHost = true;
                    console.log(`Room created: ${roomId}`);
                    ws.send(JSON.stringify({ type: 'roomCreated', roomId }));
                }
                else if (data.type === 'joinRoom') {
                    const roomId = data.roomId;
                    if (rooms.has(roomId)) {
                        const room = rooms.get(roomId);
                        const userLang = data.language || data.targetLang || 'hi-IN';
                        room.users.push({ ws, language: userLang });
                        currentRoomId = roomId;
                        isHost = false;
                        console.log(`User joined room ${roomId} with language ${userLang}`);
                        ws.send(JSON.stringify({ type: 'joined', roomId }));

                        // Notify host of new join
                        if (room.hostWs && room.hostWs.readyState === 1) {
                            room.hostWs.send(JSON.stringify({ type: 'userJoined', activeUsers: room.users.length }));
                        }
                    } else {
                        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                    }
                }
                else if (data.type === 'updateLanguage') {
                    if (currentRoomId && rooms.has(currentRoomId) && !isHost) {
                        const room = rooms.get(currentRoomId);
                        const user = room.users.find(u => u.ws === ws);
                        if (user) {
                            const newLang = data.language || data.targetLang;
                            if (newLang) {
                                user.language = newLang;
                                console.log(`User updated language to ${newLang} in room ${currentRoomId}`);
                            }
                        }
                    }
                }
                else if (data.type === 'start') {
                    if (!isHost || !currentRoomId || !rooms.has(currentRoomId)) return;

                    const room = rooms.get(currentRoomId);
                    console.log(`Host starting stream in room: ${currentRoomId} from ${data.sourceLang}`);

                    room.sarvamWs = await sarvamService.createSttStream(
                        {
                            language_code: data.sourceLang,
                            model: 'saaras:v2.5'
                        },
                        async (result) => {
                            // Extract native transcript and English translation base
                            let nativeText = result.transcript || '';
                            let englishBase = result.translate || nativeText;

                            let textToShowHost = nativeText || englishBase;

                            if (!textToShowHost) return;

                            // === COMPREHENSIVE ANTI-HALLUCINATION SYSTEM ===
                            const trimmed = textToShowHost.trim();
                            const lowerText = trimmed.toLowerCase().replace(/[^a-z\s]/g, '').trim();

                            // 1. Exact match hallucinations (common STT silence artifacts)
                            const hallucinations = [
                                'yes', 'yeah', 'yep', 'yea',
                                'okay', 'ok', 'okey',
                                'no', 'nah', 'nope',
                                'mhm', 'hmm', 'hm', 'uh', 'um', 'uh huh',
                                'ah', 'oh', 'ooh', 'aah',
                                'bye', 'bye bye', 'goodbye',
                                'thank you', 'thanks',
                                'hello', 'hi', 'hey',
                                'right', 'sure', 'fine',
                                'so', 'well', 'now',
                                'sir', 'madam', 'maam',
                                'please', 'sorry',
                                'you', 'i', 'we', 'it',
                                'the', 'a', 'an', 'is', 'are', 'was',
                                'do this', 'do that',
                                'i see', 'i know',
                            ];

                            if (hallucinations.includes(lowerText)) {
                                console.log(`[STT Anti-Hallucination] Dropped: "${trimmed}"`);
                                return;
                            }

                            // 2. Too short (less than 3 actual words) — usually noise
                            const wordCount = lowerText.split(/\s+/).filter(w => w.length > 0).length;
                            if (wordCount < 2 && trimmed.length < 15) {
                                console.log(`[STT Anti-Hallucination] Dropped short fragment: "${trimmed}" (${wordCount} words)`);
                                return;
                            }

                            // 3. Repetitive text detection (e.g., "yes yes yes" or "okay okay")
                            const words = lowerText.split(/\s+/);
                            if (words.length >= 2) {
                                const uniqueWords = new Set(words);
                                if (uniqueWords.size === 1) {
                                    console.log(`[STT Anti-Hallucination] Dropped repetitive: "${trimmed}"`);
                                    return;
                                }
                            }
                            // === END ANTI-HALLUCINATION ===

                            // Send host the raw transcription text
                            if (room.hostWs && room.hostWs.readyState === 1) {
                                room.hostWs.send(JSON.stringify({ type: 'transcript', text: textToShowHost }));
                            }

                            // NOTE: Don't send raw transcript to participants!
                            // They should only see translated text in their target language.
                            // Sending English preview was causing participants to see English even with Telugu selected.

                            // Process translation/TTS for final phrases (minimum 2 words)
                            const finalWordCount = textToShowHost.trim().split(/\s+/).length;
                            if (result.is_final && textToShowHost.trim().length > 0 && finalWordCount >= 2) {
                                // Find unique languages requested in the room
                                const uniqueLanguages = [...new Set(room.users.map(u => u.language))];

                                // Optimization: Process each language parallelly
                                await Promise.all(uniqueLanguages.map(async (targetLanguage) => {
                                    if (!targetLanguage || typeof targetLanguage !== 'string') {
                                        console.warn(`[Pipeline] Skipping invalid target language: ${targetLanguage}`);
                                        return;
                                    }
                                    try {
                                        // Determine source language for translation
                                        // If Sarvam gave us a 'translate' field, it's English. Otherwise it's native.
                                        const sourceText = result.translate || nativeText;
                                        const sourceLang = result.translate ? "en-IN" : data.sourceLang;

                                        console.log(`[Pipeline] Room: ${currentRoomId} | Target: ${targetLanguage} | Lang Users: ${room.users.filter(u => u.language === targetLanguage).length}`);
                                        console.log(`[Pipeline] Source (${sourceLang}): "${sourceText.substring(0, 30)}..."`);

                                        // 1. Translate
                                        const translatedText = await sarvamService.translateText(sourceText, targetLanguage, sourceLang);
                                        console.log(`[Pipeline] Success: ${targetLanguage} -> "${translatedText.substring(0, 30)}..."`);

                                        // 2. TTS
                                        console.log(`[Pipeline] TTS for ${targetLanguage}...`);
                                        const audioBuffer = await sarvamService.textToSpeech(translatedText, targetLanguage);

                                        // 3. Broadcast
                                        let sentCount = 0;
                                        room.users.forEach(user => {
                                            if (user.language === targetLanguage && user.ws.readyState === 1) {
                                                user.ws.send(JSON.stringify({ type: 'translation', text: translatedText }));
                                                user.ws.send(audioBuffer);
                                                sentCount++;
                                            }
                                        });
                                        console.log(`[Pipeline] Broadcasted ${targetLanguage} to ${sentCount} users.`);
                                    } catch (err) {
                                        console.error(`[Pipeline] Error for ${targetLanguage}:`, err.message);

                                        // Fallback TTS: Try to at least speak the original native text if translation failed
                                        try {
                                            console.log(`[Pipeline] Attempting fallback TTS for ${targetLanguage}...`);
                                            const fallbackAudio = await sarvamService.textToSpeech(textToShowHost, targetLanguage);
                                            room.users.forEach(user => {
                                                if (user.language === targetLanguage && user.ws.readyState === 1) {
                                                    user.ws.send(JSON.stringify({ type: 'translation', text: textToShowHost }));
                                                    user.ws.send(fallbackAudio);
                                                }
                                            });
                                            console.log(`[Pipeline] Fallback native TTS delivered for ${targetLanguage}`);
                                        } catch (fallbackErr) {
                                            console.error("[Pipeline] Fallback TTS failed too:", fallbackErr.message);
                                        }
                                    }
                                }));
                            }
                        },
                        (error) => {
                            room.hostWs.send(JSON.stringify({ type: 'error', message: 'STT failed' }));
                        }
                    );
                }
                else if (data.type === 'stop') {
                    if (isHost && currentRoomId && rooms.has(currentRoomId)) {
                        const room = rooms.get(currentRoomId);
                        if (room.sarvamWs) {
                            room.sarvamWs.close();
                            room.sarvamWs = null;
                        }
                    }
                }
                else if (data.type === 'closeRoom') {
                    if (isHost && currentRoomId && rooms.has(currentRoomId)) {
                        const room = rooms.get(currentRoomId);
                        room.users.forEach(u => {
                            if (u.ws.readyState === 1) {
                                u.ws.send(JSON.stringify({ type: 'hostLeft' }));
                            }
                        });

                        if (room.sarvamWs) room.sarvamWs.close();
                        rooms.delete(currentRoomId);
                        currentRoomId = null;
                        isHost = false;
                        console.log('Room closed explicitly by host.');
                    }
                }
                else if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
                }
            } catch (e) {
                console.error("Error processing control message:", e);
            }
            return;
        }

        // Handle binary audio data — HOT PATH: must be as fast as possible
        if (isBinary) {
            if (!isHost || !currentRoomId || !rooms.has(currentRoomId)) return;

            const room = rooms.get(currentRoomId);

            // LAYER 3: Voice Activity Detection (Ignore silence to save API quota)
            if (!voiceIsolationService.checkVoiceActivity(message)) return;

            if (room.sarvamWs && room.sarvamWs.readyState === 1) {
                // LAYER 2: RNNoise (pass-through when disabled)
                const cleanBuffer = voiceIsolationService.rnnoiseEnabled
                    ? await voiceIsolationService.applyRNNoise(message)
                    : message;

                // LAYER 4: SpeechBrain verification (skip entirely when disabled)
                if (voiceIsolationService.embeddingVerificationEnabled) {
                    if (!room.hostEmbedding) {
                        room.enrollmentBuffer.push(cleanBuffer);
                        room.enrollmentLength += cleanBuffer.length;
                        if (room.enrollmentLength >= 160000 && !room.isEnrolling) {
                            room.isEnrolling = true;
                            const fullBuf = Buffer.concat(room.enrollmentBuffer);
                            voiceIsolationService.enrollHostVoice(fullBuf).then(emb => {
                                if (emb) room.hostEmbedding = emb;
                            });
                        }
                    } else {
                        const match = await voiceIsolationService.verifySpeaker(cleanBuffer, room.hostEmbedding);
                        if (!match) return;
                    }
                }

                // Fast WAV header construction + forward to STT
                const len = cleanBuffer.length;
                const hdr = Buffer.alloc(44);
                hdr.write('RIFF', 0);
                hdr.writeUInt32LE(len + 36, 4);
                hdr.write('WAVEfmt ', 8);
                hdr.writeUInt32LE(16, 16);
                hdr.writeUInt16LE(1, 20);   // PCM
                hdr.writeUInt16LE(1, 22);   // mono
                hdr.writeUInt32LE(16000, 24); // sample rate
                hdr.writeUInt32LE(32000, 28); // byte rate
                hdr.writeUInt16LE(2, 32);   // block align
                hdr.writeUInt16LE(16, 34);  // bits per sample
                hdr.write('data', 36);
                hdr.writeUInt32LE(len, 40);

                room.sarvamWs.send(JSON.stringify({
                    audio: { data: Buffer.concat([hdr, cleanBuffer]).toString('base64'), encoding: "audio/wav", sample_rate: 16000 }
                }));
            }
        }
    });

    ws.on('close', () => {
        if (currentRoomId && rooms.has(currentRoomId)) {
            const room = rooms.get(currentRoomId);
            if (isHost && room.hostWs === ws) {
                // Host left, clean up
                room.users.forEach(u => {
                    if (u.ws.readyState === 1) {
                        u.ws.send(JSON.stringify({ type: 'hostLeft' }));
                    }
                });

                if (room.sarvamWs) room.sarvamWs.close();
                rooms.delete(currentRoomId);
                console.log(`Room ${currentRoomId} deleted as host left.`);
            } else {
                // User left
                room.users = room.users.filter(u => u.ws !== ws);
                console.log(`User left room ${currentRoomId}. ${room.users.length} remaining.`);

                // Notify host user left
                if (room.hostWs && room.hostWs.readyState === 1) {
                    room.hostWs.send(JSON.stringify({ type: 'userLeft', activeUsers: room.users.length }));
                }
            }
        }
        console.log('Client disconnected');
    });
});

server.listen(port, () => {
    console.log(`SonicBridge Server running on port ${port}`);
});
