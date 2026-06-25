/**
 * Notification Manager - Toast notifications and messages
 */

import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { Notification, NotificationOptions, NotificationType } from './types';

const logger = createLogger('Notification');

/**
 * Notification Manager
 */
export class NotificationManager extends EventEmitter {
  private notifications = new Map<string, Notification>();
  private maxNotifications = 5;
  private defaultDuration = 5000;

  constructor() {
    super();
  }

  /**
   * Show notification
   */
  show(options: NotificationOptions): string {
    const notification: Notification = {
      id: options.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: options.title,
      description: options.description,
      type: options.type,
      duration: options.duration ?? this.defaultDuration,
      dismissible: options.dismissible ?? true,
      createdAt: Date.now(),
      action: options.action
    };

    // Remove oldest if at max capacity
    if (this.notifications.size >= this.maxNotifications) {
      const oldest = Array.from(this.notifications.keys())[0];
      this.dismiss(oldest);
    }

    this.notifications.set(notification.id, notification);

    // Emit to renderer
    this.emit('notification-show', notification);

    // Auto-dismiss if duration > 0
    if (notification.duration > 0) {
      setTimeout(() => {
        this.dismiss(notification.id);
      }, notification.duration);
    }

    logger.info(`Notification shown: ${notification.type} - ${notification.title || notification.description}`);
    return notification.id;
  }

  /**
   * Dismiss notification
   */
  dismiss(id: string): void {
    const notification = this.notifications.get(id);
    if (!notification) return;

    this.notifications.delete(id);
    this.emit('notification-dismiss', id);

    logger.info(`Notification dismissed: ${id}`);
  }

  /**
   * Success notification
   */
  success(title: string, description?: string, duration?: number): string {
    return this.show({
      type: 'success',
      title,
      description,
      duration
    });
  }

  /**
   * Error notification
   */
  error(title: string, description?: string, duration?: number): string {
    return this.show({
      type: 'error',
      title,
      description,
      duration: duration ?? 0 // Errors don't auto-dismiss by default
    });
  }

  /**
   * Warning notification
   */
  warning(title: string, description?: string, duration?: number): string {
    return this.show({
      type: 'warning',
      title,
      description,
      duration
    });
  }

  /**
   * Info notification
   */
  info(title: string, description?: string, duration?: number): string {
    return this.show({
      type: 'info',
      title,
      description,
      duration
    });
  }

  /**
   * Get notification by ID
   */
  get(id: string): Notification | undefined {
    return this.notifications.get(id);
  }

  /**
   * List all active notifications
   */
  list(): Notification[] {
    return Array.from(this.notifications.values());
  }

  /**
   * Clear all notifications
   */
  clear(): void {
    for (const id of this.notifications.keys()) {
      this.dismiss(id);
    }
    logger.info('All notifications cleared');
  }

  /**
   * Set max notifications
   */
  setMaxNotifications(max: number): void {
    this.maxNotifications = max;
  }

  /**
   * Set default duration
   */
  setDefaultDuration(duration: number): void {
    this.defaultDuration = duration;
  }
}
