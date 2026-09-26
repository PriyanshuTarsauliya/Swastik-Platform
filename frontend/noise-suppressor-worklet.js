/**
 * Noise Suppressor AudioWorklet — Real-Time Spectral Subtraction
 * 
 * Sits in the audio graph between the compressor and the PCM resampler.
 * Performs frame-by-frame spectral subtraction noise suppression using
 * a pure-JS FFT implementation. No external dependencies.
 * 
 * Pipeline:   Mic → Highpass → Lowpass → Notch → Compressor → [THIS] → PCM Worklet → WS
 * 
 * Frame size: 256 samples (~5.3ms at 48kHz)
 * Overlap:    50% (128 sample hop) for smooth reconstruction
 * Latency:    ~5.3ms (single frame)
 * 
 * Outputs denoised audio on channel 0 and posts VAD probability via port.
 */
class NoiseSuppressorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.fftSize = 256;
    this.halfFFT = this.fftSize / 2 + 1; // 129 bins
    this.hopSize = this.fftSize / 2;      // 128 samples (50% overlap)

    // Circular input buffer for overlap-add
    this.inputBuffer = new Float32Array(this.fftSize);
    this.inputWritePos = 0;
    this.samplesUntilProcess = this.fftSize; // fill first frame fully

    // Output overlap-add buffer (double length for overlap)
    this.outputBuffer = new Float32Array(this.fftSize * 2);
    this.outputReadPos = 0;

    // Hann window for analysis & synthesis
    this.window = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / this.fftSize));
    }

    // Noise floor estimate (magnitude spectrum)
    this.noiseFloor = new Float32Array(this.halfFFT);
    this.noiseFloorInitialized = false;
    this.noiseUpdateFrames = 0;
    this.noiseCalibrationFrames = 15; // ~80ms of initial silence for calibration

    // Adaptive noise tracking (minimum statistics approach)
    this.minTracker = new Float32Array(this.halfFFT);
    this.minTrackerFilled = false;

    // Smoothing for gain to prevent musical noise
    this.prevGain = new Float32Array(this.halfFFT);
    this.prevGain.fill(1.0);

    // VAD state
    this.vadProbability = 0;
    this.vadSmoothAlpha = 0.85;
    this.speechBandEnergy = 0;
    this.totalBandEnergy = 0;

    // FFT working buffers
    this.fftReal = new Float32Array(this.fftSize);
    this.fftImag = new Float32Array(this.fftSize);

    // Frame counter for periodic VAD broadcast
    this.frameCount = 0;

    // Oversubtraction factor (1.0 = exact, >1.0 = more aggressive)
    this.alpha = 2.0;
    // Spectral floor to avoid nulling (prevents musical noise)
    this.beta = 0.02;

    // Listen for parameter changes from main thread
    this.port.onmessage = (e) => {
      if (e.data.alpha !== undefined) this.alpha = e.data.alpha;
      if (e.data.beta !== undefined) this.beta = e.data.beta;
    };
  }

  /**
   * In-place Cooley-Tukey FFT (radix-2 DIT)
   * @param {Float32Array} real
   * @param {Float32Array} imag
   * @param {boolean} inverse
   */
  fft(real, imag, inverse = false) {
    const n = real.length;
    // Bit-reversal permutation
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) {
        j ^= bit;
      }
      j ^= bit;
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }

    // Butterfly
    for (let len = 2; len <= n; len <<= 1) {
      const halfLen = len >> 1;
      const angle = (2 * Math.PI / len) * (inverse ? -1 : 1);
      const wReal = Math.cos(angle);
      const wImag = Math.sin(angle);
      for (let i = 0; i < n; i += len) {
        let curReal = 1, curImag = 0;
        for (let j = 0; j < halfLen; j++) {
          const tReal = curReal * real[i + j + halfLen] - curImag * imag[i + j + halfLen];
          const tImag = curReal * imag[i + j + halfLen] + curImag * real[i + j + halfLen];
          real[i + j + halfLen] = real[i + j] - tReal;
          imag[i + j + halfLen] = imag[i + j] - tImag;
          real[i + j] += tReal;
          imag[i + j] += tImag;
          const newCurReal = curReal * wReal - curImag * wImag;
          curImag = curReal * wImag + curImag * wReal;
          curReal = newCurReal;
        }
      }
    }

    if (inverse) {
      for (let i = 0; i < n; i++) {
        real[i] /= n;
        imag[i] /= n;
      }
    }
  }

  /**
   * Compute VAD probability using multi-band energy ratios.
   * Speech energy concentrates in 300Hz–3.5kHz. 
   * Noise is broadband.
   */
  computeVAD(magnitudes) {
    // Bin frequency resolution: sampleRate / fftSize
    const binHz = sampleRate / this.fftSize;
    
    let speechEnergy = 0;  // 300 Hz – 3500 Hz
    let lowEnergy = 0;     // 0 – 300 Hz
    let highEnergy = 0;    // 3500 Hz – Nyquist
    let totalEnergy = 0;

    for (let i = 0; i < this.halfFFT; i++) {
      const freq = i * binHz;
      const mag2 = magnitudes[i] * magnitudes[i];
      totalEnergy += mag2;

      if (freq >= 300 && freq <= 3500) {
        speechEnergy += mag2;
      } else if (freq < 300) {
        lowEnergy += mag2;
      } else {
        highEnergy += mag2;
      }
    }

    if (totalEnergy < 1e-10) return 0;

    // Speech band ratio: how much energy is in the speech band?
    const speechRatio = speechEnergy / totalEnergy;
    
    // Spectral flatness: flat = noise, peaked = speech
    let geoMean = 0;
    let ariMean = 0;
    for (let i = 1; i < this.halfFFT; i++) {
      const m = magnitudes[i] + 1e-10;
      geoMean += Math.log(m);
      ariMean += m;
    }
    geoMean = Math.exp(geoMean / (this.halfFFT - 1));
    ariMean = ariMean / (this.halfFFT - 1);
    const flatness = ariMean > 1e-10 ? geoMean / ariMean : 1;

    // Combine cues:
    // High speech ratio + low flatness (peaked spectrum) = likely speech
    let rawVAD = 0;
    
    // Speech ratio contribution (0.3–0.7 maps to 0–1)
    rawVAD += Math.max(0, Math.min(1, (speechRatio - 0.3) / 0.4)) * 0.5;
    
    // Spectral peakedness contribution (flatness < 0.3 = speech-like)
    rawVAD += Math.max(0, Math.min(1, (0.5 - flatness) / 0.4)) * 0.3;
    
    // Energy above noise floor contribution
    const snr = totalEnergy / (this.getNoiseFloorEnergy() + 1e-10);
    rawVAD += Math.max(0, Math.min(1, (snr - 2) / 8)) * 0.2;

    // Temporal smoothing
    this.vadProbability = this.vadSmoothAlpha * this.vadProbability + (1 - this.vadSmoothAlpha) * rawVAD;
    
    return this.vadProbability;
  }

  getNoiseFloorEnergy() {
    let e = 0;
    for (let i = 0; i < this.halfFFT; i++) {
      e += this.noiseFloor[i] * this.noiseFloor[i];
    }
    return e;
  }

  /**
   * Update noise floor estimate.
   * During initial calibration: direct average.
   * After calibration: slowly track upward, quickly track downward (minimum statistics).
   */
  updateNoiseFloor(magnitudes, isSpeech) {
    if (!this.noiseFloorInitialized) {
      // Initial calibration: average first N frames
      this.noiseUpdateFrames++;
      const alpha = 1 / this.noiseUpdateFrames;
      for (let i = 0; i < this.halfFFT; i++) {
        this.noiseFloor[i] = this.noiseFloor[i] * (1 - alpha) + magnitudes[i] * alpha;
      }
      if (this.noiseUpdateFrames >= this.noiseCalibrationFrames) {
        this.noiseFloorInitialized = true;
        // Add 3dB margin to initial estimate
        for (let i = 0; i < this.halfFFT; i++) {
          this.noiseFloor[i] *= 1.4;
        }
      }
      return;
    }

    // After calibration: only update during non-speech frames
    if (!isSpeech) {
      const trackAlpha = 0.05; // Slow adaptation (~1 second time constant)
      for (let i = 0; i < this.halfFFT; i++) {
        this.noiseFloor[i] = this.noiseFloor[i] * (1 - trackAlpha) + magnitudes[i] * trackAlpha;
      }
    }
  }

  /**
   * Apply spectral subtraction with Wiener-style gain smoothing.
   * Returns the suppression gain per frequency bin.
   */
  computeSuppressionGain(magnitudes) {
    const gain = new Float32Array(this.halfFFT);
    
    for (let i = 0; i < this.halfFFT; i++) {
      const signalPower = magnitudes[i] * magnitudes[i];
      const noisePower = this.noiseFloor[i] * this.noiseFloor[i] * this.alpha;
      
      // Wiener filter gain: G = max(1 - noise/signal, beta)
      if (signalPower > 1e-10) {
        gain[i] = Math.max(this.beta, 1.0 - noisePower / signalPower);
      } else {
        gain[i] = this.beta;
      }
      
      // Temporal smoothing to prevent musical noise artifacts
      gain[i] = 0.6 * gain[i] + 0.4 * this.prevGain[i];
      this.prevGain[i] = gain[i];
    }

    return gain;
  }

  /**
   * Process one FFT frame through the noise suppression pipeline.
   */
  processFrame(frame) {
    // Apply analysis window
    for (let i = 0; i < this.fftSize; i++) {
      this.fftReal[i] = frame[i] * this.window[i];
      this.fftImag[i] = 0;
    }

    // Forward FFT
    this.fft(this.fftReal, this.fftImag, false);

    // Compute magnitudes
    const magnitudes = new Float32Array(this.halfFFT);
    const phases = new Float32Array(this.halfFFT);
    for (let i = 0; i < this.halfFFT; i++) {
      magnitudes[i] = Math.sqrt(this.fftReal[i] ** 2 + this.fftImag[i] ** 2);
      phases[i] = Math.atan2(this.fftImag[i], this.fftReal[i]);
    }

    // Compute VAD
    const vad = this.computeVAD(magnitudes);
    const isSpeech = vad > 0.4;

    // Update noise floor estimate
    this.updateNoiseFloor(magnitudes, isSpeech);

    // Compute and apply suppression gain
    const gain = this.computeSuppressionGain(magnitudes);
    
    for (let i = 0; i < this.halfFFT; i++) {
      const suppressed = magnitudes[i] * gain[i];
      this.fftReal[i] = suppressed * Math.cos(phases[i]);
      this.fftImag[i] = suppressed * Math.sin(phases[i]);
    }

    // Mirror for negative frequencies (conjugate symmetry)
    for (let i = this.halfFFT; i < this.fftSize; i++) {
      this.fftReal[i] = this.fftReal[this.fftSize - i];
      this.fftImag[i] = -this.fftImag[this.fftSize - i];
    }

    // Inverse FFT
    this.fft(this.fftReal, this.fftImag, true);

    // Apply synthesis window and return
    const output = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      output[i] = this.fftReal[i] * this.window[i];
    }

    return { output, vad };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const inChannel = input[0];
    const outChannel = output[0];

    // Feed samples into input buffer and process when we have a full frame
    for (let i = 0; i < inChannel.length; i++) {
      // Write to circular input buffer
      this.inputBuffer[this.inputWritePos] = inChannel[i];
      this.inputWritePos = (this.inputWritePos + 1) % this.fftSize;

      this.samplesUntilProcess--;

      if (this.samplesUntilProcess <= 0) {
        // Extract the current frame (properly ordered from circular buffer)
        const frame = new Float32Array(this.fftSize);
        for (let j = 0; j < this.fftSize; j++) {
          frame[j] = this.inputBuffer[(this.inputWritePos + j) % this.fftSize];
        }

        // Process through spectral subtraction
        const { output: processedFrame, vad } = this.processFrame(frame);

        // Overlap-add into output buffer
        const writeStart = this.outputReadPos + i + 1; // align with current output position
        for (let j = 0; j < this.fftSize; j++) {
          const pos = (writeStart + j) % (this.fftSize * 2);
          this.outputBuffer[pos] += processedFrame[j];
        }

        // Next frame after hopSize samples
        this.samplesUntilProcess = this.hopSize;

        // Broadcast VAD probability every few frames
        this.frameCount++;
        if (this.frameCount % 4 === 0) {
          this.port.postMessage({ vadProbability: vad });
        }
      }

      // Read from overlap-add output buffer
      const readPos = (this.outputReadPos + i) % (this.fftSize * 2);
      outChannel[i] = this.outputBuffer[readPos];
      this.outputBuffer[readPos] = 0; // Clear after reading
    }

    this.outputReadPos = (this.outputReadPos + inChannel.length) % (this.fftSize * 2);

    return true;
  }
}

registerProcessor("noise-suppressor-processor", NoiseSuppressorProcessor);
