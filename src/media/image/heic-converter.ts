/**
 * HEIC Format Converter
 * HEIC 格式转换器
 */

import heicConvert from 'heic-convert'
import { ImageFormat, ImageProcessingError } from './types'

export interface HeicConvertOptions {
  /** 目标格式 */
  format: 'JPEG' | 'PNG'
  /** 压缩质量 (0-1) */
  quality?: number
}

export class HeicConverter {
  /**
   * 检测是否为 HEIC/HEIF 格式
   */
  static isHeicFormat(buffer: Buffer): boolean {
    // HEIC/HEIF 文件魔数检测
    const signature = buffer.toString('hex', 4, 12).toLowerCase()
    return (
      signature.includes('6674797068656963') || // 'ftypheic'
      signature.includes('6674797068656966') || // 'ftypheif'
      signature.includes('667479706d696631') || // 'ftypmif1'
      signature.includes('66747970686569') // 'ftyphei'
    )
  }

  /**
   * 将 HEIC 转换为 JPEG/PNG
   */
  static async convert(
    input: Buffer,
    options: HeicConvertOptions = { format: 'JPEG', quality: 0.92 }
  ): Promise<Buffer> {
    try {
      // 验证输入
      if (!Buffer.isBuffer(input)) {
        throw new ImageProcessingError(
          'Input must be a Buffer',
          'INVALID_INPUT'
        )
      }

      if (!this.isHeicFormat(input)) {
        throw new ImageProcessingError(
          'Input is not a valid HEIC/HEIF image',
          'INVALID_FORMAT'
        )
      }

      // 执行转换
      const result = await heicConvert({
        buffer: input,
        format: options.format,
        quality: options.quality ?? 0.92,
      })

      return Buffer.from(result)
    } catch (error) {
      if (error instanceof ImageProcessingError) {
        throw error
      }

      throw new ImageProcessingError(
        `Failed to convert HEIC image: ${error instanceof Error ? error.message : String(error)}`,
        'HEIC_CONVERSION_FAILED',
        error
      )
    }
  }

  /**
   * 批量转换 HEIC 图像
   */
  static async convertBatch(
    inputs: Buffer[],
    options: HeicConvertOptions = { format: 'JPEG', quality: 0.92 }
  ): Promise<Buffer[]> {
    const results: Buffer[] = []
    const errors: Error[] = []

    for (const input of inputs) {
      try {
        const result = await this.convert(input, options)
        results.push(result)
      } catch (error) {
        errors.push(
          error instanceof Error ? error : new Error(String(error))
        )
        results.push(Buffer.alloc(0)) // 占位
      }
    }

    if (errors.length > 0) {
      throw new ImageProcessingError(
        `Batch conversion failed: ${errors.length}/${inputs.length} images`,
        'BATCH_HEIC_CONVERSION_FAILED',
        errors
      )
    }

    return results
  }

  /**
   * 获取 HEIC 图像基础信息（无需完整解码）
   */
  static async getInfo(input: Buffer): Promise<{
    format: string
    width: number
    height: number
  }> {
    try {
      if (!this.isHeicFormat(input)) {
        throw new ImageProcessingError(
          'Input is not a valid HEIC/HEIF image',
          'INVALID_FORMAT'
        )
      }

      // heic-convert 没有直接获取信息的 API，需要先转换
      // 这里使用低质量快速转换来获取尺寸
      const tempBuffer = await this.convert(input, {
        format: 'JPEG',
        quality: 0.1,
      })

      // 从 JPEG 头部读取尺寸
      const dimensions = this.extractJpegDimensions(tempBuffer)

      return {
        format: 'heic',
        ...dimensions,
      }
    } catch (error) {
      throw new ImageProcessingError(
        `Failed to get HEIC info: ${error instanceof Error ? error.message : String(error)}`,
        'HEIC_INFO_FAILED',
        error
      )
    }
  }

  /**
   * 从 JPEG Buffer 提取尺寸信息
   */
  private static extractJpegDimensions(buffer: Buffer): {
    width: number
    height: number
  } {
    let offset = 2 // 跳过 SOI 标记 (0xFFD8)

    while (offset < buffer.length) {
      // 读取标记
      if (buffer[offset] !== 0xff) break

      const marker = buffer[offset + 1]
      offset += 2

      // SOF0-SOF15 标记包含图像尺寸
      if (
        (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
      ) {
        const height = buffer.readUInt16BE(offset + 3)
        const width = buffer.readUInt16BE(offset + 5)
        return { width, height }
      }

      // 读取段长度并跳过
      const segmentLength = buffer.readUInt16BE(offset)
      offset += segmentLength
    }

    throw new ImageProcessingError(
      'Failed to extract JPEG dimensions',
      'JPEG_DIMENSION_EXTRACTION_FAILED'
    )
  }
}
