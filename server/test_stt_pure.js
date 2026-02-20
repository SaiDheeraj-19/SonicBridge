import WebSocket from 'ws';
const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";
const ws = new WebSocket('wss://api.sarvam.ai/speech-to-text/ws?language_code=hi-IN&model=saaras:v2.5', { headers: { 'api-subscription-key': apiKey } });

ws.on('open', () => {
    console.log('OPEN STT');
    const buf = Buffer.alloc(16000 * 2);
    const b64 = buf.toString('base64');

    // Add a proper WAV header to the raw PCM chunk
    const dataLength = buf.length;
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

    const wavBuffer = Buffer.concat([buffer, buf]);

    ws.send(JSON.stringify({
        audio: {
            data: wavBuffer.toString('base64'),
            encoding: "audio/wav",
            sample_rate: 16000
        }
    }));
});

ws.on('message', (msg) => {
    console.log('MSG:', msg.toString());
});

ws.on('error', (e) => console.log('ERR', e));
ws.on('unexpected-response', (req, res) => console.log('UNEXP', res.statusCode, res.headers));
