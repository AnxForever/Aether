/**
 * Marswave TTS - Text-to-Speech API
 *
 * 集成 marswave TTS API 进行语音合成
 * 支持多种语言和音色
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { writeFileSync } from 'fs';

const logger = createLogger('MarswaveTTS');

/**
 * TTS 配置
 */
export interface MarswaveTTSConfig {
  /** API Key */
  apiKey: string;
  /** API URL */
  apiUrl?: string;
  /** 默认语言 */
  language?: string;
  /** 默认音色 */
  voice?: string;
  /** 语速 (0.5-2.0) */
  speed?: number;
  /** 音调 (0.5-2.0) */
  pitch?: number;
}

/**
 * 语音合成请求
 */
export interface TTSRequest {
  /** 文本内容 */
  text: string;
  /** 语言 */
  language?: string;
  /** 音色 */
  voice?: string;
  /** 语速 */
  speed?: number;
  /** 音调 */
  pitch?: number;
  /** 输出格式 */
  format?: 'wav' | 'mp3' | 'ogg';
}

/**
 * 语音合成结果
 */
export interface TTSResult {
  /** 音频数据 */
  audio: Buffer;
  /** 格式 */
  format: string;
  /** 时长（毫秒） */
  duration: number;
  /** 文本 */
  text: string;
}

/**
 * Marswave TTS 客户端
 */
export class MarswaveTTS extends EventEmitter {
  private config: Required<MarswaveTTSConfig>;

  constructor(config: MarswaveTTSConfig) {
    super();
    this.config = {
      apiUrl: 'https://api.marswave.ai/v1/tts',
      language: 'zh-CN',
      voice: 'default',
      speed: 1.0,
      pitch: 1.0,
      ...config,
    };

    logger.info('Marswave TTS initialized');
  }

  /**
   * 文本转语音
   */
  async synthesize(request: TTSRequest): Promise<TTSResult> {
    try {
      const params = {
        text: request.text,
        language: request.language || this.config.language,
        voice: request.voice || this.config.voice,
        speed: request.speed || this.config.speed,
        pitch: request.pitch || this.config.pitch,
        format: request.format || 'wav',
      };

      logger.info(`Synthesizing text: ${params.text.substring(0, 50)}...`);

      // 调用 Marswave API
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`TTS API error: ${response.status} ${error}`);
      }

      // 获取音频数据
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      const result: TTSResult = {
        audio: audioBuffer,
        format: params.format,
        duration: this.estimateDuration(params.text, params.speed),
        text: params.text,
      };

      logger.info(`Synthesis completed: ${result.duration}ms, ${result.audio.length} bytes`);
      this.emit('synthesized', result);

      return result;
    } catch (error: any) {
      logger.error('Synthesis failed:', error as Error);
      throw error;
    }
  }

  /**
   * 合成并保存到文件
   */
  async synthesizeToFile(text: string, outputPath: string, options?: Partial<TTSRequest>): Promise<void> {
    const result = await this.synthesize({
      text,
      ...options,
    });

    writeFileSync(outputPath, result.audio);

    logger.info(`Audio saved to: ${outputPath}`);
    this.emit('saved', outputPath);
  }

  /**
   * 估算音频时长
   */
  private estimateDuration(text: string, speed: number): number {
    // 简单估算：平均每个字符 100ms，根据语速调整
    const baseMs = text.length * 100;
    return Math.floor(baseMs / speed);
  }

  /**
   * 获取可用音色列表
   */
  async getVoices(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.apiUrl}/voices`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get voices: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error: any) {
      logger.error('Failed to get voices:', error as Error);
      return [];
    }
  }

  /**
   * 设置默认参数
   */
  setDefaults(options: Partial<Omit<MarswaveTTSConfig, 'apiKey' | 'apiUrl'>>): void {
    if (options.language) this.config.language = options.language;
    if (options.voice) this.config.voice = options.voice;
    if (options.speed) this.config.speed = options.speed;
    if (options.pitch) this.config.pitch = options.pitch;

    logger.info('TTS defaults updated');
  }
}
