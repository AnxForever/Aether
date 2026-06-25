/**
 * Image Processing Types
 * 图像处理核心类型定义
 */

import { Readable } from 'stream'

/**
 * 支持的图像格式
 */
export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  AVIF = 'avif',
  HEIC = 'heic',
  HEIF = 'heif',
  TIFF = 'tiff',
  GIF = 'gif',
}

/**
 * 图像输入类型
 */
export type ImageInput = string | Buffer | Readable

/**
 * 图像处理配置
 */
export interface ImageProcessorConfig {
  /** 默认压缩质量 (1-100) */
  defaultQuality?: number
  /** 最大图像宽度（像素） */
  maxWidth?: number
  /** 最大图像高度（像素） */
  maxHeight?: number
  /** 是否保留元数据 */
  keepMetadata?: boolean
  /** 临时文件目录 */
  tempDir?: string
}

/**
 * 调整大小选项
 */
export interface ResizeOptions {
  /** 目标宽度 */
  width?: number
  /** 目标高度 */
  height?: number
  /** 适应模式 */
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  /** 对齐位置 */
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right'
  /** 背景颜色（用于 contain 模式） */
  background?: string
  /** 是否保持宽高比 */
  withoutEnlargement?: boolean
}

/**
 * 裁剪选项
 */
export interface CropOptions {
  /** X 坐标 */
  left: number
  /** Y 坐标 */
  top: number
  /** 宽度 */
  width: number
  /** 高度 */
  height: number
}

/**
 * 旋转选项
 */
export interface RotateOptions {
  /** 旋转角度 */
  angle: number
  /** 背景颜色 */
  background?: string
}

/**
 * 翻转选项
 */
export interface FlipOptions {
  /** 水平翻转 */
  horizontal?: boolean
  /** 垂直翻转 */
  vertical?: boolean
}

/**
 * 压缩选项
 */
export interface CompressOptions {
  /** 输出格式 */
  format?: ImageFormat
  /** 压缩质量 (1-100) */
  quality?: number
  /** 是否渐进式编码（JPEG） */
  progressive?: boolean
  /** 是否无损压缩（WebP） */
  lossless?: boolean
}

/**
 * 水印选项
 */
export interface WatermarkOptions {
  /** 水印图像路径或 Buffer */
  image: string | Buffer
  /** 水印位置 */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  /** 水印透明度 (0-1) */
  opacity?: number
  /** 边距（像素） */
  margin?: number
}

/**
 * 格式转换选项
 */
export interface ConvertOptions {
  /** 目标格式 */
  format: ImageFormat
  /** 压缩质量 */
  quality?: number
  /** 是否保留元数据 */
  keepMetadata?: boolean
}

/**
 * 批量处理选项
 */
export interface BatchProcessOptions {
  /** 输入文件路径数组 */
  inputs: string[]
  /** 输出目录 */
  outputDir: string
  /** 处理操作 */
  operations: ProcessOperation[]
  /** 并发数 */
  concurrency?: number
  /** 是否覆盖已存在的文件 */
  overwrite?: boolean
}

/**
 * 处理操作
 */
export type ProcessOperation =
  | { type: 'resize'; options: ResizeOptions }
  | { type: 'crop'; options: CropOptions }
  | { type: 'rotate'; options: RotateOptions }
  | { type: 'flip'; options: FlipOptions }
  | { type: 'compress'; options: CompressOptions }
  | { type: 'watermark'; options: WatermarkOptions }
  | { type: 'convert'; options: ConvertOptions }

/**
 * 图像元数据
 */
export interface ImageMetadata {
  /** 格式 */
  format?: string
  /** 宽度（像素） */
  width?: number
  /** 高度（像素） */
  height?: number
  /** 色彩空间 */
  space?: string
  /** 通道数 */
  channels?: number
  /** 位深度 */
  depth?: string
  /** 文件大小（字节） */
  size?: number
  /** EXIF 数据 */
  exif?: Record<string, any>
  /** XMP 数据 */
  xmp?: string
  /** IPTC 数据 */
  iptc?: Record<string, any>
  /** ICC 配置文件 */
  icc?: Buffer
}

/**
 * 处理结果
 */
export interface ProcessResult {
  /** 输出 Buffer */
  buffer?: Buffer
  /** 输出文件路径 */
  filePath?: string
  /** 元数据 */
  metadata: ImageMetadata
  /** 处理耗时（毫秒） */
  duration: number
}

/**
 * 批量处理结果
 */
export interface BatchProcessResult {
  /** 成功数量 */
  succeeded: number
  /** 失败数量 */
  failed: number
  /** 详细结果 */
  results: Array<{
    input: string
    success: boolean
    output?: string
    error?: string
  }>
  /** 总耗时（毫秒） */
  duration: number
}

/**
 * 事件类型
 */
export enum ImageProcessorEvent {
  PROCESS_START = 'process:start',
  PROCESS_COMPLETE = 'process:complete',
  PROCESS_ERROR = 'process:error',
  BATCH_START = 'batch:start',
  BATCH_PROGRESS = 'batch:progress',
  BATCH_COMPLETE = 'batch:complete',
  BATCH_ERROR = 'batch:error',
}

/**
 * 错误类型
 */
export class ImageProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ImageProcessingError'
    Object.setPrototypeOf(this, ImageProcessingError.prototype)
  }
}
