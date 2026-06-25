/**
 * Sharp Processor
 * Sharp 图像处理核心封装
 */

import sharp, { Sharp } from 'sharp'
import { Readable } from 'stream'
import {
  ImageFormat,
  ImageInput,
  ResizeOptions,
  CropOptions,
  RotateOptions,
  FlipOptions,
  CompressOptions,
  WatermarkOptions,
  ImageProcessingError,
  ImageMetadata,
} from './types'

export class SharpProcessor {
  private instance: Sharp

  constructor(input: ImageInput) {
    if (typeof input === 'string') {
      this.instance = sharp(input)
    } else if (Buffer.isBuffer(input)) {
      this.instance = sharp(input)
    } else if (input instanceof Readable) {
      this.instance = sharp()
      input.pipe(this.instance)
    } else {
      throw new ImageProcessingError(
        'Invalid input type. Expected string, Buffer, or Readable stream',
        'INVALID_INPUT_TYPE'
      )
    }
  }

  /**
   * 获取 Sharp 实例
   */
  getInstance(): Sharp {
    return this.instance
  }

  /**
   * 调整大小
   */
  resize(options: ResizeOptions): this {
    try {
      this.instance.resize({
        width: options.width,
        height: options.height,
        fit: options.fit || 'cover',
        position: options.position || 'center',
        background: options.background || { r: 255, g: 255, b: 255, alpha: 1 },
        withoutEnlargement: options.withoutEnlargement ?? false,
      })
      return this
    } catch (error) {
      throw new ImageProcessingError(
        `Resize failed: ${error instanceof Error ? error.message : String(error)}`,
        'RESIZE_FAILED',
        error
      )
    }
  }

  /**
   * 裁剪
   */
  crop(options: CropOptions): this {
    try {
      this.instance.extract({
        left: options.left,
        top: options.top,
        width: options.width,
        height: options.height,
      })
      return this
    } catch (error) {
      throw new ImageProcessingError(
        `Crop failed: ${error instanceof Error ? error.message : String(error)}`,
        'CROP_FAILED',
        error
      )
    }
  }

  /**
   * 旋转
   */
  rotate(options: RotateOptions): this {
    try {
      this.instance.rotate(options.angle, {
        background: options.background || { r: 255, g: 255, b: 255, alpha: 1 },
      })
      return this
    } catch (error) {
      throw new ImageProcessingError(
        `Rotate failed: ${error instanceof Error ? error.message : String(error)}`,
        'ROTATE_FAILED',
        error
      )
    }
  }

  /**
   * 翻转
   */
  flip(options: FlipOptions): this {
    try {
      if (options.horizontal) {
        this.instance.flop()
      }
      if (options.vertical) {
        this.instance.flip()
      }
      return this
    } catch (error) {
      throw new ImageProcessingError(
        `Flip failed: ${error instanceof Error ? error.message : String(error)}`,
        'FLIP_FAILED',
        error
      )
    }
  }

  /**
   * 压缩并转换格式
   */
  compress(options: CompressOptions): this {
    try {
      const format = options.format || ImageFormat.JPEG
      const quality = options.quality ?? 80

      switch (format) {
        case ImageFormat.JPEG:
          this.instance.jpeg({
            quality,
            progressive: options.progressive ?? false,
          })
          break

        case ImageFormat.PNG:
          this.instance.png({
            quality,
            compressionLevel: Math.round((100 - quality) / 10),
          })
          break

        case ImageFormat.WEBP:
          this.instance.webp({
            quality,
            lossless: options.lossless ?? false,
          })
          break

        case ImageFormat.AVIF:
          this.instance.avif({
            quality,
            lossless: options.lossless ?? false,
          })
          break

        case ImageFormat.TIFF:
          this.instance.tiff({
            quality,
          })
          break

        default:
          throw new ImageProcessingError(
            `Unsupported format: ${format}`,
            'UNSUPPORTED_FORMAT'
          )
      }

      return this
    } catch (error) {
      throw new ImageProcessingError(
        `Compress failed: ${error instanceof Error ? error.message : String(error)}`,
        'COMPRESS_FAILED',
        error
      )
    }
  }

  /**
   * 添加水印
   */
  async watermark(options: WatermarkOptions): Promise<this> {
    try {
      // 加载水印图像
      const watermarkImage =
        typeof options.image === 'string'
          ? await sharp(options.image).toBuffer()
          : options.image

      // 获取主图像元数据
      const metadata = await this.instance.metadata()
      const mainWidth = metadata.width!
      const mainHeight = metadata.height!

      // 计算水印位置
      const margin = options.margin ?? 10
      let left = 0
      let top = 0

      const watermarkMetadata = await sharp(watermarkImage).metadata()
      const watermarkWidth = watermarkMetadata.width!
      const watermarkHeight = watermarkMetadata.height!

      switch (options.position) {
        case 'top-left':
          left = margin
          top = margin
          break
        case 'top-right':
          left = mainWidth - watermarkWidth - margin
          top = margin
          break
        case 'bottom-left':
          left = margin
          top = mainHeight - watermarkHeight - margin
          break
        case 'bottom-right':
          left = mainWidth - watermarkWidth - margin
          top = mainHeight - watermarkHeight - margin
          break
        case 'center':
        default:
          left = Math.floor((mainWidth - watermarkWidth) / 2)
          top = Math.floor((mainHeight - watermarkHeight) / 2)
          break
      }

      // 应用透明度
      let processedWatermark = sharp(watermarkImage)
      if (options.opacity !== undefined && options.opacity < 1) {
        processedWatermark = processedWatermark.composite([
          {
            input: Buffer.from([255, 255, 255, Math.round(options.opacity * 255)]),
            raw: {
              width: 1,
              height: 1,
              channels: 4,
            },
            tile: true,
            blend: 'dest-in',
          },
        ])
      }

      const watermarkBuffer = await processedWatermark.toBuffer()

      // 合成水印
      this.instance.composite([
        {
          input: watermarkBuffer,
          left,
          top,
        },
      ])

      return this
    } catch (error) {
      throw new ImageProcessingError(
        `Watermark failed: ${error instanceof Error ? error.message : String(error)}`,
        'WATERMARK_FAILED',
        error
      )
    }
  }

  /**
   * 保留元数据
   */
  keepMetadata(keep: boolean = true): this {
    try {
      if (keep) {
        this.instance.withMetadata()
      }
      return this
    } catch (error) {
      throw new ImageProcessingError(
        `Keep metadata failed: ${error instanceof Error ? error.message : String(error)}`,
        'KEEP_METADATA_FAILED',
        error
      )
    }
  }

  /**
   * 输出到 Buffer
   */
  async toBuffer(): Promise<Buffer> {
    try {
      return await this.instance.toBuffer()
    } catch (error) {
      throw new ImageProcessingError(
        `Convert to buffer failed: ${error instanceof Error ? error.message : String(error)}`,
        'TO_BUFFER_FAILED',
        error
      )
    }
  }

  /**
   * 输出到文件
   */
  async toFile(path: string): Promise<void> {
    try {
      await this.instance.toFile(path)
    } catch (error) {
      throw new ImageProcessingError(
        `Save to file failed: ${error instanceof Error ? error.message : String(error)}`,
        'TO_FILE_FAILED',
        error
      )
    }
  }

  /**
   * 输出到流
   */
  toStream(): Readable {
    try {
      return this.instance.clone()
    } catch (error) {
      throw new ImageProcessingError(
        `Convert to stream failed: ${error instanceof Error ? error.message : String(error)}`,
        'TO_STREAM_FAILED',
        error
      )
    }
  }

  /**
   * 获取元数据
   */
  async getMetadata(): Promise<ImageMetadata> {
    try {
      const metadata = await this.instance.metadata()
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        size: metadata.size,
      }
    } catch (error) {
      throw new ImageProcessingError(
        `Get metadata failed: ${error instanceof Error ? error.message : String(error)}`,
        'GET_METADATA_FAILED',
        error
      )
    }
  }

  /**
   * 克隆处理器
   */
  clone(): SharpProcessor {
    const cloned = new SharpProcessor(Buffer.alloc(0))
    cloned.instance = this.instance.clone()
    return cloned
  }
}
