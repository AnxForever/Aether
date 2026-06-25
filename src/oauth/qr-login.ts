/**
 * QR Code Login - 扫码登录支持
 *
 * 用于移动端扫码登录桌面应用
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';

const logger = createLogger('QRLogin');

/**
 * 扫码登录状态
 */
export type QRLoginStatus = 'pending' | 'scanned' | 'confirmed' | 'expired' | 'cancelled';

/**
 * 扫码登录会话
 */
export interface QRLoginSession {
  /** 会话 ID */
  id: string;
  /** 登录 URL */
  loginUrl: string;
  /** QR 码（base64） */
  qrCode: string;
  /** 状态 */
  status: QRLoginStatus;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 */
  expiresAt: number;
  /** 用户信息（确认后填充） */
  user?: any;
}

/**
 * 扫码登录管理器
 */
export class QRLoginManager extends EventEmitter {
  private sessions = new Map<string, QRLoginSession>();
  private pollIntervals = new Map<string, NodeJS.Timeout>();
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    super();
    this.baseUrl = baseUrl;
  }

  /**
   * 创建扫码登录会话
   */
  async createSession(expiresInMs: number = 300000): Promise<QRLoginSession> {
    // 生成会话 ID
    const sessionId = randomBytes(16).toString('hex');

    // 构建登录 URL
    const loginUrl = `${this.baseUrl}/qr-login?session=${sessionId}`;

    // 生成 QR 码
    const qrCode = await QRCode.toDataURL(loginUrl, {
      width: 300,
      margin: 2,
    });

    const session: QRLoginSession = {
      id: sessionId,
      loginUrl,
      qrCode,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresInMs,
    };

    this.sessions.set(sessionId, session);

    logger.info(`QR login session created: ${sessionId}`);

    // 自动过期
    setTimeout(() => {
      this.expireSession(sessionId);
    }, expiresInMs);

    this.emit('session-created', session);

    return session;
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): QRLoginSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 更新会话状态
   */
  updateSession(sessionId: string, status: QRLoginStatus, user?: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = status;
    if (user) {
      session.user = user;
    }

    logger.info(`Session ${sessionId} status updated: ${status}`);

    this.emit('session-updated', session);

    // 如果确认或取消，清理会话
    if (status === 'confirmed' || status === 'cancelled') {
      setTimeout(() => {
        this.sessions.delete(sessionId);
        logger.debug(`Session cleaned up: ${sessionId}`);
      }, 5000);
    }
  }

  /**
   * 标记为已扫描
   */
  markScanned(sessionId: string): void {
    this.updateSession(sessionId, 'scanned');
  }

  /**
   * 确认登录
   */
  confirmLogin(sessionId: string, user: any): void {
    this.updateSession(sessionId, 'confirmed', user);
  }

  /**
   * 取消登录
   */
  cancelLogin(sessionId: string): void {
    this.updateSession(sessionId, 'cancelled');
  }

  /**
   * 过期会话
   */
  private expireSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'pending') {
      this.updateSession(sessionId, 'expired');
    }
  }

  /**
   * 轮询会话状态
   */
  async pollSession(
    sessionId: string,
    onStatusChange: (status: QRLoginStatus, user?: any) => void
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const currentSession = this.sessions.get(sessionId);

        if (!currentSession) {
          clearInterval(interval);
          reject(new Error('Session not found'));
          return;
        }

        onStatusChange(currentSession.status, currentSession.user);

        if (currentSession.status === 'confirmed') {
          clearInterval(interval);
          resolve();
        } else if (
          currentSession.status === 'expired' ||
          currentSession.status === 'cancelled'
        ) {
          clearInterval(interval);
          reject(new Error(`Login ${currentSession.status}`));
        }
      }, 1000);

      this.pollIntervals.set(sessionId, interval);
    });
  }

  /**
   * 停止轮询
   */
  stopPolling(sessionId: string): void {
    const interval = this.pollIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(sessionId);
    }
  }

  /**
   * 清理所有会话
   */
  cleanup(): void {
    // 停止所有轮询
    for (const interval of this.pollIntervals.values()) {
      clearInterval(interval);
    }
    this.pollIntervals.clear();

    // 清理会话
    this.sessions.clear();

    logger.info('QR login manager cleaned up');
  }
}
