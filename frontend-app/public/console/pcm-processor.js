// AudioWorklet: resample mic audio to 16 kHz mono PCM and emit in 50ms (800 sample) chunks
// to ensure ultra-low latency without WebSocket packet flooding or jitter.
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000; // e.g. 48000 / 16000 = 3
    this._frac = 0;
    this.bufferSize = 800; // 50ms at 16,000 Hz = 800 samples
    this.buffer = new Int16Array(this.bufferSize);
    this.bufferIdx = 0;
    this.sumSq = 0;
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
        // Transfer 50ms PCM chunk efficiently
        const chunk = this.buffer.slice();
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
