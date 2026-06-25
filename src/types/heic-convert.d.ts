/**
 * Type definitions for heic-convert
 * heic-convert 缺少官方类型定义，手动补充
 */

declare module 'heic-convert' {
  interface ConvertOptions {
    buffer: Buffer
    format: 'JPEG' | 'PNG'
    quality: number
  }

  function convert(options: ConvertOptions): Promise<ArrayBuffer>

  export = convert
}
