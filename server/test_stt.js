import WebSocket from 'ws';
const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";
const ws = new WebSocket('wss://api.sarvam.ai/speech-to-text-translate/ws', { headers: { 'api-subscription-key': apiKey } });
ws.on('open', () => { console.log('OPEN'); ws.close(); });
ws.on('error', (e) => console.log('ERR', e));
ws.on('unexpected-response', (req, res) => console.log('UNEXP', res.statusCode, res.headers));
