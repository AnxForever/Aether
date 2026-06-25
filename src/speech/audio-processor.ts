/**
 * Audio Processor - Audio utilities and processing
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('AudioProcessor');

/**
 * Audio format
 */
export interface AudioFormat {
  sampleRate: number;
  channels: number;
  bitDepth: 16 | 24 | 32;
  encoding: 'pcm' | 'float';
}

/**
 * Audio Processor
 */
export class AudioProcessor {
  /**
   * Resample audio
   */
  static resample(
    input: Buffer,
    fromRate: number,
    toRate: number,
    channels: number = 1
  ): Buffer {
    if (fromRate === toRate) return input;

    const ratio = toRate / fromRate;
    const inputSamples = new Int16Array(
      input.buffer,
      input.byteOffset,
      input.byteLength / 2
    );

    const outputLength = Math.floor(inputSamples.length * ratio);
    const outputSamples = new Int16Array(outputLength);

    // Simple linear interpolation
    for (let i = 0; i < outputLength; i++) {
      const srcPos = i / ratio;
      const srcIndex = Math.floor(srcPos);
      const frac = srcPos - srcIndex;

      if (srcIndex + 1 < inputSamples.length) {
        const sample1 = inputSamples[srcIndex];
        const sample2 = inputSamples[srcIndex + 1];
        outputSamples[i] = Math.round(sample1 + (sample2 - sample1) * frac);
      } else {
        outputSamples[i] = inputSamples[srcIndex];
      }
    }

    return Buffer.from(outputSamples.buffer);
  }

  /**
   * Convert stereo to mono
   */
  static stereoToMono(input: Buffer): Buffer {
    const inputSamples = new Int16Array(
      input.buffer,
      input.byteOffset,
      input.byteLength / 2
    );

    const outputLength = inputSamples.length / 2;
    const outputSamples = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const left = inputSamples[i * 2];
      const right = inputSamples[i * 2 + 1];
      outputSamples[i] = Math.round((left + right) / 2);
    }

    return Buffer.from(outputSamples.buffer);
  }

  /**
   * Normalize audio levels
   */
  static normalize(input: Buffer, targetLevel: number = 0.8): Buffer {
    const samples = new Int16Array(
      input.buffer,
      input.byteOffset,
      input.byteLength / 2
    );

    // Find peak
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peak) peak = abs;
    }

    if (peak === 0) return input;

    // Calculate gain
    const gain = (32767 * targetLevel) / peak;

    // Apply gain
    const output = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      output[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * gain)));
    }

    return Buffer.from(output.buffer);
  }

  /**
   * Apply fade in/out
   */
  static applyFade(
    input: Buffer,
    fadeInMs: number,
    fadeOutMs: number,
    sampleRate: number
  ): Buffer {
    const samples = new Int16Array(
      input.buffer,
      input.byteOffset,
      input.byteLength / 2
    );

    const fadeInSamples = Math.floor((fadeInMs / 1000) * sampleRate);
    const fadeOutSamples = Math.floor((fadeOutMs / 1000) * sampleRate);

    const output = new Int16Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      let gain = 1.0;

      // Fade in
      if (i < fadeInSamples) {
        gain = i / fadeInSamples;
      }

      // Fade out
      if (i >= samples.length - fadeOutSamples) {
        const remaining = samples.length - i;
        gain = remaining / fadeOutSamples;
      }

      output[i] = Math.round(samples[i] * gain);
    }

    return Buffer.from(output.buffer);
  }

  /**
   * Detect silence
   */
  static detectSilence(
    input: Buffer,
    threshold: number = 0.01,
    minDuration: number = 500,
    sampleRate: number = 16000
  ): Array<{ start: number; end: number }> {
    const samples = new Int16Array(
      input.buffer,
      input.byteOffset,
      input.byteLength / 2
    );

    const silenceRegions: Array<{ start: number; end: number }> = [];
    let silenceStart: number | null = null;
    const thresholdValue = 32767 * threshold;
    const minSamples = Math.floor((minDuration / 1000) * sampleRate);

    for (let i = 0; i < samples.length; i++) {
      const isSilence = Math.abs(samples[i]) < thresholdValue;

      if (isSilence && silenceStart === null) {
        silenceStart = i;
      } else if (!isSilence && silenceStart !== null) {
        const duration = i - silenceStart;
        if (duration >= minSamples) {
          silenceRegions.push({
            start: (silenceStart / sampleRate) * 1000,
            end: (i / sampleRate) * 1000
          });
        }
        silenceStart = null;
      }
    }

    // Handle trailing silence
    if (silenceStart !== null) {
      const duration = samples.length - silenceStart;
      if (duration >= minSamples) {
        silenceRegions.push({
          start: (silenceStart / sampleRate) * 1000,
          end: (samples.length / sampleRate) * 1000
        });
      }
    }

    return silenceRegions;
  }

  /**
   * Trim silence from start/end
   */
  static trimSilence(
    input: Buffer,
    threshold: number = 0.01,
    sampleRate: number = 16000
  ): Buffer {
    const samples = new Int16Array(
      input.buffer,
      input.byteOffset,
      input.byteLength / 2
    );

    const thresholdValue = 32767 * threshold;

    // Find start
    let start = 0;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) >= thresholdValue) {
        start = i;
        break;
      }
    }

    // Find end
    let end = samples.length - 1;
    for (let i = samples.length - 1; i >= 0; i--) {
      if (Math.abs(samples[i]) >= thresholdValue) {
        end = i;
        break;
      }
    }

    if (start >= end) {
      return Buffer.alloc(0);
    }

    const trimmed = samples.slice(start, end + 1);
    return Buffer.from(trimmed.buffer);
  }

  /**
   * Calculate RMS energy
   */
  static calculateRMS(input: Buffer): number {
    const samples = new Int16Array(
      input.buffer,
      input.byteOffset,
      input.byteLength / 2
    );

    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      const normalized = samples[i] / 32768;
      sumSquares += normalized * normalized;
    }

    return Math.sqrt(sumSquares / samples.length);
  }

  /**
   * Get audio duration
   */
  static getDuration(bufferSize: number, sampleRate: number, channels: number = 1): number {
    const samples = bufferSize / 2 / channels; // 16-bit = 2 bytes
    return (samples / sampleRate) * 1000; // ms
  }
}
