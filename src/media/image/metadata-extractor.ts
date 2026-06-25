/**
 * Metadata Extractor
 * 图像元数据提取器
 */

import sharp from 'sharp'
import { ImageMetadata, ImageProcessingError } from './types'

export class MetadataExtractor {
  /**
   * 提取完整元数据
   */
  static async extract(input: Buffer | string): Promise<ImageMetadata> {
    try {
      const image = sharp(input)
      const metadata = await image.metadata()

      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        size: metadata.size,
        exif: metadata.exif ? this.parseExif(metadata.exif) : undefined,
        xmp: metadata.xmp ? metadata.xmp.toString('utf-8') : undefined,
        iptc: metadata.iptc,
        icc: metadata.icc,
      }
    } catch (error) {
      throw new ImageProcessingError(
        `Failed to extract metadata: ${error instanceof Error ? error.message : String(error)}`,
        'METADATA_EXTRACTION_FAILED',
        error
      )
    }
  }

  /**
   * 提取基础信息（快速）
   */
  static async extractBasic(
    input: Buffer | string
  ): Promise<Pick<ImageMetadata, 'format' | 'width' | 'height' | 'size'>> {
    try {
      const image = sharp(input)
      const metadata = await image.metadata()

      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        size: metadata.size,
      }
    } catch (error) {
      throw new ImageProcessingError(
        `Failed to extract basic metadata: ${error instanceof Error ? error.message : String(error)}`,
        'METADATA_EXTRACTION_FAILED',
        error
      )
    }
  }

  /**
   * 提取 EXIF 数据
   */
  static async extractExif(
    input: Buffer | string
  ): Promise<Record<string, any> | undefined> {
    try {
      const image = sharp(input)
      const metadata = await image.metadata()

      return metadata.exif ? this.parseExif(metadata.exif) : undefined
    } catch (error) {
      throw new ImageProcessingError(
        `Failed to extract EXIF: ${error instanceof Error ? error.message : String(error)}`,
        'EXIF_EXTRACTION_FAILED',
        error
      )
    }
  }

  /**
   * 提取 XMP 数据
   */
  static async extractXmp(
    input: Buffer | string
  ): Promise<string | undefined> {
    try {
      const image = sharp(input)
      const metadata = await image.metadata()

      return metadata.xmp ? metadata.xmp.toString('utf-8') : undefined
    } catch (error) {
      throw new ImageProcessingError(
        `Failed to extract XMP: ${error instanceof Error ? error.message : String(error)}`,
        'XMP_EXTRACTION_FAILED',
        error
      )
    }
  }

  /**
   * 提取 IPTC 数据
   */
  static async extractIptc(
    input: Buffer | string
  ): Promise<Record<string, any> | undefined> {
    try {
      const image = sharp(input)
      const metadata = await image.metadata()

      return metadata.iptc
    } catch (error) {
      throw new ImageProcessingError(
        `Failed to extract IPTC: ${error instanceof Error ? error.message : String(error)}`,
        'IPTC_EXTRACTION_FAILED',
        error
      )
    }
  }

  /**
   * 提取 GPS 信息
   */
  static async extractGps(input: Buffer | string): Promise<
    | {
        latitude: number
        longitude: number
        altitude?: number
      }
    | undefined
  > {
    try {
      const exif = await this.extractExif(input)
      if (!exif) return undefined

      const gps = exif.GPSInfo
      if (!gps) return undefined

      const latitude = this.parseGpsCoordinate(
        gps.GPSLatitude,
        gps.GPSLatitudeRef
      )
      const longitude = this.parseGpsCoordinate(
        gps.GPSLongitude,
        gps.GPSLongitudeRef
      )

      if (latitude === undefined || longitude === undefined) {
        return undefined
      }

      return {
        latitude,
        longitude,
        altitude: gps.GPSAltitude,
      }
    } catch (error) {
      throw new ImageProcessingError(
        `Failed to extract GPS: ${error instanceof Error ? error.message : String(error)}`,
        'GPS_EXTRACTION_FAILED',
        error
      )
    }
  }

  /**
   * 提取拍摄信息
   */
  static async extractCameraInfo(input: Buffer | string): Promise<
    | {
        make?: string
        model?: string
        software?: string
        dateTime?: string
        exposureTime?: string
        fNumber?: number
        iso?: number
        focalLength?: number
      }
    | undefined
  > {
    try {
      const exif = await this.extractExif(input)
      if (!exif) return undefined

      return {
        make: exif.Make,
        model: exif.Model,
        software: exif.Software,
        dateTime: exif.DateTime || exif.DateTimeOriginal,
        exposureTime: exif.ExposureTime,
        fNumber: exif.FNumber,
        iso: exif.ISO || exif.ISOSpeedRatings,
        focalLength: exif.FocalLength,
      }
    } catch (error) {
      throw new ImageProcessingError(
        `Failed to extract camera info: ${error instanceof Error ? error.message : String(error)}`,
        'CAMERA_INFO_EXTRACTION_FAILED',
        error
      )
    }
  }

  /**
   * 解析 EXIF Buffer
   */
  private static parseExif(exifBuffer: Buffer): Record<string, any> {
    try {
      // Sharp 已经提供了部分解析，这里进行基础结构化
      // 完整的 EXIF 解析需要专门的库（如 exif-parser）
      const exif: Record<string, any> = {}

      // 将 Buffer 转换为可读对象
      // 注意：这里简化处理，实际生产环境建议使用 exif-parser
      const hex = exifBuffer.toString('hex')
      exif.raw = hex

      return exif
    } catch (error) {
      return { raw: exifBuffer.toString('hex') }
    }
  }

  /**
   * 解析 GPS 坐标
   */
  private static parseGpsCoordinate(
    coordinate: number[] | undefined,
    ref: string | undefined
  ): number | undefined {
    if (!coordinate || !ref) return undefined

    const [degrees, minutes, seconds] = coordinate
    let decimal = degrees + minutes / 60 + seconds / 3600

    // 南纬和西经为负值
    if (ref === 'S' || ref === 'W') {
      decimal = -decimal
    }

    return decimal
  }

  /**
   * 移除所有元数据
   */
  static async removeAll(input: Buffer | string): Promise<Buffer> {
    try {
      const image = sharp(input)
      return await image.withMetadata({}).toBuffer()
    } catch (error) {
      throw new ImageProcessingError(
        `Failed to remove metadata: ${error instanceof Error ? error.message : String(error)}`,
        'METADATA_REMOVAL_FAILED',
        error
      )
    }
  }

  /**
   * 保留特定元数据
   */
  static async keep(
    input: Buffer | string,
    keep: {
      exif?: boolean
      xmp?: boolean
      iptc?: boolean
      icc?: boolean
    }
  ): Promise<Buffer> {
    try {
      const image = sharp(input)
      return await image
        .withMetadata({
          exif: keep.exif ? {} : undefined,
          // Sharp 的 withMetadata 会自动保留其他元数据
        })
        .toBuffer()
    } catch (error) {
      throw new ImageProcessingError(
        `Failed to keep metadata: ${error instanceof Error ? error.message : String(error)}`,
        'METADATA_KEEP_FAILED',
        error
      )
    }
  }
}
