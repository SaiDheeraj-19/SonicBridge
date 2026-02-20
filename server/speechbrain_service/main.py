import os
import io
import wave
import numpy as np
import torch
from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel
from speechbrain.inference.speaker import EncoderClassifier

from contextlib import asynccontextmanager

# Initialize SpeechBrain speaker recognition model natively
classifier = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global classifier
    try:
        # device='cuda' would be used in production if available
        classifier = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb", savedir="tmpdir")
        print("SpeechBrain models loaded successfully")
    except Exception as e:
        print(f"Warning: Could not load SpeechBrain model: {e}")
    yield
    # Clean up can happen here if needed

app = FastAPI(title="SonicBridge VAD & Speaker Verification Service", lifespan=lifespan)

@app.get("/health")
async def health_check():
    return {"status": "ok", "model": "speechbrain/spkrec-ecapa-voxceleb"}

@app.get("/")
async def root():
    return {"message": "SonicBridge AI Service is Running"}

class EmbeddingResponse(BaseModel):
    embedding: list
    message: str

class VerificationResponse(BaseModel):
    similarity: float
    is_match: bool
    message: str

def pcm16_to_tensor(pcm_bytes: bytes) -> torch.Tensor:
    """Convert raw 16k PCM int16 bytes to float32 tensor array expected by SpeechBrain."""
    audio_array = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    return torch.tensor(audio_array).unsqueeze(0)

@app.post("/api/enroll", response_model=EmbeddingResponse)
async def enroll_speaker(file: UploadFile = File(...)):
    """Receives 10s audio from host, returns speaker embedding to register in Node backend."""
    global classifier
    if not classifier:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    audio_bytes = await file.read()
    signal = pcm16_to_tensor(audio_bytes)
    
    with torch.no_grad():
        embeddings = classifier.encode_batch(signal)
    
    # Return as flat array
    emb_list = embeddings.squeeze().cpu().numpy().tolist()
    return {"embedding": emb_list, "message": "Host enrolled successfully"}

@app.post("/api/verify", response_model=VerificationResponse)
async def verify_speaker(embedding: list, file: UploadFile = File(...)):
    """Validates real-time audio chunk against stored host embedding. Runs < 50ms"""
    global classifier
    if not classifier:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    audio_bytes = await file.read()
    signal = pcm16_to_tensor(audio_bytes)
    
    # The chunk's embedding
    with torch.no_grad():
        chunk_embedding = classifier.encode_batch(signal)
    
    # Create tensor from the stored host embedding array
    host_emb_tensor = torch.tensor(embedding).unsqueeze(0).unsqueeze(0)
    
    # Calculate cosine similarity
    similarity = torch.nn.functional.cosine_similarity(chunk_embedding, host_emb_tensor, dim=2)
    score = similarity.item()
    
    # Threshold check 0.75 as per strict prompt rule
    is_match = score > 0.75
    
    return {
        "similarity": score,
        "is_match": is_match,
        "message": "Verification complete"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
