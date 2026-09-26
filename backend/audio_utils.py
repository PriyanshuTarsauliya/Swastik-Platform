import numpy as np

# Precomputed ulaw to linear mapping (8-bit to 16-bit)
ULAW_TO_LIN = np.zeros(256, dtype=np.int16)
for i in range(256):
    ulaw = ~i & 0xFF
    sign = (ulaw & 0x80)
    exponent = (ulaw & 0x70) >> 4
    mantissa = ulaw & 0x0F
    sample = (mantissa << 3) + 132
    sample <<= exponent
    sample -= 132
    if sign != 0:
        sample = -sample
    ULAW_TO_LIN[i] = sample

def ulaw2lin(chunk: bytes, width: int) -> bytes:
    """Convert 8-bit mu-law to 16-bit linear PCM."""
    if width != 2:
        raise ValueError("Only 16-bit width is supported")
    ulaw_data = np.frombuffer(chunk, dtype=np.uint8)
    lin_data = ULAW_TO_LIN[ulaw_data]
    return lin_data.tobytes()

# Precomputed linear to ulaw mapping (16-bit to 8-bit)
# For fast conversion, we can build a 65536 array, but that takes 64KB.
# 64KB is perfectly fine in memory.
LIN_TO_ULAW = np.zeros(65536, dtype=np.uint8)
for i in range(65536):
    # sign extend to 32 bit to handle negative numbers in python properly
    sample = i
    if sample > 32767:
        sample -= 65536
    
    sign = 0x80 if sample < 0 else 0
    if sample < 0:
        sample = -sample
    
    sample += 132
    sample = min(sample, 32767)
    
    exponent = 7
    for exp in reversed(range(8)):
        if (sample >> (exp + 3)) > 0:
            exponent = exp
            break
            
    mantissa = (sample >> (exponent + 3)) & 0x0F
    ulaw = ~(sign | (exponent << 4) | mantissa) & 0xFF
    LIN_TO_ULAW[i] = ulaw

def lin2ulaw(chunk: bytes, width: int) -> bytes:
    """Convert 16-bit linear PCM to 8-bit mu-law."""
    if width != 2:
        raise ValueError("Only 16-bit width is supported")
    lin_data = np.frombuffer(chunk, dtype=np.uint16)
    ulaw_data = LIN_TO_ULAW[lin_data]
    return ulaw_data.tobytes()

def ratecv(chunk: bytes, width: int, nchannels: int, in_rate: int, out_rate: int, state) -> tuple[bytes, None]:
    """Simple rate conversion. Returns (pcm, None) to emulate audioop.ratecv."""
    if not chunk:
        return b"", None
    pcm = np.frombuffer(chunk, dtype=np.int16)
    
    if in_rate == out_rate:
        pass
    elif out_rate > in_rate:
        ratio = out_rate // in_rate
        if ratio > 1 and out_rate % in_rate == 0:
            pcm = np.repeat(pcm, ratio)
        else:
            indices = np.round(np.linspace(0, len(pcm) - 1, int(len(pcm) * out_rate / in_rate))).astype(int)
            pcm = pcm[indices]
    else:
        ratio = in_rate // out_rate
        if ratio > 1 and in_rate % out_rate == 0:
            pcm = pcm[::ratio]
        else:
            indices = np.round(np.linspace(0, len(pcm) - 1, int(len(pcm) * out_rate / in_rate))).astype(int)
            pcm = pcm[indices]
            
    return pcm.tobytes(), None
