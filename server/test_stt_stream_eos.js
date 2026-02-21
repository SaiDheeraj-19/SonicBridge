import WebSocket from 'ws';
import fs from 'fs';

const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";
const ws = new WebSocket('wss://api.sarvam.ai/speech-to-text-translate/ws?language_code=en-IN&model=saaras:v2.5', {
    headers: { 'api-subscription-key': apiKey }
});

ws.on('open', () => {
    console.log('Connected to Sarvam STT');

    // Simulate streaming raw audio
    const rawPcm = fs.readFileSync('test.wav'); // Valid WAV
    const chunkSize = 16000 * 2; // 0.5s of 16-bit 16kHz

    let i = 0;
    const sendChunk = () => {
        const start = i * chunkSize;
        const end = Math.min((i + 1) * chunkSize, rawPcm.length);
        const chunk = rawPcm.subarray(start, end);

        ws.send(JSON.stringify({
            audio: {
                data: chunk.toString('base64'),
                encoding: "audio/wav",
                sample_rate: 16000
            }
        }));
        console.log(`Sent chunk ${i + 1}`);

        i++;
        if (i * chunkSize < rawPcm.length) {
            setTimeout(sendChunk, 500);
        } else {
            // End of stream
            ws.send(JSON.stringify({
                audio: {
                    data: Buffer.from([]).toString('base64'),
                    encoding: "audio/wav",
                    sample_rate: 16000
                },
                end_of_stream: true
            }));
            console.log('Sent EOF');
        }
    };
    sendChunk();
});

ws.on('message', (msg) => {
    console.log('STT Response:', msg.toString());
});

ws.on('error', (e) => console.error('STT Error:', e.message));
ws.on('close', () => { console.log('STT Closed'); process.exit(0); });
