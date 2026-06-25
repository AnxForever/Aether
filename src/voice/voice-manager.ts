/**
 * Voice Manager - 语音处理统一管理器
 *
 * 整合 ASR、VAD、TTS 功能
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { SherpaASR, type SherpaASRConfig, type ASRResult } from './sherpa-asr';
import { SileroVAD, type SileroVADConfig, type VADResult, type SpeechSegment } from './silero-vad';
import { MarswaveTTS, type MarswaveTTSConfig, type TTSResult } from './marswave-tts';

const logger = createLogger('VoiceManager');

/**
 * 语音管理器配置
 */
export interface VoiceManagerConfig {
  /** ASR 配置 */
  asr?: SherpaASRConfig;
  /** VAD 配置 */
  vad?: SileroVADConfig;
  /** TTS 配置 */
  tts?: MarswaveTTSConfig;
  /** 是否启用 VAD 预处理 */
  enableVADPreprocess?: boolean;
}

/**
 * 语音识别请求
 */
export interface VoiceRecognitionRequest {
  /** 音频数据或文件路径 */
  audio: Buffer | string;
  /** 语言 */
  language?: string;
  /** 是否使用 VAD 预处理 */
  useVAD?: boolean;
}

/**
 * 语音管理器
 */
export class VoiceManager extends EventEmitter {
  private asr?: SherpaASR;
  private vad?: SileroVAD;
  private tts?: MarswaveTTS;
  private config: VoiceManagerConfig;

  constructor(config: VoiceManagerConfig) {
    super();
    this.config = config;

    // 初始化 ASR
    if (config.asr) {
      this.asr = new SherpaASR(config.asr);
      this.asr.on('result', (result) => this.emit('asr-result', result));
    }

    // 初始化 VAD
    if (config.vad) {
      this.vad = new SileroVAD(config.vad);
      this.vad.on('detected', (results) => this.emit('vad-detected', results));
    }

    // 初始化 TTS
    if (config.tts) {
      this.tts = new MarswaveTTS(config.tts);
      this.tts.on('synthesized', (result) => this.emit('tts-synthesized', result));
    }

    logger.info('Voice Manager initialized');
  }

  /**
   * 语音识别（带 VAD 预处理）
   */
  async recognize(request: VoiceRecognitionRequest): Promise<ASRResult> {
    if (!this.asr) {
      throw new Error('ASR not configured');
    }

    try {
      const useVAD = request.useVAD ?? this.config.enableVADPreprocess ?? false;

      // 设置语言
      if (request.language) {
        this.asr.setLanguage(request.language);
      }

      // 文件路径
      if (typeof request.audio === 'string') {
        return await this.asr.recognizeFile(request.audio);
      }

      // Buffer 数据
      if (useVAD && this.vad) {
        logger.info('Preprocessing with VAD');

        // VAD 提取语音片段
        const segments = await this.vad.extractSpeechSegments(request.audio);

        if (segments.length === 0) {
          logger.warn('No speech detected');
          return {
            text: '',
            language: request.language || 'auto',
            confidence: 0,
            timestamp: Date.now(),
          };
        }

        // 识别第一个语音片段
        const firstSegment = segments[0];
        return await this.asr.recognizeStream(firstSegment.audio);
      } else {
        // 直接识别
        return await this.asr.recognizeStream(request.audio);
      }
    } catch (error: any) {
      logger.error('Recognition failed:', error as Error);
      throw error;
    }
  }

  /**
   * 语音合成
   */
  async synthesize(text: string, options?: {
    language?: string;
    voice?: string;
    speed?: number;
    pitch?: number;
    format?: 'wav' | 'mp3' | 'ogg';
  }): Promise<TTSResult> {
    if (!this.tts) {
      throw new Error('TTS not configured');
    }

    return await this.tts.synthesize({
      text,
      ...options,
    });
  }

  /**
   * 语音合成并保存
   */
  async synthesizeToFile(text: string, outputPath: string, options?: {
    language?: string;
    voice?: string;
    speed?: number;
    format?: 'wav' | 'mp3' | 'ogg';
  }): Promise<void> {
    if (!this.tts) {
      throw new Error('TTS not configured');
    }

    await this.tts.synthesizeToFile(text, outputPath, options);
  }

  /**
   * VAD 检测
   */
  async detectVoiceActivity(audioBuffer: Buffer): Promise<VADResult[]> {
    if (!this.vad) {
      throw new Error('VAD not configured');
    }

    return await this.vad.detect(audioBuffer);
  }

  /**
   * 提取语音片段
   */
  async extractSpeechSegments(audioBuffer: Buffer): Promise<SpeechSegment[]> {
    if (!this.vad) {
      throw new Error('VAD not configured');
    }

    return await this.vad.extractSpeechSegments(audioBuffer);
  }

  /**
   * 获取可用音色
   */
  async getAvailableVoices(): Promise<string[]> {
    if (!this.tts) {
      throw new Error('TTS not configured');
    }

    return await this.tts.getVoices();
  }

  /**
   * 设置 VAD 阈值
   */
  setVADThreshold(threshold: number): void {
    if (!this.vad) {
      throw new Error('VAD not configured');
    }

    this.vad.setThreshold(threshold);
  }

  /**
   * 设置 TTS 默认参数
   */
  setTTSDefaults(options: {
    language?: string;
    voice?: string;
    speed?: number;
    pitch?: number;
  }): void {
    if (!this.tts) {
      throw new Error('TTS not configured');
    }

    this.tts.setDefaults(options);
  }

  /**
   * 关闭语音管理器
   */
  async close(): Promise<void> {
    logger.info('Closing Voice Manager');

    if (this.asr) {
      await this.asr.close();
    }

    if (this.vad) {
      await this.vad.close();
    }

    logger.info('Voice Manager closed');
    this.emit('closed');
  }
}
