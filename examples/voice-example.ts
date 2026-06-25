/**
 * Voice Example
 *
 * 演示语音处理功能：ASR、VAD、TTS
 */

import { VoiceManager } from './voice-manager';
import { createLogger } from '../utils/logger';
import { readFileSync } from 'fs';

const logger = createLogger('VoiceExample');

/**
 * 示例 1：完整语音识别（ASR + VAD）
 */
export async function exampleVoiceRecognition() {
  logger.info('=== Example 1: Voice Recognition ===');

  const manager = new VoiceManager({
    asr: {
      modelPath: '/path/to/sensevoice/model',
      language: 'auto',
      enableVAD: true,
    },
    vad: {
      modelPath: '/path/to/silero/model',
      threshold: 0.5,
    },
    enableVADPreprocess: true,
  });

  try {
    // 从文件识别
    const result = await manager.recognize({
      audio: '/path/to/audio.wav',
      language: 'zh',
    });

    logger.info(`Recognition result: ${result.text}`);
    logger.info(`Language: ${result.language}`);
    logger.info(`Confidence: ${result.confidence}`);
  } catch (error: any) {
    logger.error('Recognition failed:', error);
  } finally {
    await manager.close();
  }
}

/**
 * 示例 2：VAD 检测
 */
export async function exampleVADDetection() {
  logger.info('\n=== Example 2: VAD Detection ===');

  const manager = new VoiceManager({
    vad: {
      modelPath: '/path/to/silero/model',
      threshold: 0.5,
    },
  });

  try {
    // 读取音频文件
    const audioBuffer = readFileSync('/path/to/audio.wav');

    // 检测语音活动
    const vadResults = await manager.detectVoiceActivity(audioBuffer);

    logger.info(`Detected ${vadResults.length} segments:`);
    vadResults.forEach((result, i) => {
      logger.info(`  [${i + 1}] ${result.startTime}ms - ${result.endTime}ms, ` +
                  `speech: ${result.isSpeech}, confidence: ${result.confidence}`);
    });

    // 提取语音片段
    const segments = await manager.extractSpeechSegments(audioBuffer);
    logger.info(`Extracted ${segments.length} speech segments`);
  } catch (error: any) {
    logger.error('VAD detection failed:', error);
  } finally {
    await manager.close();
  }
}

/**
 * 示例 3：文本转语音（TTS）
 */
export async function exampleTextToSpeech() {
  logger.info('\n=== Example 3: Text-to-Speech ===');

  const manager = new VoiceManager({
    tts: {
      apiKey: process.env.MARSWAVE_API_KEY || 'your-api-key',
      language: 'zh-CN',
      voice: 'female-1',
      speed: 1.0,
    },
  });

  try {
    // 合成语音
    const result = await manager.synthesize('你好，我是 Nexus Agent。', {
      language: 'zh-CN',
      voice: 'female-1',
      speed: 1.2,
      format: 'wav',
    });

    logger.info(`Synthesis completed:`);
    logger.info(`  Audio size: ${result.audio.length} bytes`);
    logger.info(`  Duration: ${result.duration}ms`);
    logger.info(`  Format: ${result.format}`);

    // 保存到文件
    await manager.synthesizeToFile(
      '这是一个测试。',
      '/tmp/tts-output.wav',
      { language: 'zh-CN', speed: 1.0 }
    );

    logger.info('Audio saved to /tmp/tts-output.wav');
  } catch (error: any) {
    logger.error('TTS failed:', error);
  } finally {
    await manager.close();
  }
}

/**
 * 示例 4：完整对话流程（STT + TTS）
 */
export async function exampleConversationFlow() {
  logger.info('\n=== Example 4: Conversation Flow ===');

  const manager = new VoiceManager({
    asr: {
      modelPath: '/path/to/sensevoice/model',
      enableVAD: true,
    },
    vad: {
      modelPath: '/path/to/silero/model',
      threshold: 0.5,
    },
    tts: {
      apiKey: process.env.MARSWAVE_API_KEY || 'your-api-key',
      language: 'zh-CN',
    },
    enableVADPreprocess: true,
  });

  try {
    // 步骤 1：识别用户语音
    logger.info('Step 1: Recognizing user input...');
    const userInput = await manager.recognize({
      audio: '/path/to/user-input.wav',
      useVAD: true,
    });

    logger.info(`User said: ${userInput.text}`);

    // 步骤 2：处理（这里简单回显）
    const response = `你说了：${userInput.text}`;

    // 步骤 3：合成回复语音
    logger.info('Step 2: Synthesizing response...');
    const ttsResult = await manager.synthesize(response, {
      language: 'zh-CN',
      speed: 1.0,
    });

    logger.info(`Response synthesized: ${ttsResult.audio.length} bytes`);

    // 保存回复语音
    await manager.synthesizeToFile(
      response,
      '/tmp/response.wav',
      { language: 'zh-CN' }
    );

    logger.info('Conversation flow completed!');
  } catch (error: any) {
    logger.error('Conversation flow failed:', error);
  } finally {
    await manager.close();
  }
}

/**
 * 示例 5：多语言识别
 */
export async function exampleMultiLanguage() {
  logger.info('\n=== Example 5: Multi-language Recognition ===');

  const manager = new VoiceManager({
    asr: {
      modelPath: '/path/to/sensevoice/model',
      language: 'auto', // 自动检测
    },
  });

  const testFiles = [
    { path: '/path/to/chinese.wav', expected: 'zh' },
    { path: '/path/to/english.wav', expected: 'en' },
    { path: '/path/to/japanese.wav', expected: 'ja' },
  ];

  try {
    for (const test of testFiles) {
      logger.info(`\nRecognizing ${test.expected}...`);

      const result = await manager.recognize({
        audio: test.path,
      });

      logger.info(`  Text: ${result.text}`);
      logger.info(`  Detected language: ${result.language}`);
      logger.info(`  Confidence: ${result.confidence}`);
    }
  } catch (error: any) {
    logger.error('Multi-language recognition failed:', error);
  } finally {
    await manager.close();
  }
}

/**
 * 运行所有示例
 */
export async function runAllVoiceExamples() {
  await exampleVoiceRecognition();
  await exampleVADDetection();
  await exampleTextToSpeech();
  await exampleConversationFlow();
  await exampleMultiLanguage();

  logger.info('\n=== All Voice examples completed ===');
}
