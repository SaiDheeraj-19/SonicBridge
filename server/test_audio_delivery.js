import { WebSocketServer } from 'ws';
import sarvamService from './services/sarvamService.js';

// This test simulates exactly what the server pipeline does:
// 1. Generate TTS audio
// 2. Send it as binary over WebSocket to a client
// Open http://localhost:9999 to test

import { createServer } from 'http';

const html = `<!DOCTYPE html>
<html>
<head><title>Audio Delivery Test</title></head>
<body>
<h1>Audio Delivery Test</h1>
<button id="btn" onclick="testAudio()">Click to Test Audio Delivery</button>
<pre id="log"></pre>
<script>
function log(msg) {
  document.getElementById('log').textContent += msg + '\\n';
  console.log(msg);
}

function testAudio() {
  const ctx = new AudioContext();
  log('AudioContext state: ' + ctx.state);
  if (ctx.state === 'suspended') ctx.resume();

  const ws = new WebSocket('ws://localhost:9999');
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    log('WebSocket connected, requesting audio...');
    ws.send('send_audio');
  };

  ws.onmessage = async (event) => {
    if (typeof event.data === 'string') {
      log('Text: ' + event.data);
      return;
    }

    log('Received binary: ' + event.data.byteLength + ' bytes');
    
    // Check WAV header
    const view = new DataView(event.data);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    log('First 4 bytes: ' + magic);
    if (magic === 'RIFF') {
      const sampleRate = view.getUint32(24, true);
      const channels = view.getUint16(22, true);
      const bitsPerSample = view.getUint16(34, true);
      log('WAV: ' + sampleRate + 'Hz, ' + channels + 'ch, ' + bitsPerSample + 'bit');
    }
    
    try {
      const decoded = await ctx.decodeAudioData(event.data.slice(0));
      log('Decoded: ' + decoded.duration.toFixed(2) + 's, ' + decoded.sampleRate + 'Hz');
      
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(ctx.destination);
      source.start(0);
      log('PLAYING AUDIO NOW!');
      source.onended = () => log('Audio finished playing.');
    } catch (err) {
      log('DECODE ERROR: ' + err.message);
    }
  };

  ws.onerror = (e) => log('WS Error: ' + e.message);
}
</script>
</body>
</html>`;

const httpServer = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', async (ws) => {
    console.log('Test client connected');

    ws.on('message', async (msg) => {
        const text = msg.toString();
        if (text === 'send_audio') {
            console.log('Generating TTS audio...');
            ws.send('Generating Hindi TTS audio...');

            try {
                const audioBuffer = await sarvamService.textToSpeech('नमस्ते, यह एक परीक्षण है।', 'hi-IN');
                console.log('Sending audio buffer:', audioBuffer.length, 'bytes');

                // This is exactly what server.js does:
                ws.send(JSON.stringify({ type: 'translation', text: 'नमस्ते, यह एक परीक्षण है।' }));
                ws.send(audioBuffer);

                console.log('Audio sent to client!');
            } catch (err) {
                console.error('TTS Error:', err.message);
                ws.send('Error: ' + err.message);
            }
        }
    });
});

httpServer.listen(9999, () => {
    console.log('Test server: http://localhost:9999');
    console.log('Click the button to test audio delivery');
});
