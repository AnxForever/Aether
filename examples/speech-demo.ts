/**
 * Speech & Voice Example
 *
 * Demonstrates speech recognition and text-to-speech
 */

import { SpeechRecognition } from '../src/speech/speech-recognition';
import { VAD } from '../src/speech/vad';
import { TTS } from '../src/speech/tts';
import { AudioProcessor } from '../src/speech/audio-processor';
import { readFile, writeFile } from 'fs/promises';

async function main() {
  console.log('=== Nexus Speech & Voice Demo ===\n');

  // 1. Speech Recognition
  console.log('1. Speech Recognition with SenseVoice');
  console.log('-----------------------------------');

  const recognition = new SpeechRecognition({
    modelPath: './models/sensevoice',
    language: 'auto',
    sampleRate: 16000
  });

  try {
    // Process audio file
    const result = await recognition.processFile('./test-audio.wav');
    console.log('Transcription:', result.text);
    console.log('Confidence:', result.confidence);
    console.log('Language:', result.language);
  } catch (error: any) {
    console.log('Note: Audio file not found. Skipping recognition test.');
  }

  console.log();

  // 2. Voice Activity Detection
  console.log('2. Voice Activity Detection (VAD)');
  console.log('----------------------------------');

  const vad = new VAD({
    threshold: 0.5,
    minSpeechDuration: 300,
    minSilenceDuration: 500
  });

  vad.on('speech-start', (event) => {
    console.log('🎤 Speech started at:', new Date(event.startTime).toISOString());
  });

  vad.on('speech-end', (event) => {
    console.log('🔇 Speech ended. Duration:', event.duration, 'ms');
  });

  vad.start();

  // Simulate audio chunks
  try {
    const audioBuffer = await readFile('./test-audio.wav');
    const chunkSize = 4096;

    for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      const chunk = audioBuffer.subarray(i, i + chunkSize);
      vad.processChunk(chunk);
    }
  } catch (error: any) {
    console.log('Note: Audio file not found. Skipping VAD test.');
  }

  vad.stop();
  console.log();

  // 3. Text-to-Speech
  console.log('3. Text-to-Speech (TTS)');
  console.log('------------------------');

  const tts = new TTS({
    provider: 'edge-tts',
    voice: 'zh-CN-XiaoxiaoNeural',
    rate: 1.0,
    pitch: 1.0
  });

  await tts.initialize();

  const voices = tts.getVoices();
  console.log(`Available voices: ${voices.length}`);
  voices.slice(0, 3).forEach((voice) => {
    console.log(`  - ${voice.name} (${voice.language}, ${voice.gender})`);
  });

  console.log('\nSynthesizing speech...');
  try {
    const text = '你好，我是 Nexus Agent，一个智能 AI 助手。';
    const output = await tts.synthesize(text);

    // Save to file
    await writeFile('./output.mp3', output.audioBuffer);
    console.log('✅ Audio saved to output.mp3');
    console.log('   Duration:', output.duration, 'ms');
    console.log('   Sample rate:', output.sampleRate, 'Hz');
  } catch (error: any) {
    console.log('⚠️  TTS synthesis failed:', error.message);
    console.log('   (Make sure edge-tts is installed: pip install edge-tts)');
  }

  console.log();

  // 4. Audio Processing
  console.log('4. Audio Processing Utilities');
  console.log('------------------------------');

  try {
    const audioBuffer = await readFile('./test-audio.wav');

    // Calculate RMS energy
    const rms = AudioProcessor.calculateRMS(audioBuffer);
    console.log('Audio RMS energy:', rms.toFixed(4));

    // Detect silence
    const silenceRegions = AudioProcessor.detectSilence(audioBuffer, 0.01, 500, 16000);
    console.log('Silence regions detected:', silenceRegions.length);

    // Normalize audio
    const normalized = AudioProcessor.normalize(audioBuffer, 0.8);
    console.log('Audio normalized to 80% peak level');

    // Resample audio
    const resampled = AudioProcessor.resample(audioBuffer, 16000, 24000);
    console.log('Audio resampled from 16kHz to 24kHz');
  } catch (error: any) {
    console.log('Note: Audio file not found. Skipping audio processing test.');
  }

  console.log('\n=== Demo completed! ===');
}

main().catch(console.error);
