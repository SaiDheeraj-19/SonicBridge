import axios from 'axios';

const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";

async function test() {
    try {
        const response = await axios.post('https://api.sarvam.ai/translate', {
            input: "hello world",
            source_language_code: "en-IN",
            target_language_code: "hi-IN",
            speaker_gender: "Male",
            mode: "formal",
            model: "mayura:v1",
            enable_preprocessing: false,
            numerals_format: "native"
        }, {
            headers: {
                "api-subscription-key": apiKey,
                "Content-Type": "application/json"
            }
        });
        console.log(response.data);
    } catch (e) {
        console.error(e.response?.data || e.message);
    }
}
test();
