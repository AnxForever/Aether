/**
 * Image Processor
 * 高性能图像处理管理器
 */

import { EventEmitter } from 'eventemitter3'
import { promises as fs } from 'fs'
import * as path from 'path'
import { Readable } from 'stream'
import { HeicConverter } from './heic-converter'
import { MetadataExtractor } from './metadata-extractor'
import { SharpProcessor } from './sharp-processor'
import {
  ImageProcessorConfig,
  ImageInput,
  ResizeOptions,
  CropOptions,
  RotateOptions,
  FlipOptions,
  CompressOptions,
  WatermarkOptions,
  ConvertOptions,
  BatchProcessOptions,
  ProcessOperation,
  ProcessResult,
  BatchProcessResult,
  ImageMetadata,
  ImageFormat,
  ImageProcessorEvent,
  ImageProcessingError,
} from './types'

export class ImageProcessor extends EventEmitter {
  private config: Required<ImageProcessorConfig>

  constructor(config?: ImageProcessorConfig) {
    super()

    this.config = {
      defaultQuality: config?.defaultQuality ?? 80,
      maxWidth: config?.maxWidth ?? 10000,
      maxHeight: config?.maxHeight ?? 10000,
      keepMetadata: config?.keepMetadata ?? false,
      tempDir: config?.tempDir ?? '/tmp',
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ImageProcessorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<ImageProcessorConfig>> {
    return { ...this.config }
  }

  /**
   * 格式转换
   */
  async convert(
    input: ImageInput,
    options: ConvertOptions
  ): Promise<ProcessResult> {
    const startTime = Date.now()

    try {
      this.emit(ImageProcessorEvent.PROCESS_START, { operation: 'convert', options })

      // 处理输入
      const inputBuffer = await this.normalizeInput(input)

      // 检测是否为 HEIC 格式
      let processBuffer = inputBuffer
      if (HeicConverter.isHeicFormat(inputBuffer)) {
        if (options.format === ImageFormat.HEIC) {
          throw new ImageProcessingError(
            'Cannot convert HEIC to HEIC',
            'INVALID_CONVERSION'
          )
        }

        // 先转换 HEIC 到 JPEG，再进行后续处理
        processBuffer = await HeicConverter.convert(inputBuffer, {
          format: 'JPEG',
          quality: (options.quality ?? this.config.defaultQuality) / 100,
        })
      }

      // 使用 Sharp 处理
      const processor = new SharpProcessor(processBuffer)
      processor.compress({
        format: options.format,
        quality: options.quality ?? this.config.defaultQuality,
      })

      if (options.keepMetadata ?? this.config.keepMetadata) {
        processor.keepMetadata(true)
      }

      const buffer = await processor.toBuffer()
      const metadata = await processor.getMetadata()

      const result: ProcessResult = {
        buffer,
        metadata,
        duration: Date.now() - startTime,
      }

      this.emit(ImageProcessorEvent.PROCESS_COMPLETE, result)
      return result
    } catch (error) {
      this.emit(ImageProcessorEvent.PROCESS_ERROR, error)
      throw error instanceof ImageProcessingError
        ? error
        : new ImageProcessingError(
            `Conversion failed: ${error instanceof Error ? error.message : String(error)}`,
            'CONVERSION_FAILED',
            error
          )
    }
  }

  /**
   * 调整大小
   */
  async resize(
    input: ImageInput,
    options: ResizeOptions
  ): Promise<ProcessResult> {
    const startTime = Date.now()

    try {
      this.emit(ImageProcessorEvent.PROCESS_START, { operation: 'resize', options })

      const inputBuffer = await this.normalizeInput(input)
      const processor = new SharpProcessor(inputBuffer)

      // 验证尺寸限制
      if (options.width && options.width > this.config.maxWidth) {
        throw new ImageProcessingError(
          `Width ${options.width} exceeds maximum ${this.config.maxWidth}`,
          'SIZE_LIMIT_EXCEEDED'
        )
      }
      if (options.height && options.height > this.config.maxHeight) {
        throw new ImageProcessingError(
          `Height ${options.height} exceeds maximum ${this.config.maxHeight}`,
          'SIZE_LIMIT_EXCEEDED'
        )
      }

      processor.resize(options)

      if (this.config.keepMetadata) {
        processor.keepMetadata(true)
      }

      const buffer = await processor.toBuffer()
      const metadata = await processor.getMetadata()

      const result: ProcessResult = {
        buffer,
        metadata,
        duration: Date.now() - startTime,
      }

      this.emit(ImageProcessorEvent.PROCESS_COMPLETE, result)
      return result
    } catch (error) {
      this.emit(ImageProcessorEvent.PROCESS_ERROR, error)
      throw error instanceof ImageProcessingError
        ? error
        : new ImageProcessingError(
            `Resize failed: ${error instanceof Error ? error.message : String(error)}`,
            'RESIZE_FAILED',
            error
          )
    }
  }

  /**
   * 裁剪
   */
  async crop(input: ImageInput, options: CropOptions): Promise<ProcessResult> {
    const startTime = Date.now()

    try {
      this.emit(ImageProcessorEvent.PROCESS_START, { operation: 'crop', options })

      const inputBuffer = await this.normalizeInput(input)
      const processor = new SharpProcessor(inputBuffer)

      processor.crop(options)

      if (this.config.keepMetadata) {
        processor.keepMetadata(true)
      }

      const buffer = await processor.toBuffer()
      const metadata = await processor.getMetadata()

      const result: ProcessResult = {
        buffer,
        metadata,
        duration: Date.now() - startTime,
      }

      this.emit(ImageProcessorEvent.PROCESS_COMPLETE, result)
      return result
    } catch (error) {
      this.emit(ImageProcessorEvent.PROCESS_ERROR, error)
      throw error instanceof ImageProcessingError
        ? error
        : new ImageProcessingError(
            `Crop failed: ${error instanceof Error ? error.message : String(error)}`,
            'CROP_FAILED',
            error
          )
    }
  }

  /**
   * 旋转
   */
  async rotate(
    input: ImageInput,
    options: RotateOptions
  ): Promise<ProcessResult> {
    const startTime = Date.now()

    try {
      this.emit(ImageProcessorEvent.PROCESS_START, { operation: 'rotate', options })

      const inputBuffer = await this.normalizeInput(input)
      const processor = new SharpProcessor(inputBuffer)

      processor.rotate(options)

      if (this.config.keepMetadata) {
        processor.keepMetadata(true)
      }

      const buffer = await processor.toBuffer()
      const metadata = await processor.getMetadata()

      const result: ProcessResult = {
        buffer,
        metadata,
        duration: Date.now() - startTime,
      }

      this.emit(ImageProcessorEvent.PROCESS_COMPLETE, result)
      return result
    } catch (error) {
      this.emit(ImageProcessorEvent.PROCESS_ERROR, error)
      throw error instanceof ImageProcessingError
        ? error
        : new ImageProcessingError(
            `Rotate failed: ${error instanceof Error ? error.message : String(error)}`,
            'ROTATE_FAILED',
            error
          )
    }
  }

  /**
   * 翻转
   */
  async flip(input: ImageInput, options: FlipOptions): Promise<ProcessResult> {
    const startTime = Date.now()

    try {
      this.emit(ImageProcessorEvent.PROCESS_START, { operation: 'flip', options })

      const inputBuffer = await this.normalizeInput(input)
      const processor = new SharpProcessor(inputBuffer)

      processor.flip(options)

      if (this.config.keepMetadata) {
        processor.keepMetadata(true)
      }

      const buffer = await processor.toBuffer()
      const metadata = await processor.getMetadata()

      const result: ProcessResult = {
        buffer,
        metadata,
        duration: Date.now() - startTime,
      }

      this.emit(ImageProcessorEvent.PROCESS_COMPLETE, result)
      return result
    } catch (error) {
      this.emit(ImageProcessorEvent.PROCESS_ERROR, error)
      throw error instanceof ImageProcessingError
        ? error
        : new ImageProcessingError(
            `Flip failed: ${error instanceof Error ? error.message : String(error)}`,
            'FLIP_FAILED',
            error
          )
    }
  }

  /**
   * 压缩
   */
  async compress(
    input: ImageInput,
    options: CompressOptions
  ): Promise<ProcessResult> {
    const startTime = Date.now()

    try {
      this.emit(ImageProcessorEvent.PROCESS_START, { operation: 'compress', options })

      const inputBuffer = await this.normalizeInput(input)
      const processor = new SharpProcessor(inputBuffer)

      processor.compress({
        format: options.format,
        quality: options.quality ?? this.config.defaultQuality,
        progressive: options.progressive,
        lossless: options.lossless,
      })

      if (this.config.keepMetadata) {
        processor.keepMetadata(true)
      }

      const buffer = await processor.toBuffer()
      const metadata = await processor.getMetadata()

      const result: ProcessResult = {
        buffer,
        metadata,
        duration: Date.now() - startTime,
      }

      this.emit(ImageProcessorEvent.PROCESS_COMPLETE, result)
      return result
    } catch (error) {
      this.emit(ImageProcessorEvent.PROCESS_ERROR, error)
      throw error instanceof ImageProcessingError
        ? error
        : new ImageProcessingError(
            `Compress failed: ${error instanceof Error ? error.message : String(error)}`,
            'COMPRESS_FAILED',
            error
          )
    }
  }

  /**
   * 添加水印
   */
  async watermark(
    input: ImageInput,
    options: WatermarkOptions
  ): Promise<ProcessResult> {
    const startTime = Date.now()

    try {
      this.emit(ImageProcessorEvent.PROCESS_START, { operation: 'watermark', options })

      const inputBuffer = await this.normalizeInput(input)
      const processor = new SharpProcessor(inputBuffer)

      await processor.watermark(options)

      if (this.config.keepMetadata) {
        processor.keepMetadata(true)
      }

      const buffer = await processor.toBuffer()
      const metadata = await processor.getMetadata()

      const result: ProcessResult = {
        buffer,
        metadata,
        duration: Date.now() - startTime,
      }

      this.emit(ImageProcessorEvent.PROCESS_COMPLETE, result)
      return result
    } catch (error) {
      this.emit(ImageProcessorEvent.PROCESS_ERROR, error)
      throw error instanceof ImageProcessingError
        ? error
        : new ImageProcessingError(
            `Watermark failed: ${error instanceof Error ? error.message : String(error)}`,
            'WATERMARK_FAILED',
            error
          )
    }
  }

  /**
   * 批量处理
   */
  async batchProcess(
    options: BatchProcessOptions
  ): Promise<BatchProcessResult> {
    const startTime = Date.now()

    try {
      this.emit(ImageProcessorEvent.BATCH_START, { count: options.inputs.length })

      const concurrency = options.concurrency ?? 4
      const results: BatchProcessResult['results'] = []
      let succeeded = 0
      let failed = 0

      // 确保输出目录存在
      await fs.mkdir(options.outputDir, { recursive: true })

      // 分批处理
      for (let i = 0; i < options.inputs.length; i += concurrency) {
        const batch = options.inputs.slice(i, i + concurrency)
        const batchResults = await Promise.allSettled(
          batch.map((inputPath) => this.processSingle(inputPath, options))
        )

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j]
          const inputPath = batch[j]

          if (result.status === 'fulfilled') {
            succeeded++
            results.push({
              input: inputPath,
              success: true,
              output: result.value,
            })
          } else {
            failed++
            results.push({
              input: inputPath,
              success: false,
              error: result.reason?.message || String(result.reason),
            })
          }
        }

        this.emit(ImageProcessorEvent.BATCH_PROGRESS, {
          processed: i + batch.length,
          total: options.inputs.length,
          succeeded,
          failed,
        })
      }

      const batchResult: BatchProcessResult = {
        succeeded,
        failed,
        results,
        duration: Date.now() - startTime,
      }

      this.emit(ImageProcessorEvent.BATCH_COMPLETE, batchResult)
      return batchResult
    } catch (error) {
      this.emit(ImageProcessorEvent.BATCH_ERROR, error)
      throw error instanceof ImageProcessingError
        ? error
        : new ImageProcessingError(
            `Batch processing failed: ${error instanceof Error ? error.message : String(error)}`,
            'BATCH_PROCESSING_FAILED',
            error
          )
    }
  }

  /**
   * 提取元数据
   */
  async extractMetadata(input: ImageInput): Promise<ImageMetadata> {
    try {
      const inputBuffer = await this.normalizeInput(input)
      return await MetadataExtractor.extract(inputBuffer)
    } catch (error) {
      throw error instanceof ImageProcessingError
        ? error
        : new ImageProcessingError(
            `Extract metadata failed: ${error instanceof Error ? error.message : String(error)}`,
            'EXTRACT_METADATA_FAILED',
            error
          )
    }
  }

  /**
   * 创建处理管道（链式操作）
   */
  createPipeline(input: ImageInput): SharpProcessor {
    return new SharpProcessor(input)
  }

  /**
   * 处理单个文件（批量处理辅助方法）
   */
  private async processSingle(
    inputPath: string,
    options: BatchProcessOptions
  ): Promise<string> {
    const inputBuffer = await fs.readFile(inputPath)
    let processor = new SharpProcessor(inputBuffer)

    // 应用所有操作
    for (const operation of options.operations) {
      switch (operation.type) {
        case 'resize':
          processor.resize(operation.options)
          break
        case 'crop':
          processor.crop(operation.options)
          break
        case 'rotate':
          processor.rotate(operation.options)
          break
        case 'flip':
          processor.flip(operation.options)
          break
        case 'compress':
          processor.compress(operation.options)
          break
        case 'watermark':
          await processor.watermark(operation.options)
          break
        case 'convert':
          processor.compress({
            format: operation.options.format,
            quality: operation.options.quality,
          })
          break
      }
    }

    // 生成输出路径
    const basename = path.basename(inputPath, path.extname(inputPath))
    const ext = this.getOutputExtension(options.operations)
    const outputPath = path.join(options.outputDir, `${basename}${ext}`)

    // 检查是否需要覆盖
    if (!options.overwrite) {
      try {
        await fs.access(outputPath)
        throw new ImageProcessingError(
          `Output file already exists: ${outputPath}`,
          'FILE_EXISTS'
        )
      } catch (error: any) {
        if (error.code !== 'ENOENT') throw error
      }
    }

    // 保存文件
    await processor.toFile(outputPath)
    return outputPath
  }

  /**
   * 根据操作获取输出扩展名
   */
  private getOutputExtension(operations: ProcessOperation[]): string {
    for (let i = operations.length - 1; i >= 0; i--) {
      const op = operations[i]
      if (op.type === 'convert' || op.type === 'compress') {
        const format =
          op.type === 'convert' ? op.options.format : op.options.format
        if (format) {
          return `.${format}`
        }
      }
    }
    return '.jpg' // 默认
  }

  /**
   * 规范化输入（统一转换为 Buffer）
   */
  private async normalizeInput(input: ImageInput): Promise<Buffer> {
    if (typeof input === 'string') {
      return await fs.readFile(input)
    } else if (Buffer.isBuffer(input)) {
      return input
    } else if (input instanceof Readable) {
      return await this.streamToBuffer(input)
    }

    throw new ImageProcessingError(
      'Invalid input type',
      'INVALID_INPUT_TYPE'
    )
  }

  /**
   * 流转 Buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  }
}
