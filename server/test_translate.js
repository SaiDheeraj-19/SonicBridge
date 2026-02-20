import axios from 'axios';
const apiKey = "sk_s5zgjmca_a9mwOTtYAveaY1FvbwRDbwGE";

async function translateTest() {
    const res = await axios.post('https://api.sarvam.ai/translate', {
        input: "Hello, how are you?",
        source_language_code: "en-IN",
        target_language_code: "hi-IN",
        speaker_gender: "Male",
        mode: "formal",
        model: "mayura:v1",
        enable_preprocessing: true
    }, {
        headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' }
    });
    console.log(res.data);
}
translateTest();
