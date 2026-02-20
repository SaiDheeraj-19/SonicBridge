import WebSocket from 'ws';
const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";
const ws = new WebSocket('wss://api.sarvam.ai/speech-to-text-translate/ws', { headers: { 'api-subscription-key': apiKey } });

ws.on('open', () => {
    console.log('OPEN');
    const buf = Buffer.alloc(16000 * 2);
    const b64 = buf.toString('base64');

    // Test payload shape
    ws.send(JSON.stringify({
        audio: {
            data: b64,
            sample_rate: 16000,
            encoding: "pcm_s16le"
        }
    }));
});

ws.on('message', (msg) => {
    console.log('MSG:', msg.toString());
});

ws.on('error', (e) => console.log('ERR', e));
