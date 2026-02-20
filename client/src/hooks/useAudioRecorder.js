import { useState, useRef, useCallback } from 'react';

export const useAudioRecorder = (onAudioChunk) => {
    const [isRecording, setIsRecording] = useState(false);
    const audioContextRef = useRef(null);
    const streamRef = useRef(null);
    const workletNodeRef = useRef(null);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    noiseSuppression: true,
                    echoCancellation: true,
                    autoGainControl: true,
                    sampleRate: 16000,
                },
            });

            streamRef.current = stream;
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000,
            });

            await audioContextRef.current.audioWorklet.addModule('/audio-processor.js');

            const source = audioContextRef.current.createMediaStreamSource(stream);
            workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'audio-stream-processor');

            workletNodeRef.current.port.onmessage = (event) => {
                const float32Data = event.data;
                // Convert Float32 to Int16 PCM for Sarvam API compatibility (usually 16-bit PCM)
                const pcmData = convertFloat32ToInt16(float32Data);
                onAudioChunk(pcmData);
            };

            source.connect(workletNodeRef.current);
            workletNodeRef.current.connect(audioContextRef.current.destination);

            setIsRecording(true);
        } catch (error) {
            console.error('Error starting recording:', error);
            throw error;
        }
    }, [onAudioChunk]);

    const stopRecording = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        setIsRecording(false);
    }, []);

    return { isRecording, startRecording, stopRecording };
};

function convertFloat32ToInt16(buffer) {
    let l = buffer.length;
    let buf = new Int16Array(l);
    while (l--) {
        buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
    }
    return buf.buffer;
}
