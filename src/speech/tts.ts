/**
 * TTS - Text-to-Speech engine
 */

import { spawn, ChildProcess } from 'child_process';
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const logger = createLogger('TTS');

/**
 * TTS voice configuration
 */
export interface Voice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  provider: string;
}

/**
 * TTS configuration
 */
export interface TTSConfig {
  provider?: 'edge-tts' | 'piper' | 'coqui';
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  format?: 'mp3' | 'wav' | 'opus';
}

/**
 * TTS synthesis result
 */
export interface SynthesisResult {
  audioBuffer: Buffer;
  format: string;
  duration: number;
  sampleRate: number;
}

/**
 * Text-to-Speech Engine
 */
export class TTS extends EventEmitter {
  private config: Required<TTSConfig>;
  private availableVoices: Voice[] = [];

  constructor(config: TTSConfig = {}) {
    super();
    this.config = {
      provider: 'edge-tts',
      voice: 'zh-CN-XiaoxiaoNeural',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      format: 'mp3',
      ...config
    };
  }

  /**
   * Initialize TTS
   */
  async initialize(): Promise<void> {
    logger.info('Initializing TTS');
    await this.loadVoices();
    logger.info(`Loaded ${this.availableVoices.length} voices`);
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(text: string, options?: Partial<TTSConfig>): Promise<SynthesisResult> {
    const config = { ...this.config, ...options };

    logger.info(`Synthesizing: "${text.substring(0, 50)}..."`);

    try {
      switch (config.provider) {
        case 'edge-tts':
          return await this.synthesizeEdgeTTS(text, config);
        case 'piper':
          return await this.synthesizePiper(text, config);
        case 'coqui':
          return await this.synthesizeCoqui(text, config);
        default:
          throw new Error(`Unknown TTS provider: ${config.provider}`);
      }
    } catch (error: any) {
      logger.error('Synthesis failed:', error as Error);
      throw error;
    }
  }

  /**
   * Synthesize to file
   */
  async synthesizeToFile(text: string, outputPath: string, options?: Partial<TTSConfig>): Promise<void> {
    const result = await this.synthesize(text, options);
    await writeFile(outputPath, result.audioBuffer);
    logger.info(`Audio saved to: ${outputPath}`);
  }

  /**
   * Stream synthesis
   */
  async *streamSynthesize(text: string, options?: Partial<TTSConfig>): AsyncIterable<Buffer> {
    const config = { ...this.config, ...options };

    // Split text into sentences
    const sentences = this.splitSentences(text);

    for (const sentence of sentences) {
      const result = await this.synthesize(sentence, config);
      yield result.audioBuffer;
    }
  }

  /**
   * Edge TTS synthesis
   */
  private async synthesizeEdgeTTS(text: string, config: Required<TTSConfig>): Promise<SynthesisResult> {
    return new Promise((resolve, reject) => {
      const args = [
        '-m',
        'edge_tts',
        '--text',
        text,
        '--voice',
        config.voice,
        '--rate',
        `${(config.rate - 1) * 100}%`,
        '--pitch',
        `${(config.pitch - 1) * 100}Hz`,
        '--volume',
        `${config.volume * 100}%`,
        '--write-media',
        '-',
        '--write-subtitles',
        '/dev/null'
      ];

      const process = spawn('python', args);

      const chunks: Buffer[] = [];

      process.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      process.stderr.on('data', (data) => {
        logger.error('Edge TTS error:', data.toString());
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Edge TTS failed with code ${code}`));
          return;
        }

        const audioBuffer = Buffer.concat(chunks);

        resolve({
          audioBuffer,
          format: config.format,
          duration: 0, // Calculate from audio
          sampleRate: 24000 // Edge TTS default
        });
      });

      process.on('error', reject);
    });
  }

  /**
   * Piper TTS synthesis
   */
  private async synthesizePiper(text: string, config: Required<TTSConfig>): Promise<SynthesisResult> {
    return new Promise((resolve, reject) => {
      const process = spawn('piper', [
        '--model',
        config.voice,
        '--output_raw'
      ]);

      const chunks: Buffer[] = [];

      process.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      process.stdin.write(text);
      process.stdin.end();

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Piper failed with code ${code}`));
          return;
        }

        resolve({
          audioBuffer: Buffer.concat(chunks),
          format: 'wav',
          duration: 0,
          sampleRate: 22050
        });
      });

      process.on('error', reject);
    });
  }

  /**
   * Coqui TTS synthesis
   */
  private async synthesizeCoqui(text: string, config: Required<TTSConfig>): Promise<SynthesisResult> {
    // Placeholder for Coqui TTS
    throw new Error('Coqui TTS not implemented');
  }

  /**
   * Load available voices
   */
  private async loadVoices(): Promise<void> {
    // Placeholder - load voices from provider
    this.availableVoices = [
      {
        id: 'zh-CN-XiaoxiaoNeural',
        name: 'Xiaoxiao',
        language: 'zh-CN',
        gender: 'female',
        provider: 'edge-tts'
      },
      {
        id: 'zh-CN-YunxiNeural',
        name: 'Yunxi',
        language: 'zh-CN',
        gender: 'male',
        provider: 'edge-tts'
      },
      {
        id: 'en-US-JennyNeural',
        name: 'Jenny',
        language: 'en-US',
        gender: 'female',
        provider: 'edge-tts'
      }
    ];
  }

  /**
   * Get available voices
   */
  getVoices(): Voice[] {
    return this.availableVoices;
  }

  /**
   * Split text into sentences
   */
  private splitSentences(text: string): string[] {
    return text
      .split(/[.!?。！？]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('TTS config updated', config as Error);
  }
}
