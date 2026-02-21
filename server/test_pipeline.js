import sarvamService from './services/sarvamService.js';

async function testPipeline() {
    const text = "Hello friends, I am checking the translation system.";
    const targetLangs = ['hi-IN', 'te-IN', 'ta-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'bn-IN', 'en-IN'];

    console.log("Starting Pipeline Emulation...");

    for (const lang of targetLangs) {
        try {
            console.log(`Processing: ${lang}`);
            const translated = await sarvamService.translateText(text, lang, 'en-IN');
            console.log(`  - Translated: ${translated}`);
            const audio = await sarvamService.textToSpeech(translated, lang);
            console.log(`  - TTS Success: ${audio.length} bytes`);
        } catch (e) {
            console.error(`  - Failed for ${lang}:`, e.message);
        }
    }
}

testPipeline();
