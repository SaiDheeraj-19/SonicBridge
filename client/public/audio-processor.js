class AudioStreamProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096; // Adjust based on sampling rate and chunk goal
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, _outputs, _parameters) {
        const input = inputs[0];
        if (input && input[0]) {
            const inputChannel = input[0];

            // Simple VAD logic (RMS energy)
            let energy = 0;
            for (let i = 0; i < inputChannel.length; i++) {
                energy += inputChannel[i] * inputChannel[i];
            }
            const rms = Math.sqrt(energy / inputChannel.length);

            // Threshold for "silence" (adjust as needed)
            const threshold = 0.01;

            for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex++] = inputChannel[i];

                if (this.bufferIndex >= this.bufferSize) {
                    if (rms > threshold) {
                        // Send only if there's enough audio energy
                        this.port.postMessage(this.buffer);
                    }
                    this.bufferIndex = 0;
                    this.buffer = new Float32Array(this.bufferSize);
                }
            }
        }
        return true;
    }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);
