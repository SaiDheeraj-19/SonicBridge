import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Translation endpoint (if needed for non-streaming)
router.post('/translate', async (req, res) => {
    try {
        const { text, source_language_code, target_language_code } = req.body;
        const response = await axios.post('https://api.sarvam.ai/translate', {
            input: text,
            source_language_code,
            target_language_code,
            speaker_gender: "Male"
        }, {
            headers: {
                'api-subscription-key': process.env.SARVAM_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Translation error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Translation failed' });
    }
});

export default router;
