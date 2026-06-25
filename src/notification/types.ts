/**
 * Notification Types
 */

/**
 * Notification type
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'default';

/**
 * Notification options
 */
export interface NotificationOptions {
  id?: string;
  title?: string;
  description?: string;
  type: NotificationType;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Notification
 */
export interface Notification {
  id: string;
  title?: string;
  description?: string;
  type: NotificationType;
  duration: number;
  dismissible: boolean;
  createdAt: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}
