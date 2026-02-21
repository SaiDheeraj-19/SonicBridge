import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";

async function testREST() {
    const formData = new FormData();
    formData.append('file', fs.createReadStream('test.wav'));
    formData.append('language_code', 'en-IN');
    formData.append('model', 'saaras:v2.5');

    const response = await axios.post('https://api.sarvam.ai/speech-to-text-translate', formData, {
        headers: {
            'api-subscription-key': apiKey,
            ...formData.getHeaders()
        }
    });

    console.log(response.data);
}

testREST().catch(err => console.error(err.response?.data || err.message));
