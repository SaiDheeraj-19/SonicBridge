import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import sarvamService from './services/sarvamService.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Room logic
class Room {
    constructor(roomId, hostWs) {
        this.roomId = roomId;
        this.hostWs = hostWs;
        this.users = []; // Array of { ws, language }
        this.sarvamWs = null;
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
                        room.users.push({ ws, language: data.targetLang });
                        currentRoomId = roomId;
                        isHost = false;
                        console.log(`User joined room ${roomId} with language ${data.targetLang}`);
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
                            user.language = data.targetLang;
                            console.log(`User updated language to ${data.targetLang} in room ${currentRoomId}`);
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
                            // Extract primary translation (which defaults to English output from STT-Translate)
                            const text = result.transcript || result.translate;

                            // Send host the raw transcription text
                            if (text) {
                                room.hostWs.send(JSON.stringify({ type: 'transcript', text: text }));
                            }

                            // Only process translation/TTS for final phrases to save performance
                            if (result.is_final && text && text.trim().length > 0) {
                                // Find unique languages requested in the room
                                const uniqueLanguages = [...new Set(room.users.map(u => u.language))];

                                // Optimization: Process each language ONCE
                                for (const targetLanguage of uniqueLanguages) {
                                    try {
                                        // 1. Translate
                                        const translatedText = await sarvamService.translateText(text, targetLanguage);

                                        // 2. TTS
                                        const audioBuffer = await sarvamService.textToSpeech(translatedText, targetLanguage);

                                        // 3. Broadcast to all users requesting this language
                                        room.users.forEach(user => {
                                            if (user.language === targetLanguage && user.ws.readyState === 1) {
                                                user.ws.send(JSON.stringify({ type: 'translation', text: translatedText }));
                                                user.ws.send(audioBuffer);
                                            }
                                        });
                                    } catch (err) {
                                        console.error(`Pipeline failed for ${targetLanguage}:`, err.message);
                                        // Fallback logic
                                        room.users.forEach(user => {
                                            if (user.language === targetLanguage && user.ws.readyState === 1) {
                                                user.ws.send(JSON.stringify({ type: 'translation', text: text })); // Send original english text
                                            }
                                        });
                                    }
                                }
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

        // Handle binary audio data
        if (isBinary) {
            if (!isHost || !currentRoomId || !rooms.has(currentRoomId)) {
                // Reject unauthorized audio injection from users
                console.warn('Unauthorized audio chunk rejected from non-host client.');
                return;
            }

            const room = rooms.get(currentRoomId);
            if (room.sarvamWs && room.sarvamWs.readyState === 1) {
                const dataLength = message.length;
                const buffer = Buffer.alloc(44);
                buffer.write('RIFF', 0);
                buffer.writeUInt32LE(dataLength + 36, 4);
                buffer.write('WAVE', 8);
                buffer.write('fmt ', 12);
                buffer.writeUInt32LE(16, 16);
                buffer.writeUInt16LE(1, 20);
                buffer.writeUInt16LE(1, 22);
                buffer.writeUInt32LE(16000, 24);
                buffer.writeUInt32LE(16000 * 1 * 16 / 8, 28);
                buffer.writeUInt16LE(1 * 16 / 8, 32);
                buffer.writeUInt16LE(16, 34);
                buffer.write('data', 36);
                buffer.writeUInt32LE(dataLength, 40);

                const wavBuffer = Buffer.concat([buffer, message]);

                room.sarvamWs.send(JSON.stringify({
                    audio: {
                        data: wavBuffer.toString('base64'),
                        encoding: "audio/wav",
                        sample_rate: 16000
                    }
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
