import WebSocket from 'ws';
import fs from 'fs';

const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";
const ws = new WebSocket('wss://api.sarvam.ai/speech-to-text-translate/ws?language_code=en-IN&model=saaras:v2.5', {
    headers: { 'api-subscription-key': apiKey }
});

ws.on('open', () => {
    console.log('Connected to Sarvam STT');

    const wavBuffer = fs.readFileSync('test.wav');
    const chunkSize = 16000 * 2; // 0.5s of 16-bit 16kHz

    let i = 0;
    const sendChunk = () => {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize, wavBuffer.length);
        const chunk = wavBuffer.slice(start, end);

        ws.send(JSON.stringify({
            audio: {
                data: chunk.toString('base64'),
                encoding: "audio/wav",  // It might actually want pcm_s16le, but previous test complained about enum "audio/wav" ? Wait, no, we gave it 'pcm_s16le' and it said "Input should be 'audio/wav'."
                sample_rate: 16000
            }
        }));
        console.log(`Sent chunk ${i + 1}`);

        i++;
        if (i * chunkSize < wavBuffer.length) {
            setTimeout(sendChunk, 500);
        } else {
            console.log('Done sending.');
        }
    };
    sendChunk();
});

ws.on('message', (msg) => {
    console.log('STT Response:', msg.toString());
});

ws.on('error', (e) => console.error('STT Error:', e.message));
ws.on('close', () => { console.log('STT Closed'); process.exit(0); });
