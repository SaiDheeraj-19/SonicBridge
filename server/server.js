import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import sarvamService from './services/sarvamService.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    console.log('Client connected to SonicBridge WebSocket');

    let sarvamWs = null;
    let currentTargetLang = 'en-IN';

    ws.on('message', async (message, isBinary) => {
        // Handle JSON messages (configuration)
        if (!isBinary) {
            try {
                const data = JSON.parse(message.toString());

                if (data.type === 'start') {
                    currentTargetLang = data.targetLang || 'en-IN';
                    console.log(`Starting session: ${data.sourceLang} -> ${currentTargetLang}`);

                    sarvamWs = await sarvamService.createSttStream(
                        {
                            language_code: data.sourceLang,
                            mode: 'translate' // Translate to target immediately if possible
                        },
                        async (result) => {
                            // Handle Sarvam STT Response
                            // Result format: { transcript: "...", translate: "...", is_final: true/false }
                            if (result.transcript) {
                                ws.send(JSON.stringify({ type: 'transcript', text: result.transcript }));
                            }

                            if (result.translate) {
                                ws.send(JSON.stringify({ type: 'translation', text: result.translate }));

                                // If we have a meaningful translated chunk and it's final (or a complete sentence)
                                if (result.is_final && result.translate.trim().length > 0) {
                                    try {
                                        const audioBuffer = await sarvamService.textToSpeech(result.translate, currentTargetLang);
                                        ws.send(audioBuffer);
                                    } catch (ttsErr) {
                                        console.error('TTS execution failed:', ttsErr.message);
                                    }
                                }
                            }
                        },
                        (error) => {
                            ws.send(JSON.stringify({ type: 'error', message: 'Sarvam STT failed' }));
                        }
                    );
                } else if (data.type === 'stop') {
                    if (sarvamWs) {
                        sarvamWs.close();
                        sarvamWs = null;
                    }
                }
            } catch (e) {
                console.error("Error processing control message:", e);
            }
            return;
        }

        // Handle binary audio data
        if (isBinary && sarvamWs && sarvamWs.readyState === 1) {
            // Add a proper WAV header to the raw PCM chunk
            const dataLength = message.length;
            const buffer = Buffer.alloc(44);
            buffer.write('RIFF', 0);
            buffer.writeUInt32LE(dataLength + 36, 4);
            buffer.write('WAVE', 8);
            buffer.write('fmt ', 12);
            buffer.writeUInt32LE(16, 16); // Subchunk1Size
            buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
            buffer.writeUInt16LE(1, 22); // NumChannels
            buffer.writeUInt32LE(16000, 24); // SampleRate
            buffer.writeUInt32LE(16000 * 1 * 16 / 8, 28); // ByteRate
            buffer.writeUInt16LE(1 * 16 / 8, 32); // BlockAlign
            buffer.writeUInt16LE(16, 34); // BitsPerSample
            buffer.write('data', 36);
            buffer.writeUInt32LE(dataLength, 40);

            const wavBuffer = Buffer.concat([buffer, message]);

            sarvamWs.send(JSON.stringify({
                audio: {
                    data: wavBuffer.toString('base64'),
                    encoding: "audio/wav",
                    sample_rate: 16000
                }
            }));
        }
    });

    ws.on('close', () => {
        if (sarvamWs) sarvamWs.close();
        console.log('Client disconnected');
    });
});

server.listen(port, () => {
    console.log(`SonicBridge Server running on port ${port}`);
});
