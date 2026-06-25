/**
 * Permission Manager - File/directory access control
 */

import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger';
import { EventEmitter } from 'events';
import { join } from 'path';

const logger = createLogger('Permission');

/**
 * Permission type
 */
export type PermissionType = 'file' | 'directory' | 'network';

/**
 * Permission operation
 */
export type PermissionOperation = 'read' | 'write' | 'execute' | 'delete';

/**
 * Permission request
 */
export interface PermissionRequest {
  id: string;
  type: PermissionType;
  path: string;
  operation: PermissionOperation;
  reason?: string;
  timestamp: number;
}

/**
 * Permission decision
 */
export interface PermissionDecision {
  granted: boolean;
  remember: boolean;
  timestamp: number;
}

/**
 * Permission rule
 */
interface PermissionRule {
  pattern: string;
  type: PermissionType;
  operation: PermissionOperation;
  decision: 'allow' | 'deny';
  createdAt: number;
}

/**
 * Permission Manager
 */
export class PermissionManager extends EventEmitter {
  private db: Database.Database;
  private pendingRequests = new Map<string, PermissionRequest>();
  private blockedPaths: Set<string> = new Set();

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.initializeTables();
    this.loadBlockedPaths();
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS permission_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        type TEXT NOT NULL,
        operation TEXT NOT NULL,
        decision TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS blocked_paths (
        path TEXT PRIMARY KEY,
        addedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS permission_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        operation TEXT NOT NULL,
        decision TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rules_pattern ON permission_rules(pattern);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON permission_audit(timestamp);
    `);
  }

  /**
   * Load blocked paths from database
   */
  private loadBlockedPaths(): void {
    const paths = this.db.prepare('SELECT path FROM blocked_paths').all() as { path: string }[];
    this.blockedPaths = new Set(paths.map(p => p.path));
    logger.info(`Loaded ${this.blockedPaths.size} blocked paths`);
  }

  /**
   * Request permission
   */
  async requestPermission(
    type: PermissionType,
    path: string,
    operation: PermissionOperation,
    reason?: string
  ): Promise<boolean> {
    // Check if path is blocked
    if (this.isPathBlocked(path)) {
      logger.warn(`Permission denied: path is blocked - ${path}`);
      this.auditLog(type, path, operation, 'deny');
      return false;
    }

    // Check existing rules
    const existingRule = this.findMatchingRule(type, path, operation);
    if (existingRule) {
      const granted = existingRule.decision === 'allow';
      this.auditLog(type, path, operation, existingRule.decision);
      logger.info(`Permission ${granted ? 'granted' : 'denied'} by rule: ${path}`);
      return granted;
    }

    // Create new request
    const request: PermissionRequest = {
      id: `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      path,
      operation,
      reason,
      timestamp: Date.now()
    };

    this.pendingRequests.set(request.id, request);

    // Emit event for UI dialog
    this.emit('permission-request', request);

    // Wait for user decision
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        this.auditLog(type, path, operation, 'timeout');
        resolve(false);
      }, 60000); // 60 second timeout

      this.once(`permission-response:${request.id}`, (decision: PermissionDecision) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(request.id);

        if (decision.remember) {
          this.addRule(type, path, operation, decision.granted ? 'allow' : 'deny');
        }

        this.auditLog(type, path, operation, decision.granted ? 'allow' : 'deny');
        resolve(decision.granted);
      });
    });
  }

  /**
   * Respond to permission request
   */
  respondToRequest(requestId: string, decision: PermissionDecision): void {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      logger.warn(`Permission request not found: ${requestId}`);
      return;
    }

    this.emit(`permission-response:${requestId}`, decision);
    logger.info(`Permission response: ${requestId} - ${decision.granted ? 'granted' : 'denied'}`);
  }

  /**
   * Find matching rule
   */
  private findMatchingRule(
    type: PermissionType,
    path: string,
    operation: PermissionOperation
  ): PermissionRule | null {
    const rules = this.db
      .prepare('SELECT * FROM permission_rules WHERE type = ? AND operation = ?')
      .all(type, operation) as PermissionRule[];

    for (const rule of rules) {
      if (this.matchPattern(path, rule.pattern)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Match path against pattern
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Add permission rule
   */
  addRule(
    type: PermissionType,
    pattern: string,
    operation: PermissionOperation,
    decision: 'allow' | 'deny'
  ): void {
    this.db
      .prepare(
        'INSERT INTO permission_rules (pattern, type, operation, decision, createdAt) VALUES (?, ?, ?, ?, ?)'
      )
      .run(pattern, type, operation, decision, Date.now());

    logger.info(`Permission rule added: ${pattern} - ${decision}`);
  }

  /**
   * Remove permission rule
   */
  removeRule(pattern: string): void {
    this.db.prepare('DELETE FROM permission_rules WHERE pattern = ?').run(pattern);
    logger.info(`Permission rule removed: ${pattern}`);
  }

  /**
   * List all rules
   */
  listRules(): PermissionRule[] {
    return this.db.prepare('SELECT * FROM permission_rules ORDER BY createdAt DESC').all() as PermissionRule[];
  }

  /**
   * Add blocked path
   */
  addBlockedPath(path: string): void {
    this.db.prepare('INSERT OR REPLACE INTO blocked_paths (path, addedAt) VALUES (?, ?)').run(path, Date.now());
    this.blockedPaths.add(path);
    this.emit('blocked-paths-changed', Array.from(this.blockedPaths));
    logger.info(`Blocked path added: ${path}`);
  }

  /**
   * Remove blocked path
   */
  removeBlockedPath(path: string): void {
    this.db.prepare('DELETE FROM blocked_paths WHERE path = ?').run(path);
    this.blockedPaths.delete(path);
    this.emit('blocked-paths-changed', Array.from(this.blockedPaths));
    logger.info(`Blocked path removed: ${path}`);
  }

  /**
   * Check if path is blocked
   */
  isPathBlocked(path: string): boolean {
    // Check exact match
    if (this.blockedPaths.has(path)) return true;

    // Check if path is inside blocked directory
    for (const blocked of this.blockedPaths) {
      if (path.startsWith(blocked + '/') || path.startsWith(blocked + '\\')) {
        return true;
      }
    }

    return false;
  }

  /**
   * List blocked paths
   */
  listBlockedPaths(): string[] {
    return Array.from(this.blockedPaths);
  }

  /**
   * Audit log
   */
  private auditLog(
    type: PermissionType,
    path: string,
    operation: PermissionOperation,
    decision: string
  ): void {
    this.db
      .prepare('INSERT INTO permission_audit (type, path, operation, decision, timestamp) VALUES (?, ?, ?, ?, ?)')
      .run(type, path, operation, decision, Date.now());
  }

  /**
   * Get audit logs
   */
  getAuditLogs(limit: number = 100): any[] {
    return this.db
      .prepare('SELECT * FROM permission_audit ORDER BY timestamp DESC LIMIT ?')
      .all(limit);
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(): void {
    this.db.prepare('DELETE FROM permission_audit').run();
    logger.info('Audit logs cleared');
  }
}
