/**
 * Automatic Gain Control (AGC) AudioWorklet — Target Loudness Normalization
 *
 * Ensures consistent speech loudness regardless of caller mic distance, device
 * gain, or room acoustics. Without AGC, a user holding their phone far from
 * their mouth produces much quieter PCM than someone speaking directly into it,
 * degrading STT confidence independent of noise.
 *
 * Algorithm: Sliding-window RMS measurement + smoothed gain adjustment
 *   - Measures short-term loudness over a 400ms sliding window
 *   - Computes the gain needed to bring speech toward the target level
 *   - Applies gain with attack/release smoothing to avoid audible pumping
 *   - Gain limits prevent amplifying silence/noise or clipping loud speakers
 *
 * Target: -23 LUFS equivalent (≈ 0.07 RMS for normalized float audio)
 * Gain range: 0.5× – 4.0×
 * Latency: Zero additional (sample-by-sample gain application)
 */
class AGCProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Target RMS level (approximates -23 LUFS for speech)
    this.targetRMS = 0.07;

    // Gain limits
    this.minGain = 0.5;   // Don't attenuate more than -6dB
    this.maxGain = 4.0;   // Don't amplify more than +12dB

    // Current applied gain (starts at unity)
    this.currentGain = 1.0;

    // Smoothing: attack (gain increase) is slower than release (gain decrease)
    // to avoid pumping artifacts on transients
    this.attackAlpha = 0.005;   // Slow gain increase (~200ms time constant)
    this.releaseAlpha = 0.05;   // Faster gain decrease (~20ms time constant)

    // RMS measurement window
    this.windowSize = Math.floor(sampleRate * 0.4); // 400ms
    this.rmsBuffer = new Float32Array(this.windowSize);
    this.rmsWritePos = 0;
    this.rmsSum = 0;
    this.samplesFilled = 0;

    // Gate: don't adjust gain during silence (avoids amplifying noise floor)
    this.silenceThreshold = 0.003;  // RMS below this = silence
    this.holdGainDuringsilence = true;

    // Telemetry
    this.frameCount = 0;

    // Allow runtime config from main thread
    this.port.onmessage = (e) => {
      if (e.data.targetRMS !== undefined) this.targetRMS = e.data.targetRMS;
      if (e.data.minGain !== undefined) this.minGain = e.data.minGain;
      if (e.data.maxGain !== undefined) this.maxGain = e.data.maxGain;
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const inCh = input[0];
    const outCh = output[0];

    for (let i = 0; i < inCh.length; i++) {
      const sample = inCh[i];
      const sampleSq = sample * sample;

      // Update sliding window RMS
      const oldSampleSq = this.rmsBuffer[this.rmsWritePos] * this.rmsBuffer[this.rmsWritePos];
      this.rmsBuffer[this.rmsWritePos] = sample;
      this.rmsWritePos = (this.rmsWritePos + 1) % this.windowSize;

      if (this.samplesFilled < this.windowSize) {
        this.samplesFilled++;
        this.rmsSum += sampleSq;
      } else {
        this.rmsSum = this.rmsSum - oldSampleSq + sampleSq;
      }

      // Compute current RMS
      const currentRMS = Math.sqrt(this.rmsSum / Math.max(1, this.samplesFilled));

      // Compute desired gain
      if (currentRMS > this.silenceThreshold) {
        const desiredGain = Math.min(this.maxGain, Math.max(this.minGain,
          this.targetRMS / (currentRMS + 1e-10)
        ));

        // Smooth gain change (asymmetric attack/release)
        const alpha = desiredGain > this.currentGain ? this.attackAlpha : this.releaseAlpha;
        this.currentGain = this.currentGain + alpha * (desiredGain - this.currentGain);
      }
      // During silence: hold current gain (don't chase noise floor down)

      // Apply gain with soft clipping
      let amplified = sample * this.currentGain;
      // Soft clip at ±0.95 to prevent hard digital clipping
      if (amplified > 0.95) {
        amplified = 0.95 + (amplified - 0.95) * 0.1;
      } else if (amplified < -0.95) {
        amplified = -0.95 + (amplified + 0.95) * 0.1;
      }
      amplified = Math.max(-1.0, Math.min(1.0, amplified));

      outCh[i] = amplified;
    }

    // Broadcast gain telemetry periodically
    this.frameCount++;
    if (this.frameCount % 8 === 0) {
      this.port.postMessage({
        gain: this.currentGain,
        rms: Math.sqrt(this.rmsSum / Math.max(1, this.samplesFilled)),
      });
    }

    return true;
  }
}

registerProcessor("agc-processor", AGCProcessor);
