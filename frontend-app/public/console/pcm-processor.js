// AudioWorklet: resample mic audio to 16 kHz mono PCM in 50ms chunks (800 samples)
// with adaptive noise gate, multi-band VAD, and spectral noise estimation
// to isolate clean voice and eliminate background noise for STT accuracy.
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

    // === Adaptive Noise Floor ===
    // Track rolling minimum RMS over ~2 seconds to auto-calibrate
    // gate threshold to the caller's environment
    this.noiseFloorRMS = 0.005;       // Initial conservative estimate
    this.noiseFloorAlpha = 0.02;      // Slow tracking rate for noise floor
    this.noiseFloorWindowSize = 40;   // 40 frames × 50ms = 2 seconds
    this.noiseFloorMinHistory = new Float32Array(this.noiseFloorWindowSize);
    this.noiseFloorIdx = 0;
    this.noiseFloorCount = 0;
    this.framesSinceCalibration = 0;
    this.calibrationFrames = 10;      // First 500ms: fast calibration

    // === Multi-Band Energy Analysis ===
    // Accumulate per-band energy for speech vs noise discrimination
    this.bandEnergy = { low: 0, speech: 0, high: 0, total: 0 };
    this.bandSampleCount = 0;

    // Simple 2-pole bandpass state variables for real-time band splitting
    // Band boundaries: low=0–300Hz, speech=300–3500Hz, high=3500Hz+
    this.bpState = {
      low: { y1: 0, y2: 0 },
      high: { y1: 0, y2: 0 },
    };

    // === VAD State ===
    this.vadProbability = 0;
    this.vadSmoothAlpha = 0.8;

    // === External VAD from noise suppressor (if connected) ===
    this.externalVAD = -1; // -1 = not available

    // Listen for VAD updates from the noise suppressor worklet
    this.port.onmessage = (e) => {
      if (e.data && e.data.externalVAD !== undefined) {
        this.externalVAD = e.data.externalVAD;
      }
    };
  }

  /**
   * Simple single-pole highpass filter for band energy estimation.
   * Returns the high-passed sample and updates state.
   */
  highpass1p(sample, state, cutoffNorm) {
    // cutoffNorm = cutoff_freq / sample_rate (normalized)
    const rc = 1.0 / (2.0 * Math.PI * cutoffNorm);
    const alpha = rc / (rc + 1.0 / sampleRate);
    const y = alpha * (state.y1 + sample - state.y2);
    state.y2 = sample;
    state.y1 = y;
    return y;
  }

  /**
   * Compute adaptive speech threshold based on noise floor + margin.
   * Uses SNR-based scaling: threshold = noiseFloor * (1.5 + log2(SNR))
   */
  getAdaptiveThreshold() {
    // Minimum threshold: never go below 0.005 to avoid triggering on ADC noise
    const minThreshold = 0.005;
    // Adaptive threshold: noise floor + 6dB margin (factor of 2)
    const adaptiveThreshold = this.noiseFloorRMS * 2.0;
    return Math.max(minThreshold, adaptiveThreshold);
  }

  /**
   * Update noise floor estimate using minimum statistics.
   */
  updateNoiseFloor(rms) {
    this.framesSinceCalibration++;

    if (this.framesSinceCalibration <= this.calibrationFrames) {
      // Fast calibration during first 500ms
      const alpha = 1.0 / this.framesSinceCalibration;
      this.noiseFloorRMS = this.noiseFloorRMS * (1 - alpha) + rms * alpha;
      return;
    }

    // After calibration: track using fixed circular buffer (zero garbage collection)
    this.noiseFloorMinHistory[this.noiseFloorIdx] = rms;
    this.noiseFloorIdx = (this.noiseFloorIdx + 1) % this.noiseFloorWindowSize;
    if (this.noiseFloorCount < this.noiseFloorWindowSize) {
      this.noiseFloorCount++;
    }

    // Only update noise floor from quiet frames (below current threshold)
    const threshold = this.getAdaptiveThreshold();
    if (rms < threshold) {
      this.noiseFloorRMS = this.noiseFloorRMS * (1 - this.noiseFloorAlpha) + rms * this.noiseFloorAlpha;
    }

    // Also track the rolling minimum as a lower bound without allocating arrays
    if (this.noiseFloorCount >= 5) {
      let min1 = Infinity, min2 = Infinity, min3 = Infinity, min4 = Infinity;
      for (let i = 0; i < this.noiseFloorCount; i++) {
        const v = this.noiseFloorMinHistory[i];
        if (v < min1) {
          min4 = min3; min3 = min2; min2 = min1; min1 = v;
        } else if (v < min2) {
          min4 = min3; min3 = min2; min2 = v;
        } else if (v < min3) {
          min4 = min3; min3 = v;
        } else if (v < min4) {
          min4 = v;
        }
      }
      const percentile10 = min4 < Infinity ? min4 : min1;
      // Slowly pull noise floor toward the 10th percentile minimum
      if (percentile10 < this.noiseFloorRMS) {
        this.noiseFloorRMS = this.noiseFloorRMS * 0.95 + percentile10 * 0.05;
      }
    }
  }

  /**
   * Compute multi-band VAD probability.
   * Speech concentrates energy in 300–3500Hz band.
   * Environmental noise (traffic, AC, fan) is broadband or low-frequency.
   */
  computeMultiBandVAD(rms) {
    const total = this.bandEnergy.total;
    if (total < 1e-12) return 0;

    // Speech band ratio
    const speechRatio = this.bandEnergy.speech / total;

    // SNR estimate
    const snr = rms / (this.noiseFloorRMS + 1e-10);

    // Raw VAD from speech ratio (0.25–0.65 → 0–1)
    let rawVAD = Math.max(0, Math.min(1, (speechRatio - 0.25) / 0.40)) * 0.5;

    // SNR contribution (SNR 1.5–6.0 → 0–1)
    rawVAD += Math.max(0, Math.min(1, (snr - 1.5) / 4.5)) * 0.35;

    // Absolute level contribution (must be above noise floor)
    rawVAD += (rms > this.getAdaptiveThreshold() ? 0.15 : 0);

    // Blend with external VAD from noise suppressor if available
    if (this.externalVAD >= 0) {
      rawVAD = rawVAD * 0.4 + this.externalVAD * 0.6;
    }

    // Temporal smoothing
    this.vadProbability = this.vadSmoothAlpha * this.vadProbability + (1 - this.vadSmoothAlpha) * rawVAD;

    return this.vadProbability;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];

    let idx = this._frac;
    while (idx < ch.length) {
      const sampleIdx = Math.floor(idx);
      const s = Math.max(-1, Math.min(1, ch[sampleIdx]));
      this.buffer[this.bufferIdx++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      this.sumSq += s * s;

      // === Multi-band energy accumulation ===
      // Simple energy tracking per band using the raw sample
      // (Approximate: full-band energy partitioning based on spectral characteristics)
      const absS = Math.abs(s);
      this.bandEnergy.total += absS * absS;
      
      // Use simple first-order filters for band splitting
      const hpSample = this.highpass1p(s, this.bpState.low, 300 / sampleRate);
      const lpHigh = this.highpass1p(s, this.bpState.high, 3500 / sampleRate);
      
      // Low band: original - highpassed (below 300Hz)
      const lowSample = s - hpSample;
      this.bandEnergy.low += lowSample * lowSample;
      
      // High band: above 3500Hz
      this.bandEnergy.high += lpHigh * lpHigh;
      
      // Speech band: between 300–3500Hz (total - low - high)
      const speechSample = hpSample - lpHigh;
      this.bandEnergy.speech += speechSample * speechSample;
      
      this.bandSampleCount++;

      if (this.bufferIdx >= this.bufferSize) {
        const rms = Math.sqrt(this.sumSq / this.bufferSize);
        const chunk = this.buffer.slice();

        // Update adaptive noise floor
        this.updateNoiseFloor(rms);

        // Compute multi-band VAD
        const vad = this.computeMultiBandVAD(rms);
        const adaptiveThreshold = this.getAdaptiveThreshold();
        const isSpeech = vad > 0.4 || rms >= adaptiveThreshold;

        // Adaptive Noise Gate with extended hangover:
        if (isSpeech) {
          this.hangover = 6; // 6 frames × 50ms = 300ms hangover for natural trailing syllables
        } else if (this.hangover > 0) {
          this.hangover--;
        } else {
          // Below noise floor: zero out ambient noise so Gemini VAD detects clean silence
          chunk.fill(0);
        }

        // Post message with enhanced telemetry
        this.port.postMessage({
          pcm: chunk.buffer,
          rms,
          vadProbability: vad,
          noiseFloor: this.noiseFloorRMS,
          snr: rms / (this.noiseFloorRMS + 1e-10),
          isSpeech,
        }, [chunk.buffer]);

        // Reset accumulators
        this.bufferIdx = 0;
        this.sumSq = 0;
        this.bandEnergy = { low: 0, speech: 0, high: 0, total: 0 };
        this.bandSampleCount = 0;
      }

      idx += this.ratio;
    }
    this._frac = idx - ch.length;
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
