import WebSocket from 'ws';
import fs from 'fs';

const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";
const ws = new WebSocket('wss://api.sarvam.ai/speech-to-text-translate/ws?language_code=en-IN&model=saaras:v2.5', {
    headers: { 'api-subscription-key': apiKey }
});

ws.on('open', () => {
    console.log('Connected to Sarvam STT');

    // Simulate streaming raw audio
    // We send some non-zero data to trick the VAD on their end
    const rawPcm = Buffer.alloc(16000 * 2 * 2); // 2 seconds
    for (let i = 0; i < rawPcm.length; i++) {
        rawPcm[i] = Math.floor(Math.random() * 255); // loud noise
    }

    // We will send 4 chunks of 0.5s each
    for (let i = 0; i < 4; i++) {
        setTimeout(() => {
            const chunk = rawPcm.subarray(i * 16000, (i + 1) * 16000);

            // Build WAV header for chunk
            const dataLength = chunk.length;
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

            const wavBuffer = Buffer.concat([buffer, chunk]);

            ws.send(JSON.stringify({
                audio: {
                    data: wavBuffer.toString('base64'),
                    encoding: "audio/wav",
                    sample_rate: 16000
                }
            }));
            console.log(`Sent chunk ${i + 1}`);

            // Send EOF on last chunk
            if (i === 3) {
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        end_of_stream: true
                    }));
                    console.log('Sent EOF');
                }, 500);
            }
        }, i * 500);
    }
});

ws.on('message', (msg) => {
    console.log('STT Response:', msg.toString());
});

ws.on('error', (e) => console.error('STT Error:', e.message));
ws.on('close', () => { console.log('STT Closed'); process.exit(0); });
