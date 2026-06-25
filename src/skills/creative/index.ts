/**
 * Creative Skill
 *
 * Image generation, text-to-speech, and speech-to-text capabilities
 */

import { BaseSkill } from '../base-skill';
import type { Tool, ToolResult } from '../../types';
import type { SkillContext } from '../types';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CreativeSkill');

export class CreativeSkill extends BaseSkill {
  constructor() {
    super({
      id: 'creative',
      name: 'Creative Tools',
      description: 'Image generation, text-to-speech, and speech-to-text capabilities',
      version: '1.0.0',
      author: 'Aether Team',
      enabled: true,
      requiresAuth: true,
      dependencies: ['openai', '@google/generative-ai'],
    });

    logger.warn('CreativeSkill: OpenAI API key required for DALL-E and TTS operations. Set OPENAI_API_KEY env var.');
  }

  getTools(): Tool[] {
    return [
      {
        name: 'image_generate',
        description: 'Generate an image from a text prompt using AI',
        parameters: [
          {
            name: 'prompt',
            type: 'string',
            description: 'Text description of the image to generate',
            required: true,
          },
          {
            name: 'size',
            type: 'string',
            description: 'Image size: 256x256, 512x512, 1024x1024, 1792x1024, or 1024x1792',
            required: false,
          },
          {
            name: 'model',
            type: 'string',
            description: 'Model to use: dall-e-2 or dall-e-3',
            required: false,
          },
          {
            name: 'outputPath',
            type: 'string',
            description: 'Local path to save the generated image',
            required: false,
          },
        ],
        handler: async (params) => this.generateImage(params),
      },
      {
        name: 'image_edit',
        description: 'Edit an existing image using AI with a text prompt',
        parameters: [
          {
            name: 'imagePath',
            type: 'string',
            description: 'Path to the source image',
            required: true,
          },
          {
            name: 'prompt',
            type: 'string',
            description: 'Text description of the desired edits',
            required: true,
          },
          {
            name: 'maskPath',
            type: 'string',
            description: 'Path to mask image (transparent areas will be edited)',
            required: false,
          },
          {
            name: 'outputPath',
            type: 'string',
            description: 'Local path to save the edited image',
            required: false,
          },
        ],
        handler: async (params) => this.editImage(params),
      },
      {
        name: 'image_variation',
        description: 'Create variations of an existing image',
        parameters: [
          {
            name: 'imagePath',
            type: 'string',
            description: 'Path to the source image',
            required: true,
          },
          {
            name: 'count',
            type: 'number',
            description: 'Number of variations to generate (1-10)',
            required: false,
          },
          {
            name: 'outputDir',
            type: 'string',
            description: 'Directory to save generated variations',
            required: false,
          },
        ],
        handler: async (params) => this.createImageVariation(params),
      },
      {
        name: 'text_to_speech',
        description: 'Convert text to speech audio',
        parameters: [
          {
            name: 'text',
            type: 'string',
            description: 'Text content to convert to speech',
            required: true,
          },
          {
            name: 'voice',
            type: 'string',
            description: 'Voice to use: alloy, echo, fable, onyx, nova, or shimmer',
            required: false,
          },
          {
            name: 'model',
            type: 'string',
            description: 'TTS model: tts-1 or tts-1-hd',
            required: false,
          },
          {
            name: 'speed',
            type: 'number',
            description: 'Speech speed (0.25 to 4.0)',
            required: false,
          },
          {
            name: 'outputPath',
            type: 'string',
            description: 'Local path to save the audio file',
            required: true,
          },
        ],
        handler: async (params) => this.textToSpeech(params),
      },
      {
        name: 'speech_to_text',
        description: 'Convert speech audio to text (transcription)',
        parameters: [
          {
            name: 'audioPath',
            type: 'string',
            description: 'Path to the audio file',
            required: true,
          },
          {
            name: 'language',
            type: 'string',
            description: 'Language code (e.g., en, es, fr)',
            required: false,
          },
          {
            name: 'model',
            type: 'string',
            description: 'Whisper model: whisper-1',
            required: false,
          },
          {
            name: 'prompt',
            type: 'string',
            description: 'Optional prompt to guide transcription style',
            required: false,
          },
        ],
        handler: async (params) => this.speechToText(params),
      },
      {
        name: 'audio_translate',
        description: 'Translate audio from any language to English',
        parameters: [
          {
            name: 'audioPath',
            type: 'string',
            description: 'Path to the audio file',
            required: true,
          },
          {
            name: 'model',
            type: 'string',
            description: 'Whisper model: whisper-1',
            required: false,
          },
        ],
        handler: async (params) => this.translateAudio(params),
      },
    ];
  }

  async isConfigured(context: SkillContext): Promise<boolean> {
    // Check if OpenAI API key is available
    return !!(context.env.OPENAI_API_KEY);
  }

  private async generateImage(params: unknown): Promise<ToolResult> {
    try {
      const {
        prompt,
        size = '1024x1024',
        model = 'dall-e-3',
        outputPath,
      } = params as {
        prompt: string;
        size?: string;
        model?: string;
        outputPath?: string;
      };

      if (!prompt) {
        return this.createError('prompt is required');
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return this.createError('OPENAI_API_KEY not configured');
      }

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, prompt, n: 1, size, response_format: 'url' }),
      });

      if (!response.ok) {
        const err = await response.text();
        return this.createError(`DALL-E API error (${response.status}): ${err}`);
      }

      const data = (await response.json()) as any;
      const imageUrl = data.data?.[0]?.url;
      if (!imageUrl) {
        return this.createError('No image URL in DALL-E response');
      }

      const result: { url: string; filePath?: string } = { url: imageUrl };

      if (outputPath) {
        const imageResponse = await fetch(imageUrl);
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        await writeFile(outputPath, buffer);
        result.filePath = outputPath;
      }

      return this.createSuccess(result, {
        prompt: prompt.substring(0, 50),
        size,
        model,
      });
    } catch (error) {
      return this.handleError(error, 'Image generation');
    }
  }

  private async editImage(params: unknown): Promise<ToolResult> {
    try {
      const { imagePath, prompt, maskPath, outputPath } = params as {
        imagePath: string;
        prompt: string;
        maskPath?: string;
        outputPath?: string;
      };

      if (!imagePath || !prompt) {
        return this.createError('imagePath and prompt are required');
      }

      if (!existsSync(imagePath)) {
        return this.createError(`Image file not found: ${imagePath}`);
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return this.createError('OPENAI_API_KEY not configured');
      }

      // Build multipart form data for image edit
      const imageBuffer = await readFile(imagePath);
      const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

      const formData = new FormData();
      formData.append('image', imageBlob, 'image.png');
      formData.append('prompt', prompt);
      formData.append('n', '1');
      formData.append('size', '1024x1024');
      formData.append('response_format', 'url');

      if (maskPath) {
        if (!existsSync(maskPath)) {
          return this.createError(`Mask file not found: ${maskPath}`);
        }
        const maskBuffer = await readFile(maskPath);
        const maskBlob = new Blob([maskBuffer], { type: 'image/png' });
        formData.append('mask', maskBlob, 'mask.png');
      }

      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.text();
        return this.createError(`DALL-E edit API error (${response.status}): ${err}`);
      }

      const data = (await response.json()) as any;
      const imageUrl = data.data?.[0]?.url;
      if (!imageUrl) {
        return this.createError('No image URL in DALL-E edit response');
      }

      const result: { url: string; filePath?: string } = { url: imageUrl };

      if (outputPath) {
        const imageResponse = await fetch(imageUrl);
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        await writeFile(outputPath, buffer);
        result.filePath = outputPath;
      }

      return this.createSuccess(result, {
        prompt: prompt.substring(0, 50),
        hasMask: !!maskPath,
      });
    } catch (error) {
      return this.handleError(error, 'Image edit');
    }
  }

  private async createImageVariation(params: unknown): Promise<ToolResult> {
    try {
      const { imagePath, count = 1, outputDir } = params as {
        imagePath: string;
        count?: number;
        outputDir?: string;
      };

      if (!imagePath) {
        return this.createError('imagePath is required');
      }

      if (!existsSync(imagePath)) {
        return this.createError(`Image file not found: ${imagePath}`);
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return this.createError('OPENAI_API_KEY not configured');
      }

      const imageBuffer = await readFile(imagePath);
      const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

      const formData = new FormData();
      formData.append('image', imageBlob, 'image.png');
      formData.append('n', String(Math.min(count, 10)));
      formData.append('size', '1024x1024');
      formData.append('response_format', 'url');

      const response = await fetch('https://api.openai.com/v1/images/variations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.text();
        return this.createError(`DALL-E variation API error (${response.status}): ${err}`);
      }

      const data = (await response.json()) as any;
      const images = data.data as Array<{ url: string }> | undefined;
      if (!images || images.length === 0) {
        return this.createError('No image URLs in DALL-E variation response');
      }

      const result: { urls: string[]; files?: string[] } = { urls: images.map((img) => img.url) };

      if (outputDir) {
        const files: string[] = [];
        for (let i = 0; i < images.length; i++) {
          const imageResponse = await fetch(images[i].url);
          const buffer = Buffer.from(await imageResponse.arrayBuffer());
          const filePath = resolve(outputDir, `variation_${i}_${Date.now()}.png`);
          await writeFile(filePath, buffer);
          files.push(filePath);
        }
        result.files = files;
      }

      return this.createSuccess(result, {
        count: images.length,
        hasOutputDir: !!outputDir,
      });
    } catch (error) {
      return this.handleError(error, 'Image variation');
    }
  }

  private async textToSpeech(params: unknown): Promise<ToolResult> {
    try {
      const {
        text,
        voice = 'alloy',
        model = 'tts-1',
        speed = 1.0,
        outputPath,
      } = params as {
        text: string;
        voice?: string;
        model?: string;
        speed?: number;
        outputPath: string;
      };

      if (!text || !outputPath) {
        return this.createError('text and outputPath are required');
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return this.createError('OPENAI_API_KEY not configured');
      }

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          speed,
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return this.createError(`OpenAI TTS API error (${response.status}): ${err}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      await writeFile(outputPath, audioBuffer);

      return this.createSuccess(
        { filePath: outputPath, size: audioBuffer.length },
        {
          voice,
          model,
          speed,
          textLength: text.length,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Text-to-speech');
    }
  }

  private async speechToText(params: unknown): Promise<ToolResult> {
    try {
      const { audioPath, language, model = 'whisper-1', prompt } = params as {
        audioPath: string;
        language?: string;
        model?: string;
        prompt?: string;
      };

      if (!audioPath) {
        return this.createError('audioPath is required');
      }

      if (!existsSync(audioPath)) {
        return this.createError(`Audio file not found: ${audioPath}`);
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return this.createError('OPENAI_API_KEY not configured');
      }

      const audioBuffer = await readFile(audioPath);
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.mp3');
      formData.append('model', model);
      formData.append('response_format', 'json');

      if (language) {
        formData.append('language', language);
      }
      if (prompt) {
        formData.append('prompt', prompt);
      }

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.text();
        return this.createError(`OpenAI Whisper API error (${response.status}): ${err}`);
      }

      const data = (await response.json()) as { text: string };
      const detectedLanguage = language || 'en';

      return this.createSuccess(
        { text: data.text, language: detectedLanguage },
        {
          model,
          hasPrompt: !!prompt,
        }
      );
    } catch (error) {
      return this.handleError(error, 'Speech-to-text');
    }
  }

  private async translateAudio(params: unknown): Promise<ToolResult> {
    try {
      const { audioPath, model = 'whisper-1' } = params as {
        audioPath: string;
        model?: string;
      };

      if (!audioPath) {
        return this.createError('audioPath is required');
      }

      if (!existsSync(audioPath)) {
        return this.createError(`Audio file not found: ${audioPath}`);
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return this.createError('OPENAI_API_KEY not configured');
      }

      const audioBuffer = await readFile(audioPath);
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.mp3');
      formData.append('model', model);
      formData.append('response_format', 'json');

      const response = await fetch('https://api.openai.com/v1/audio/translations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.text();
        return this.createError(`OpenAI Whisper translation API error (${response.status}): ${err}`);
      }

      const data = (await response.json()) as { text: string };

      return this.createSuccess({ text: data.text }, { model });
    } catch (error) {
      return this.handleError(error, 'Audio translation');
    }
  }
}
