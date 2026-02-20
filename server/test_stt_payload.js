import WebSocket from 'ws';
const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";
const ws = new WebSocket('wss://api.sarvam.ai/speech-to-text-translate/ws', { headers: { 'api-subscription-key': apiKey } });

ws.on('open', () => {
    console.log('OPEN v1');

    // Test raw binary
    const buf = Buffer.alloc(32000);
    ws.send(buf);

    setTimeout(() => {
        ws.send(JSON.stringify({ audio: buf.toString('base64'), sample_rate: 16000, encoding: 'pcm_s16le' }));
    }, 1000);
});

ws.on('message', (msg) => {
    console.log('MSG:', msg.toString());
});

ws.on('error', (e) => console.log('ERR', e));
ws.on('unexpected-response', (req, res) => console.log('UNEXP', res.statusCode, res.headers));
