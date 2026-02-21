import WebSocket from 'ws';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SARVAM_STT_URL = 'wss://api.sarvam.ai/speech-to-text-translate/ws';
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech/stream';

class SarvamService {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Initialize a streaming ASR session
     * @param {Object} options - { language_code, model }
     * @param {Function} onTranscript - Callback for transcript/translation results
     * @param {Function} onError - Callback for errors
     */
    async createSttStream(options, onTranscript, onError) {
        const {
            language_code = 'hi-IN',
            model = 'saaras:v2.5',
        } = options;

        console.log("Initializing Sarvam Buffered REST STT Strategy for:", language_code);

        // Pseudo-WebSocket to mimic the interface for server.js
        const pseudoWs = {
            readyState: 1, // OPEN
            audioBuffer: [],
            interval: null,

            send: (dataStr) => {
                if (pseudoWs.readyState !== 1) return;
                try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.audio && parsed.audio.data) {
                        const chunkBuf = Buffer.from(parsed.audio.data, 'base64');
                        // Strip the 44-byte WAV header so we can concatenate raw PCM cleanly,
                        // or just buffer the whole thing if we are only sending 1 big WAV per POST.
                        pseudoWs.audioBuffer.push(chunkBuf.subarray(44));
                    }
                } catch (e) {
                    console.error("PseudoWS parse error:", e.message);
                }
            },

            close: () => {
                pseudoWs.readyState = 3; // CLOSED
                if (pseudoWs.interval) clearInterval(pseudoWs.interval);
                pseudoWs.audioBuffer = [];
                console.log('Sarvam STT Stream (Pseudo) Closed');
            }
        };

        // Every 2 seconds, grab the buffer, wrap in WAV, and send to Sarvam REST
        pseudoWs.interval = setInterval(async () => {
            if (pseudoWs.audioBuffer.length === 0) return;

            // Combine all raw PCM chunks
            const rawPcm = Buffer.concat(pseudoWs.audioBuffer);
            pseudoWs.audioBuffer = []; // Clear for next batch

            // Re-wrap in a single WAV header
            const dataLength = rawPcm.length;
            const wavHeader = Buffer.alloc(44);
            wavHeader.write('RIFF', 0);
            wavHeader.writeUInt32LE(dataLength + 36, 4);
            wavHeader.write('WAVE', 8);
            wavHeader.write('fmt ', 12);
            wavHeader.writeUInt32LE(16, 16);
            wavHeader.writeUInt16LE(1, 20);
            wavHeader.writeUInt16LE(1, 22);
            wavHeader.writeUInt32LE(16000, 24);
            wavHeader.writeUInt32LE(16000 * 1 * 16 / 8, 28);
            wavHeader.writeUInt16LE(1 * 16 / 8, 32);
            wavHeader.writeUInt16LE(16, 34);
            wavHeader.write('data', 36);
            wavHeader.writeUInt32LE(dataLength, 40);

            const finalWav = Buffer.concat([wavHeader, rawPcm]);

            try {
                // Submit to REST API
                const FormData = (await import('form-data')).default;
                const form = new FormData();
                form.append('file', finalWav, { filename: 'chunk.wav', contentType: 'audio/wav' });
                form.append('language_code', language_code);
                form.append('model', model);

                const response = await axios.post('https://api.sarvam.ai/speech-to-text-translate', form, {
                    headers: {
                        'api-subscription-key': this.apiKey,
                        ...form.getHeaders()
                    }
                });

                if (response.data && response.data.transcript) {
                    console.log("[Sarvam REST STT] Got transcript:", response.data.transcript);
                    onTranscript({
                        transcript: response.data.transcript,
                        is_final: true // Trigger translation/TTS down the line
                    });
                }
            } catch (err) {
                console.error('[Sarvam REST STT] Error:', err.response?.data || err.message);
            }
        }, 3000); // 3-second intervals for stable translation phrases

        return pseudoWs;
    }

    /**
     * Translate text to target language
     * @param {String} text
     * @param {String} targetLanguageCode
     * @returns {Promise<String>}
     */
    async translateText(text, targetLanguageCode) {
        // Sarvam REST Translate endpoint currently supports translation between English and Indian languages
        // Ensure source is en-IN if the STT output converts speech to English.
        if (targetLanguageCode === 'en-IN') return text;

        try {
            const response = await fetch('https://api.sarvam.ai/translate', {
                method: "POST",
                headers: {
                    "api-subscription-key": this.apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    input: text.trim(),
                    source_language_code: "en-IN", // Assuming STT output is English or we normalize to English first
                    target_language_code: targetLanguageCode,
                    speaker_gender: "Male",
                    mode: "formal",
                    model: "mayura:v1",
                    enable_preprocessing: false,
                    numerals_format: "native"
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Translate HTTP error! status: ${response.status}, msg: ${errText}`);
            }

            const data = await response.json();
            return data.translated_text;
        } catch (error) {
            console.error('Sarvam Translate error:', error.message);
            throw error;
        }
    }

    async textToSpeech(text, targetLanguageCode) {
        try {
            const response = await axios.post('https://api.sarvam.ai/text-to-speech', {
                inputs: [text],
                target_language_code: targetLanguageCode,
                speaker: "shubh", // "shubh" per user request
                model: "bulbul:v3",
                pace: 1.1,
                enable_preprocessing: true
            }, {
                headers: {
                    "api-subscription-key": this.apiKey,
                    "Content-Type": "application/json"
                }
            });

            // Parse base64 string from bulbul:v3 back into a Buffer for WebSocket transmission
            if (response.data && response.data.audios && response.data.audios.length > 0) {
                return Buffer.from(response.data.audios[0], 'base64');
            } else {
                throw new Error("Invalid TTS response format");
            }

        } catch (error) {
            console.error('Sarvam TTS error:', error.response?.data || error.message);
            throw error;
        }
    }
}

export default new SarvamService(process.env.SARVAM_API_KEY);
