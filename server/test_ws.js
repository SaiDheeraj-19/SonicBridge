import WebSocket from 'ws';

const ws = new WebSocket('wss://sonicbridge-backend.onrender.com/');

ws.on('open', () => {
    console.log('Connected to Render WS');
    ws.send(JSON.stringify({ type: 'createRoom' }));
});

ws.on('message', (msg) => {
    console.log('Received:', msg.toString());
    ws.close();
});

ws.on('error', (e) => console.error('WS Error:', e.message));
