class AudioStreamProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 2048; // 128ms at 16kHz — optimized for low latency
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, _outputs, _parameters) {
        const input = inputs[0];
        if (input && input[0]) {
            const inputChannel = input[0];

            for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex++] = inputChannel[i];

                if (this.bufferIndex >= this.bufferSize) {
                    // Send automatically, letting the much smarter server VAD handle silence
                    this.port.postMessage(this.buffer);
                    this.bufferIndex = 0;
                    this.buffer = new Float32Array(this.bufferSize);
                }
            }
        }
        return true;
    }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor);
