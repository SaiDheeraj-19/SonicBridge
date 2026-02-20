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
            model = 'saaras:v3',
        } = options;

        const url = `${SARVAM_STT_URL}?language_code=${language_code}&model=${model}`;
        console.log("Connecting to Sarvam STT:", url);

        const ws = new WebSocket(url, {
            headers: {
                'api-subscription-key': this.apiKey
            }
        });

        ws.on('open', () => {
            console.log('Connected to Sarvam STT Stream');
        });

        ws.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());
                console.log("Sarvam STT Raw Response:", response);
                onTranscript(response);
            } catch (err) {
                console.error('Error parsing Sarvam STT message:', err);
            }
        });

        ws.on('error', (err) => {
            console.error('Sarvam STT WebSocket error:', err);
            onError(err);
        });

        return ws;
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

    /**
     * Convert text to speech using Sarvam TTS (Streaming API via Option 2)
     * @param {String} text 
     * @param {String} targetLanguageCode 
     * @returns {Promise<Buffer>}
     */
    async textToSpeech(text, targetLanguageCode) {
        try {
            const response = await fetch('https://api.sarvam.ai/text-to-speech/stream', {
                method: "POST",
                headers: {
                    "api-subscription-key": this.apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text: text,
                    target_language_code: targetLanguageCode,
                    speaker: "shubh", // "shubh" per user request
                    model: "bulbul:v3", // upgraded to v3
                    pace: 1.1,
                    speech_sample_rate: 22050,
                    output_audio_codec: "mp3",
                    enable_preprocessing: true
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, msg: ${errText}`);
            }

            // Option 2: Collect all chunks natively on the server and return as one Buffer for the WebSocket
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            console.error('Sarvam TTS error:', error.message);
            throw error;
        }
    }
}

export default new SarvamService(process.env.SARVAM_API_KEY);
