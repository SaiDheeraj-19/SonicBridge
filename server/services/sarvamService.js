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
                    const chunkBuf = Buffer.from(parsed.audio.data, 'base64');
                    // No longer skipping 44 bytes as host sends raw PCM chunks, not WAV files.
                    pseudoWs.audioBuffer.push(chunkBuf);
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
                        // Sarvam may return translation in 'translate', 'translate_transcript' or we fallback to 'transcript'
                        translate: response.data.translate || response.data.translate_transcript || response.data.transcript,
                        is_final: true
                    });
                }
            } catch (err) {
                const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
                console.error('[Sarvam REST STT] Error:', errorMsg);
                if (onError) onError(new Error(`Sarvam API: ${errorMsg}`));
            }
        }, 1200); // 1.2-second intervals for reduced latency while maintaining coherent STT

        return pseudoWs;
    }

    /**
     * Translate text to target language
     * @param {String} text
     * @param {String} targetLanguageCode
     * @returns {Promise<String>}
     */
    async translateText(text, targetLanguageCode, sourceLanguageCode = "en-IN") {
        // Avoid redundant translation
        if (targetLanguageCode === sourceLanguageCode) return text;

        try {
            const response = await axios.post('https://api.sarvam.ai/translate', {
                input: text.trim(),
                source_language_code: sourceLanguageCode,
                target_language_code: targetLanguageCode,
                speaker_gender: "Male",
                mode: "formal",
                model: "mayura:v1",
                enable_preprocessing: false,
                numerals_format: "native"
            }, {
                headers: {
                    "api-subscription-key": this.apiKey,
                    "Content-Type": "application/json"
                }
            });

            return response.data.translated_text;
        } catch (error) {
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error('[Sarvam Translate] error:', errorMsg);
            throw new Error(`Translate Failed: ${errorMsg}`);
        }
    }

    async textToSpeech(text, targetLanguageCode) {
        try {
            // Recommendation for bulbul:v3 speakers per language
            const speakerMap = {
                'hi-IN': 'shubh',
                'kn-IN': 'shruti', // Fixed from meera to shruti for consistency
                'ml-IN': 'shruti',
                'mr-IN': 'shruti',
                'ta-IN': 'kavitha', // Fixed: pavithra was invalid, kavitha is valid
                'te-IN': 'shruti',  // Fixed: sruthi was invalid, shruti is valid
                'bn-IN': 'shruti',
                'en-IN': 'shruti'
            };

            const speaker = speakerMap[targetLanguageCode] || 'meera';

            console.log(`[Sarvam TTS] Requesting TTS for language: ${targetLanguageCode}, speaker: ${speaker}`);

            const response = await axios.post('https://api.sarvam.ai/text-to-speech', {
                inputs: [text],
                target_language_code: targetLanguageCode,
                speaker: speaker,
                model: "bulbul:v3",
                pace: 1.0,
                enable_preprocessing: true
            }, {
                headers: {
                    "api-subscription-key": this.apiKey,
                    "Content-Type": "application/json"
                }
            });

            if (response.data && response.data.audios && response.data.audios.length > 0) {
                const audioBuffer = Buffer.from(response.data.audios[0], 'base64');
                console.log(`[Sarvam TTS] Received audio buffer for "${text.substring(0, 20)}...", length: ${audioBuffer.length} bytes`);
                return audioBuffer;
            } else {
                throw new Error("Invalid TTS response format: 'audios' field missing or empty");
            }

        } catch (error) {
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            console.error('[Sarvam TTS] error:', errorMsg);
            throw new Error(`TTS Failed: ${errorMsg}`);
        }
    }
}

export default new SarvamService(process.env.SARVAM_API_KEY);
