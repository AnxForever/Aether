/**
 * Backup Strategy - Different backup strategies
 */

export interface BackupStrategy {
  name: string;
  compress: boolean;
  encrypt: boolean;
  incremental: boolean;
}

export const FULL_BACKUP: BackupStrategy = {
  name: 'full',
  compress: true,
  encrypt: true,
  incremental: false
};

export const INCREMENTAL_BACKUP: BackupStrategy = {
  name: 'incremental',
  compress: true,
  encrypt: true,
  incremental: true
};

export const QUICK_BACKUP: BackupStrategy = {
  name: 'quick',
  compress: false,
  encrypt: false,
  incremental: false
};
