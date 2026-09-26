/**
 * Acoustic Echo Cancellation AudioWorklet — NLMS Adaptive Filter
 *
 * Removes the AI agent's own TTS voice that leaks back through the user's mic.
 * Fed the exact TTS PCM as the "far-end reference signal" via port.postMessage().
 *
 * Algorithm: Normalized Least Mean Squares (NLMS)
 *   - Models the echo path (speaker → room acoustics → mic) as an FIR filter
 *   - Continuously adapts the filter taps to predict what the echo looks like
 *   - Subtracts the predicted echo from the mic signal
 *   - Output = mic - predicted_echo  (residual = user speech + ambient noise)
 *
 * Why not just use VAD?
 *   VAD detects "is this speech?" — it cannot distinguish the agent's echoed
 *   voice from real user speech. Both score high on VAD. This filter uses the
 *   known reference waveform to identify and subtract only the echo component.
 *
 * Filter length: 1024 taps at 48kHz ≈ 21ms echo path coverage.
 * Latency: Zero additional (sample-by-sample processing, no buffering).
 */
class AECProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // ── Adaptive Filter Config ──
    this.filterLength = 1024;  // Taps — covers ~21ms echo path at 48kHz
    this.mu = 0.3;             // NLMS step size (0 = no adapt, 1 = aggressive)
    this.delta = 1e-6;         // Regularization to prevent division by zero
    this.leakage = 0.9999;     // Weight leakage to prevent filter divergence

    // Filter coefficients (the echo path model)
    this.w = new Float32Array(this.filterLength);

    // Far-end reference signal ring buffer
    // This holds the TTS audio that was sent to the speaker
    this.refBuffer = new Float32Array(this.filterLength);
    this.refWritePos = 0;

    // Incoming reference queue (from main thread via postMessage)
    this.refQueue = [];
    this.refQueueReadIdx = 0;

    // ERLE telemetry
    this.micPower = 0;
    this.errPower = 0;
    this.frameCount = 0;
    this.erleSmoothAlpha = 0.95;
    this.erle = 0;

    // Double-talk detection state
    // When both user and agent speak simultaneously, we should freeze adaptation
    // to avoid the filter trying to model user speech as echo
    this.dtdThreshold = 0.7;  // Ratio threshold for double-talk detection

    // Listen for far-end reference audio from the main thread
    this.port.onmessage = (e) => {
      if (e.data && e.data.reference) {
        // reference is a Float32Array of TTS audio samples
        this.refQueue.push(e.data.reference);
      }
      if (e.data && e.data.mu !== undefined) {
        this.mu = Math.max(0, Math.min(1, e.data.mu));
      }
      if (e.data && e.data.filterLength !== undefined) {
        // Allow runtime filter length adjustment
        const newLen = e.data.filterLength;
        if (newLen !== this.filterLength && newLen > 0 && newLen <= 4096) {
          const oldW = this.w;
          this.w = new Float32Array(newLen);
          this.w.set(oldW.subarray(0, Math.min(oldW.length, newLen)));
          this.refBuffer = new Float32Array(newLen);
          this.filterLength = newLen;
        }
      }
    };
  }

  /**
   * Get the next reference sample from the queue.
   * Returns 0 if no reference is available (no TTS playing).
   */
  getNextRefSample() {
    while (this.refQueue.length > 0) {
      const chunk = this.refQueue[0];
      if (this.refQueueReadIdx < chunk.length) {
        return chunk[this.refQueueReadIdx++];
      }
      // Finished this chunk, move to next
      this.refQueue.shift();
      this.refQueueReadIdx = 0;
    }
    return 0; // No reference audio — agent isn't speaking
  }

  /**
   * Detect double-talk condition.
   * If the mic signal has high energy that doesn't correlate with the reference,
   * it's likely the user speaking over the agent. Freeze adaptation.
   */
  isDoubleTalk(micSample, errSample, refPower) {
    if (refPower < 1e-8) return false; // No reference = can't have double-talk
    const errPower = errSample * errSample;
    const micPower = micSample * micSample;
    // If error is much larger than predicted echo, user is probably talking too
    return micPower > 0 && (errPower / (micPower + 1e-10)) > this.dtdThreshold;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const mic = input[0];      // Near-end signal (mic with possible echo)
    const out = output[0];     // Echo-cancelled output

    let frameMicPower = 0;
    let frameErrPower = 0;

    for (let i = 0; i < mic.length; i++) {
      const micSample = mic[i];
      const refSample = this.getNextRefSample();

      // Write reference sample into the ring buffer
      this.refBuffer[this.refWritePos] = refSample;

      // ── Compute predicted echo ──
      // y_hat = w^T * x  (convolution of filter with reference buffer)
      let predicted = 0;
      for (let j = 0; j < this.filterLength; j++) {
        const refIdx = (this.refWritePos - j + this.filterLength) % this.filterLength;
        predicted += this.w[j] * this.refBuffer[refIdx];
      }

      // ── Compute error (residual = mic - predicted echo) ──
      const error = micSample - predicted;

      // ── Compute reference signal power for NLMS normalization ──
      let refPower = 0;
      for (let j = 0; j < this.filterLength; j++) {
        const refIdx = (this.refWritePos - j + this.filterLength) % this.filterLength;
        refPower += this.refBuffer[refIdx] * this.refBuffer[refIdx];
      }

      // ── Double-talk detection ──
      const dtd = this.isDoubleTalk(micSample, error, refPower);

      // ── NLMS filter update ──
      // Only adapt when there's reference energy AND no double-talk
      if (refPower > 1e-8 && !dtd) {
        const stepSize = this.mu / (refPower + this.delta);
        for (let j = 0; j < this.filterLength; j++) {
          const refIdx = (this.refWritePos - j + this.filterLength) % this.filterLength;
          // Update with leakage to prevent divergence
          this.w[j] = this.leakage * this.w[j] + stepSize * error * this.refBuffer[refIdx];
        }
      }

      // Output the echo-cancelled signal
      out[i] = error;

      // Advance ring buffer write position
      this.refWritePos = (this.refWritePos + 1) % this.filterLength;

      // Accumulate power for ERLE
      frameMicPower += micSample * micSample;
      frameErrPower += error * error;
    }

    // ── ERLE Telemetry ──
    // ERLE = 10 * log10(micPower / errPower)
    // Higher = more echo removed
    this.micPower = this.erleSmoothAlpha * this.micPower + (1 - this.erleSmoothAlpha) * frameMicPower;
    this.errPower = this.erleSmoothAlpha * this.errPower + (1 - this.erleSmoothAlpha) * frameErrPower;

    if (this.micPower > 1e-10 && this.errPower > 1e-10) {
      this.erle = 10 * Math.log10(this.micPower / this.errPower);
    }

    // Broadcast ERLE every ~100ms (every 4-5 frames at 128-sample blocks)
    this.frameCount++;
    if (this.frameCount % 5 === 0) {
      this.port.postMessage({
        erle: this.erle,
        refActive: this.refQueue.length > 0 || frameMicPower > 1e-8,
      });
    }

    return true;
  }
}

registerProcessor("aec-processor", AECProcessor);
