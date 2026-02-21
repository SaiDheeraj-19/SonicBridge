import axios from 'axios';

const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";

async function test() {
    try {
        const response = await axios.post('https://api.sarvam.ai/text-to-speech', {
            inputs: ["नमस्ते विश्व"],
            target_language_code: "hi-IN",
            speaker: "shubh",
            model: "bulbul:v3",
            pace: 1.1,
            enable_preprocessing: true
        }, {
            headers: {
                "api-subscription-key": apiKey,
                "Content-Type": "application/json"
            }
        });
        const decoded = Buffer.from(response.data.audios[0], 'base64');
        console.log("Got response:", response.data.audios[0].substring(0, 50), "decoded len:", decoded.length);
    } catch (e) {
        console.error("ERR", e.response?.data || e.message);
    }
}
test();
