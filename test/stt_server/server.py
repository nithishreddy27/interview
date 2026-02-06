import asyncio
import json
import time
import numpy as np
import websockets
from faster_whisper import WhisperModel

MODEL_NAME = "small"          # try "small" on GPU for better accuracy
DEVICE = "cuda"              # <<< GPU
COMPUTE_TYPE = "float16"     # <<< GPU

SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2
CHANNELS = 1
BYTES_PER_SEC = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS  # 32000

# Streaming feel knobs
# STEP_SEC = 0.50             # how often we run transcribe
# TAIL_SEC = 0.35             # keep a bit of previous audio for context
# MAX_CTX_SEC = 1.60          # do NOT exceed this much audio per decode

STEP_SEC = 1.5      # was 0.50 (more latency)
TAIL_SEC = 0.4   # optional: more context
MAX_CTX_SEC = 2.2   # optional: more context
beam_size = 5
temperature = 0

STEP_BYTES = int(BYTES_PER_SEC * STEP_SEC)       # 16000
TAIL_BYTES = int(BYTES_PER_SEC * TAIL_SEC)       # 11200
MAX_CTX_BYTES = int(BYTES_PER_SEC * MAX_CTX_SEC) # 51200

# Skip decode if mostly silence (tune)
RMS_GATE = 0.008

model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)

def pcm16le_to_float32(pcm_bytes: bytes) -> np.ndarray:
    a = np.frombuffer(pcm_bytes, dtype=np.int16)
    return a.astype(np.float32) / 32768.0

def rms_level(audio_f32: np.ndarray) -> float:
    if audio_f32.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(audio_f32 * audio_f32)))

async def handler(ws):
    # We keep two buffers:
    # - tail: small context from previous audio
    # - inbox: new audio frames arriving
    tail = bytearray()
    inbox = bytearray()

    # Anti-lag: only one transcribe runs at a time; if more audio arrives, we keep collecting,
    # but we DO NOT queue multiple transcribes.
    transcribing = False

    await ws.send(json.dumps({"type": "ready", "model": MODEL_NAME, "device": DEVICE}))

    async def maybe_transcribe():
        nonlocal transcribing, tail, inbox

        if transcribing:
            return
        if len(inbox) < STEP_BYTES:
            return

        transcribing = True
        try:
            # Take exactly one step worth of new audio
            new = bytes(inbox[:STEP_BYTES])
            del inbox[:STEP_BYTES]

            # Build context = tail + new, capped to MAX_CTX_BYTES
            ctx = (bytes(tail) + new)
            if len(ctx) > MAX_CTX_BYTES:
                ctx = ctx[-MAX_CTX_BYTES:]

            audio = pcm16le_to_float32(ctx)

            # Silence gate (saves GPU time and reduces “empty finals”)
            if rms_level(audio) < RMS_GATE:
                # Update tail anyway so context moves forward
                tail = bytearray(ctx[-TAIL_BYTES:]) if len(ctx) >= TAIL_BYTES else bytearray(ctx)
                return

            t0 = time.perf_counter()
            segments, info = model.transcribe(
                audio,
                language="en",
                vad_filter=False,
                beam_size=5,
                best_of=5,
                temperature=0,
                condition_on_previous_text=True,
                without_timestamps=True,
            )
            dt_ms = (time.perf_counter() - t0) * 1000.0

            text = " ".join(seg.text.strip() for seg in segments).strip()
            if text:
                # (Optional) include decode_ms for debugging; remove later
                await ws.send(json.dumps({"type": "final", "text": text, "decode_ms": round(dt_ms)}))

            # Update tail to last TAIL_BYTES of context
            tail = bytearray(ctx[-TAIL_BYTES:]) if len(ctx) >= TAIL_BYTES else bytearray(ctx)

        finally:
            transcribing = False

            # If we already have enough for another step, run again immediately (catch up),
            # but DO NOT loop forever — this keeps latency bounded.
            if len(inbox) >= STEP_BYTES:
                # schedule another run, but yield control to event loop
                asyncio.create_task(maybe_transcribe())

    try:
        async for msg in ws:
            if isinstance(msg, str):
                if msg.strip().upper() == "RESET":
                    tail.clear()
                    inbox.clear()
                continue

            # binary PCM16 frames
            inbox.extend(msg)

            # Hard anti-lag: cap inbox to ~3 seconds. If it grows, drop oldest.
            # This guarantees you never get “lag like hell”.
            MAX_INBOX_BYTES = BYTES_PER_SEC * 3
            if len(inbox) > MAX_INBOX_BYTES:
                # drop oldest bytes, keep newest
                inbox[:] = inbox[-MAX_INBOX_BYTES:]

            # Try transcribing (non-blocking; uses anti-queue)
            asyncio.create_task(maybe_transcribe())

    except websockets.ConnectionClosed:
        return

async def main():
    async with websockets.serve(handler, "127.0.0.1", 8765, max_size=50_000_000):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
