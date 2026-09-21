// AudioWorklet: resample mic audio to 16 kHz mono PCM in 50ms chunks (800 samples)
// with an adaptive noise gate (150ms speech hangover) to isolate clean voice and eliminate background noise.
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this._frac = 0;
    this.bufferSize = 800; // 50ms at 16,000 Hz = 800 samples
    this.buffer = new Int16Array(this.bufferSize);
    this.bufferIdx = 0;
    this.sumSq = 0;
    this.hangover = 0; // Speech hangover frames to preserve soft word endings
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];

    let idx = this._frac;
    while (idx < ch.length) {
      const s = Math.max(-1, Math.min(1, ch[Math.floor(idx)]));
      this.buffer[this.bufferIdx++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      this.sumSq += s * s;

      if (this.bufferIdx >= this.bufferSize) {
        const rms = Math.sqrt(this.sumSq / this.bufferSize);
        const chunk = this.buffer.slice();

        // Adaptive Noise Gate:
        // Speech threshold: ~0.009 RMS. Ambient room/fan noise is typically <0.007.
        if (rms >= 0.009) {
          this.hangover = 3; // Keep gate open for 3 frames (150ms) to preserve soft syllables
        } else if (this.hangover > 0) {
          this.hangover--;
        } else {
          // Room noise floor: zero out ambient noise so Gemini VAD detects clean silence
          chunk.fill(0);
        }

        this.port.postMessage({ pcm: chunk.buffer, rms }, [chunk.buffer]);
        this.bufferIdx = 0;
        this.sumSq = 0;
      }

      idx += this.ratio;
    }
    this._frac = idx - ch.length;
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
