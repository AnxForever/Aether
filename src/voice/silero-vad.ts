/**
 * Silero VAD - Voice Activity Detection
 *
 * 使用 Silero VAD 模型检测语音活动
 * 用于过滤静音片段，提升 ASR 效率
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';

const logger = createLogger('SileroVAD');

/**
 * VAD 配置
 */
export interface SileroVADConfig {
  /** 模型路径 */
  modelPath: string;
  /** 采样率 */
  sampleRate?: number;
  /** 语音阈值 (0-1) */
  threshold?: number;
  /** 最小语音持续时间（毫秒） */
  minSpeechDuration?: number;
  /** 最小静音持续时间（毫秒） */
  minSilenceDuration?: number;
}

/**
 * VAD 结果
 */
export interface VADResult {
  /** 是否检测到语音 */
  isSpeech: boolean;
  /** 置信度 */
  confidence: number;
  /** 开始时间（毫秒） */
  startTime: number;
  /** 结束时间（毫秒） */
  endTime: number;
}

/**
 * 语音片段
 */
export interface SpeechSegment {
  /** 音频数据 */
  audio: Buffer;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
}

/**
 * Silero VAD 引擎
 */
export class SileroVAD extends EventEmitter {
  private config: Required<SileroVADConfig>;
  private initialized: boolean = false;
  private vad?: any;

  constructor(config: SileroVADConfig) {
    super();
    this.config = {
      sampleRate: 16000,
      threshold: 0.5,
      minSpeechDuration: 250,
      minSilenceDuration: 100,
      ...config,
    };
  }

  /**
   * 初始化 VAD 引擎
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('VAD already initialized');
      return;
    }

    try {
      logger.info('Initializing Silero VAD');

      // 动态加载 @silero/vad
      // Note: @silero/vad 需要通过 npm 安装
      // const { VoiceActivityDetector } = require('@silero/vad');

      // 创建 VAD 实例
      // this.vad = new VoiceActivityDetector({
      //   modelPath: this.config.modelPath,
      //   sampleRate: this.config.sampleRate,
      //   threshold: this.config.threshold,
      // });

      this.initialized = true;

      logger.info('Silero VAD initialized');
      this.emit('initialized');
    } catch (error: any) {
      logger.error('Failed to initialize VAD:', error as Error);
      throw error;
    }
  }

  /**
   * 检测音频中的语音活动
   */
  async detect(audioBuffer: Buffer): Promise<VADResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.debug(`Detecting speech in ${audioBuffer.length} bytes`);

      // TODO: 实际检测
      // const results = this.vad.detect(audioBuffer);

      // Mock 结果
      const results: VADResult[] = [
        {
          isSpeech: true,
          confidence: 0.92,
          startTime: 100,
          endTime: 2500,
        },
      ];

      logger.debug(`Detected ${results.length} speech segments`);
      this.emit('detected', results);

      return results;
    } catch (error: any) {
      logger.error('Detection failed:', error as Error);
      throw error;
    }
  }

  /**
   * 提取语音片段
   */
  async extractSpeechSegments(audioBuffer: Buffer): Promise<SpeechSegment[]> {
    const vadResults = await this.detect(audioBuffer);

    const segments: SpeechSegment[] = [];

    for (const result of vadResults) {
      if (!result.isSpeech) {
        continue;
      }

      // 计算字节偏移
      const bytesPerMs = (this.config.sampleRate * 2) / 1000; // 16-bit PCM
      const startByte = Math.floor(result.startTime * bytesPerMs);
      const endByte = Math.floor(result.endTime * bytesPerMs);

      // 提取片段
      const segmentAudio = audioBuffer.slice(startByte, endByte);

      segments.push({
        audio: segmentAudio,
        startTime: result.startTime,
        endTime: result.endTime,
      });
    }

    logger.info(`Extracted ${segments.length} speech segments`);
    this.emit('segments-extracted', segments);

    return segments;
  }

  /**
   * 设置阈值
   */
  setThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }

    this.config.threshold = threshold;
    logger.info(`VAD threshold set to: ${threshold}`);
  }

  /**
   * 关闭 VAD 引擎
   */
  async close(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info('Closing Silero VAD');

    // TODO: 实际清理
    // if (this.vad) {
    //   this.vad.close();
    //   this.vad = undefined;
    // }

    this.initialized = false;

    logger.info('Silero VAD closed');
    this.emit('closed');
  }
}
