import WebSocket from 'ws';
import fs from 'fs';

const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";
const ws = new WebSocket('wss://api.sarvam.ai/speech-to-text-translate/ws?language_code=hi-IN&model=saaras:v2.5', {
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

            ws.send(JSON.stringify({
                audio: chunk.toString('base64'),
            }));
            console.log(`Sent chunk ${i + 1}`);

            // Send EOF on last chunk
            if (i === 3) {
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        audio: "" // Sarvam sometimes expects empty string or null for EOF
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
