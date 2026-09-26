/**
 * Speaker Mask AudioWorklet — Pure JS Spectral Envelope Matching
 *
 * Implements Phase 2 (Target Speaker Isolation) without ONNX dependencies.
 * 
 * Pipeline: Mic → AEC → Spectral NS → [THIS] → HP/Notch/LP → Compressor → AGC → PCM
 *
 * Mechanism:
 * 1. ENROLLMENT: For the first X frames of active speech, computes the average
 *    Long-Term Average Spectrum (LTAS) of the speaker.
 * 2. MASKING: For subsequent frames, computes the cosine similarity between the
 *    current frame's smoothed spectral envelope and the enrolled LTAS.
 *    If similarity is low (indicating a different speaker or babble), the frame
 *    is heavily attenuated.
 */
class SpeakerMaskProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.fftSize = 256;
    this.halfFFT = this.fftSize / 2 + 1;
    this.hopSize = this.fftSize / 2;

    this.inputBuffer = new Float32Array(this.fftSize);
    this.inputWritePos = 0;
    this.samplesUntilProcess = this.fftSize;

    this.outputBuffer = new Float32Array(this.fftSize * 2);
    this.outputReadPos = 0;

    this.window = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      this.window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / this.fftSize));
    }

    this.fftReal = new Float32Array(this.fftSize);
    this.fftImag = new Float32Array(this.fftSize);

    // State
    this.state = "ENROLLING"; // ENROLLING, MASKING
    this.enrollmentFramesNeeded = 80; // ~400ms of actual active speech
    this.enrollmentFramesAccumulated = 0;
    
    // Profiles
    this.enrolledProfile = new Float32Array(this.halfFFT);
    this.smoothedMagnitude = new Float32Array(this.halfFFT);
    
    // Config
    this.energyThreshold = 0.001; // Minimum energy to be considered active speech
    this.simThreshold = 0.75; // Cosine similarity threshold for target speaker
    
    this.currentMaskGain = 1.0;
    this.frameCount = 0;
  }

  fft(real, imag, inverse = false) {
    const n = real.length;
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

  cosineSimilarity(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    // Skip DC and extreme highs (focus on speech band)
    for (let i = 2; i < this.halfFFT - 10; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  processFrame(frame) {
    for (let i = 0; i < this.fftSize; i++) {
      this.fftReal[i] = frame[i] * this.window[i];
      this.fftImag[i] = 0;
    }

    this.fft(this.fftReal, this.fftImag, false);

    const magnitudes = new Float32Array(this.halfFFT);
    let totalEnergy = 0;
    for (let i = 0; i < this.halfFFT; i++) {
      magnitudes[i] = Math.sqrt(this.fftReal[i] ** 2 + this.fftImag[i] ** 2);
      totalEnergy += magnitudes[i] * magnitudes[i];
      
      // Smooth magnitudes to capture envelope rather than exact harmonics
      this.smoothedMagnitude[i] = 0.5 * this.smoothedMagnitude[i] + 0.5 * magnitudes[i];
    }

    const isActiveSpeech = totalEnergy > this.energyThreshold;

    if (this.state === "ENROLLING") {
      if (isActiveSpeech) {
        for (let i = 0; i < this.halfFFT; i++) {
          this.enrolledProfile[i] += magnitudes[i];
        }
        this.enrollmentFramesAccumulated++;
        
        if (this.enrollmentFramesAccumulated >= this.enrollmentFramesNeeded) {
          this.state = "MASKING";
          this.port.postMessage({ type: "enrollment_complete" });
        }
      }
    } else if (this.state === "MASKING") {
      // Only suppress if there is energy (don't mess with silence)
      if (isActiveSpeech) {
        const sim = this.cosineSimilarity(this.smoothedMagnitude, this.enrolledProfile);
        
        // Map similarity to gain
        // sim > 0.8 -> gain 1.0 (Target speaker)
        // sim < 0.6 -> gain 0.1 (Background babble / different speaker)
        let targetGain = 1.0;
        if (sim < this.simThreshold) {
          // Attenuate non-target speakers
          targetGain = Math.max(0.1, 1.0 - ((this.simThreshold - sim) * 5.0)); 
        }

        // Smooth gain changes to avoid pumping
        this.currentMaskGain = 0.7 * this.currentMaskGain + 0.3 * targetGain;

        for (let i = 0; i < this.halfFFT; i++) {
          this.fftReal[i] *= this.currentMaskGain;
          this.fftImag[i] *= this.currentMaskGain;
        }
      } else {
        this.currentMaskGain = 1.0;
      }
    }

    for (let i = this.halfFFT; i < this.fftSize; i++) {
      this.fftReal[i] = this.fftReal[this.fftSize - i];
      this.fftImag[i] = -this.fftImag[this.fftSize - i];
    }

    this.fft(this.fftReal, this.fftImag, true);

    const output = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      output[i] = this.fftReal[i] * this.window[i];
    }

    return output;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const inChannel = input[0];
    const outChannel = output[0];

    for (let i = 0; i < inChannel.length; i++) {
      this.inputBuffer[this.inputWritePos] = inChannel[i];
      this.inputWritePos = (this.inputWritePos + 1) % this.fftSize;
      this.samplesUntilProcess--;

      if (this.samplesUntilProcess <= 0) {
        const frame = new Float32Array(this.fftSize);
        for (let j = 0; j < this.fftSize; j++) {
          frame[j] = this.inputBuffer[(this.inputWritePos + j) % this.fftSize];
        }

        const processedFrame = this.processFrame(frame);

        const writeStart = this.outputReadPos + i + 1;
        for (let j = 0; j < this.fftSize; j++) {
          const pos = (writeStart + j) % (this.fftSize * 2);
          this.outputBuffer[pos] += processedFrame[j];
        }

        this.samplesUntilProcess = this.hopSize;
        
        this.frameCount++;
        if (this.frameCount % 20 === 0) {
          this.port.postMessage({ state: this.state, maskGain: this.currentMaskGain });
        }
      }

      const readPos = (this.outputReadPos + i) % (this.fftSize * 2);
      outChannel[i] = this.outputBuffer[readPos];
      this.outputBuffer[readPos] = 0; 
    }

    this.outputReadPos = (this.outputReadPos + inChannel.length) % (this.fftSize * 2);

    return true;
  }
}

registerProcessor("speaker-mask-processor", SpeakerMaskProcessor);
