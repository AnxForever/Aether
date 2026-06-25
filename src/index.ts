/**
 * Aether - Main Entry Point
 *
 * Next-generation AI assistant with enhanced security and capabilities
 */

// Core
export * from './core';
export * from './types';

// Connectors
export * from './connectors';

// Storage
export * from './storage';

// Skills
export * from './skills';

// System (removed scheduler to avoid TaskQueue conflict)
export * from './gateway';
export * from './updater';
export * from './telemetry';
export * from './watcher';
export * from './system';

// Main Agent Class
export { AetherAgent } from './agent';
