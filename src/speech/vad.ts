/**
 * VAD - Voice Activity Detection using Silero VAD
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('VAD');

/**
 * VAD configuration
 */
export interface VADConfig {
  threshold?: number;
  minSpeechDuration?: number;
  minSilenceDuration?: number;
  sampleRate?: number;
}

/**
 * Voice Activity Detection
 */
export class VAD extends EventEmitter {
  private config: Required<VADConfig>;
  private isActive = false;
  private speechStartTime: number = 0;
  private silenceStartTime: number = 0;
  private isSpeaking = false;

  constructor(config: VADConfig = {}) {
    super();
    this.config = {
      threshold: 0.5,
      minSpeechDuration: 300, // ms
      minSilenceDuration: 500, // ms
      sampleRate: 16000,
      ...config
    };
  }

  /**
   * Start VAD
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.reset();
    logger.info('VAD started');
  }

  /**
   * Stop VAD
   */
  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.reset();
    logger.info('VAD stopped');
  }

  /**
   * Process audio chunk
   */
  processChunk(audioBuffer: Buffer): void {
    if (!this.isActive) return;

    // Calculate energy/probability
    const probability = this.calculateSpeechProbability(audioBuffer);

    const now = Date.now();
    const isSpeech = probability > this.config.threshold;

    if (isSpeech) {
      // Speech detected
      if (!this.isSpeaking) {
        // Start of speech
        this.speechStartTime = now;
      }

      // Reset silence timer
      this.silenceStartTime = 0;
    } else {
      // Silence detected
      if (this.isSpeaking) {
        // Start silence timer
        if (this.silenceStartTime === 0) {
          this.silenceStartTime = now;
        }

        // Check if silence duration exceeded
        const silenceDuration = now - this.silenceStartTime;
        if (silenceDuration >= this.config.minSilenceDuration) {
          // End of speech
          const speechDuration = now - this.speechStartTime;

          if (speechDuration >= this.config.minSpeechDuration) {
            this.emit('speech-end', {
              startTime: this.speechStartTime,
              endTime: now,
              duration: speechDuration
            });
          }

          this.isSpeaking = false;
          this.speechStartTime = 0;
          this.silenceStartTime = 0;
        }
      }
    }

    // Update speaking state
    if (!this.isSpeaking && isSpeech) {
      const duration = now - this.speechStartTime;
      if (duration >= this.config.minSpeechDuration) {
        this.isSpeaking = true;
        this.emit('speech-start', { startTime: this.speechStartTime });
      }
    }

    // Emit probability
    this.emit('probability', probability);
  }

  /**
   * Calculate speech probability using Silero VAD model
   */
  private calculateSpeechProbability(audioBuffer: Buffer): number {
    // Simplified calculation - in production, use actual Silero VAD model
    // For now, use energy-based detection

    const samples = new Int16Array(
      audioBuffer.buffer,
      audioBuffer.byteOffset,
      audioBuffer.byteLength / 2
    );

    // Calculate RMS energy
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      const normalized = samples[i] / 32768;
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / samples.length);

    // Map to 0-1 probability
    return Math.min(rms * 10, 1);
  }

  /**
   * Reset state
   */
  private reset(): void {
    this.isSpeaking = false;
    this.speechStartTime = 0;
    this.silenceStartTime = 0;
  }

  /**
   * Check if currently speaking
   */
  getSpeakingState(): boolean {
    return this.isSpeaking;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VADConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('VAD config updated', config as Error);
  }
}
