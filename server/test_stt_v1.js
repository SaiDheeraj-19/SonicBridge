import WebSocket from 'ws';
const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";
const ws = new WebSocket('wss://api.sarvam.ai/v1/speech-to-text-stream?language_code=en-IN&model=saaras_v3', { headers: { 'api-subscription-key': apiKey } });
ws.on('open', () => { console.log('OPEN v1'); ws.close(); });
ws.on('error', (e) => console.log('ERR', e));
ws.on('unexpected-response', (req, res) => console.log('UNEXP', res.statusCode, res.headers));
