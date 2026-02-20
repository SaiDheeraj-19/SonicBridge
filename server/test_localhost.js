import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:5001');

ws.on('open', () => {
    console.log('o');
    ws.send(JSON.stringify({ type: 'createRoom', roomId: '1234' }));
});

ws.on('message', (msg) => {
    const data = typeof msg === 'string' ? msg : msg.toString();
    console.log('msg:', data);
    try {
        const j = JSON.parse(data);
        if (j.type === 'roomCreated') {
            ws.send(JSON.stringify({ type: 'start', sourceLang: 'en-IN' }));
            setTimeout(() => {
                ws.send(Buffer.alloc(4096)); // Send binary
            }, 500);
        }
    } catch(e){}
});
