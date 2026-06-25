/**
 * Aether Monitoring — Sentry integration
 *
 * 行为规则:
 *   - 如果 VITE_SENTRY_DSN 环境变量存在，则初始化 Sentry
 *   - 如果不存在，所有导出函数都是 no-op（空操作），调用方无需关心
 *   - Sentry 包不是硬依赖，通过 script-src CDN + 全局变量方式加载；
 *     确保 build 时不会因为找不到 @sentry/react 而失败
 *
 * 使用方式:
 * ```ts
 * import { captureError } from '../utils/monitoring';
 *
 * try {
 *   riskyOperation();
 * } catch (err) {
 *   captureError(err);
 * }
 * ```
 */

type CaptureError = (error: unknown, context?: Record<string, unknown>) => void;
type CaptureMessage = (message: string, level?: 'info' | 'warning' | 'error') => void;
type SetUser = (id: string | null, email?: string, username?: string) => void;

// ---------------------------------------------------------------------------
// 默认导出：No-op 函数（当 Sentry 未初始化时使用）
// ---------------------------------------------------------------------------

const noop: CaptureError = () => {};
const noopMsg: CaptureMessage = () => {};
const noopUser: SetUser = () => {};

let captureError: CaptureError = noop;
let captureMessage: CaptureMessage = noopMsg;
let setUser: SetUser = noopUser;

// ---------------------------------------------------------------------------
// Sentry 初始化（仅当配置了 DSN 时尝试加载）
// ---------------------------------------------------------------------------
// 使用 CDN Script 方式加载 Sentry 浏览器 SDK，而非 npm 包动态 import。
// 原因：vite build 阶段会解析所有 import() 调用，导致 @sentry/react
// 未安装时构建失败。通过 Script 注入 + window 全局变量方式，确保构建和
// 运行时都不会因 Sentry 缺失而报错。
// ---------------------------------------------------------------------------

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (SENTRY_DSN) {
  // 使用匿名自执行函数，确保变量不污染作用域
  (() => {
    const script = document.createElement('script');
    script.src = 'https://browser.sentry-cdn.com/8.9.2/bundle.min.js';
    script.integrity = '';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      const Sentry = (window as unknown as Record<string, unknown>).Sentry as {
        init: (opts: Record<string, unknown>) => void;
        captureException: (e: unknown, opts?: Record<string, unknown>) => void;
        captureMessage: (msg: string, level?: string) => void;
        setUser: (user: Record<string, unknown> | null) => void;
      } | undefined;

      if (!Sentry) return;

      Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE || 'production',
        release: `aether-web@${import.meta.env.VITE_APP_VERSION || '3.0.0'}`,
        tracesSampleRate: 0.1,
        enabled: import.meta.env.PROD,
        dedupe: true,
        ignoreErrors: [
          'ResizeObserver loop limit exceeded',
          'NetworkError',
          'AbortError',
        ],
      });

      captureError = (error, context) => {
        if (error instanceof Error) {
          Sentry.captureException(error, { extra: context });
        } else {
          Sentry.captureMessage(String(error), 'error');
        }
      };

      captureMessage = (msg, level = 'info') => {
        Sentry.captureMessage(msg, level);
      };

      setUser = (id, email, username) => {
        if (id === null) {
          Sentry.setUser(null);
        } else {
          Sentry.setUser({ id, email, username });
        }
      };
    };
    // Script 加载失败不处理，保持 no-op
    document.head.appendChild(script);
  })();
}

export { captureError, captureMessage, setUser };
