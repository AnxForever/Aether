/**
 * Speech Recognition - SenseVoice integration
 */

import { spawn, ChildProcess } from 'child_process';
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('SpeechRecognition');

/**
 * Recognition result
 */
export interface RecognitionResult {
  text: string;
  confidence: number;
  language?: string;
  duration?: number;
}

/**
 * SenseVoice config
 */
export interface SenseVoiceConfig {
  modelPath: string;
  language?: 'auto' | 'zh' | 'en' | 'ja' | 'ko';
  sampleRate?: number;
  channels?: number;
}

/**
 * Speech Recognition using SenseVoice
 */
export class SpeechRecognition extends EventEmitter {
  private config: Required<SenseVoiceConfig>;
  private process: ChildProcess | null = null;
  private isRunning = false;

  constructor(config: SenseVoiceConfig) {
    super();
    this.config = {
      language: 'auto',
      sampleRate: 16000,
      channels: 1,
      ...config
    };
  }

  /**
   * Start recognition
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Recognition already running');
    }

    logger.info('Starting SenseVoice recognition');

    try {
      // Spawn SenseVoice process
      this.process = spawn('python', [
        '-m',
        'sensevoice',
        '--model',
        this.config.modelPath,
        '--language',
        this.config.language,
        '--sample-rate',
        this.config.sampleRate.toString(),
        '--channels',
        this.config.channels.toString(),
        '--stream'
      ]);

      this.setupProcessHandlers();
      this.isRunning = true;

      logger.info('SenseVoice started');
    } catch (error: any) {
      logger.error('Failed to start recognition:', error as Error);
      throw error;
    }
  }

  /**
   * Stop recognition
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('Stopping recognition');

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.isRunning = false;
    logger.info('Recognition stopped');
  }

  /**
   * Process audio buffer
   */
  async processAudio(audioBuffer: Buffer): Promise<RecognitionResult> {
    if (!this.isRunning) {
      throw new Error('Recognition not running');
    }

    return new Promise((resolve, reject) => {
      if (!this.process) {
        reject(new Error('Process not initialized'));
        return;
      }

      // Send audio data
      this.process.stdin?.write(audioBuffer);

      // Wait for result
      const timeout = setTimeout(() => {
        reject(new Error('Recognition timeout'));
      }, 30000);

      this.once('result', (result: RecognitionResult) => {
        clearTimeout(timeout);
        resolve(result);
      });

      this.once('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Process audio file
   */
  async processFile(filePath: string): Promise<RecognitionResult> {
    logger.info(`Processing audio file: ${filePath}`);

    return new Promise((resolve, reject) => {
      const process = spawn('python', [
        '-m',
        'sensevoice',
        '--model',
        this.config.modelPath,
        '--language',
        this.config.language,
        '--file',
        filePath
      ]);

      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        logger.error('SenseVoice error:', data.toString());
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Recognition failed with code ${code}`));
          return;
        }

        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (error) {
          reject(new Error('Failed to parse recognition result'));
        }
      });
    });
  }

  /**
   * Setup process handlers
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.stdout?.on('data', (data) => {
      try {
        const result: RecognitionResult = JSON.parse(data.toString());
        this.emit('result', result);
        this.emit('transcript', result.text);
      } catch (error) {
        logger.error('Failed to parse recognition output:', error as Error);
      }
    });

    this.process.stderr?.on('data', (data) => {
      logger.error('Recognition error:', data.toString());
      this.emit('error', new Error(data.toString()));
    });

    this.process.on('error', (error) => {
      logger.error('Process error:', error as Error);
      this.emit('error', error);
    });

    this.process.on('close', (code) => {
      logger.info(`Recognition process exited with code ${code}`);
      this.isRunning = false;
      this.emit('close', code);
    });
  }

  /**
   * Check if recognition is running
   */
  getStatus(): boolean {
    return this.isRunning;
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): string[] {
    return ['auto', 'zh', 'en', 'ja', 'ko', 'yue', 'th'];
  }
}
