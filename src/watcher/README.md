# File Watcher System

Complete cross-platform file monitoring system using @parcel/watcher with hot reload support.

## Features

- **Cross-platform file watching** using @parcel/watcher (native performance)
- **Event-driven architecture** (create/update/delete events)
- **Multi-path watching** with individual subscriptions
- **Hot reload management** with pattern matching and debouncing
- **Automatic error recovery** with configurable retry
- **Ignore patterns** support (glob-based)
- **Debouncing** to reduce event noise
- **TypeScript** with full type definitions

## Installation

```bash
npm install @parcel/watcher minimatch
```

## Quick Start

```typescript
import { FileWatcher, HotReloadManager } from './watcher';

// Create watcher
const watcher = new FileWatcher({
  paths: ['/path/to/skills', '/path/to/plugins'],
  ignore: ['*.log', 'node_modules'],
  debounceMs: 100,
});

// Listen to changes
watcher.on('change', (event) => {
  console.log(`[${event.type}] ${event.relativePath}`);
});

// Start watching
await watcher.start();

// Add hot reload
const hotReload = new HotReloadManager(watcher, {
  patterns: ['**/*.ts', '**/*.js'],
  onReload: async (changes) => {
    console.log('Reloading', changes.length, 'files');
    // Your reload logic here
  },
});

hotReload.start();
```

## API Reference

### FileWatcher

#### Constructor Options

```typescript
interface FileWatcherOptions {
  paths: string | string[];       // Path(s) to watch
  recursive?: boolean;             // Recursive watching (default: true)
  ignore?: string[];               // Ignore patterns (glob)
  backend?: string;                // @parcel/watcher backend
  debounceMs?: number;             // Debounce delay (default: 50ms)
  autoRetry?: boolean;             // Auto-retry on error (default: true)
  maxRetries?: number;             // Max retry attempts (default: 3)
  retryDelayMs?: number;           // Retry delay (default: 1000ms)
}
```

#### Methods

- `start()` - Start watching
- `stop()` - Stop watching
- `addPath(path)` - Add path to watch
- `removePath(path)` - Remove path from watch
- `getWatchedPaths()` - Get all watched paths

#### Events

- `'change'` - File change detected (FileChangeEvent)
- `'ready'` - Watcher is ready
- `'error'` - Error occurred
- `'close'` - Watcher closed

### HotReloadManager

#### Constructor Options

```typescript
interface HotReloadOptions {
  patterns?: string[];             // Patterns to watch (default: ['**/*.ts', '**/*.js', '**/*.json'])
  debounceMs?: number;             // Debounce delay (default: 100ms)
  onReload?: (changes) => void;    // Reload callback
  onError?: (error) => void;       // Error callback
}
```

#### Methods

- `start()` - Start hot reload
- `stop()` - Stop hot reload
- `forceReload()` - Force immediate reload
- `getPendingCount()` - Get pending changes count

#### Events

- `'reload'` - Reload triggered (FileChangeEvent[])
- `'start'` - Manager started
- `'stop'` - Manager stopped
- `'error'` - Error occurred

## Examples

### Basic File Watching

```typescript
const watcher = new FileWatcher({
  paths: '/path/to/watch',
  ignore: ['*.log', '*.tmp'],
});

watcher.on('change', (event) => {
  console.log(`[${event.type}] ${event.relativePath}`);
});

await watcher.start();
```

### Multi-Path Watching

```typescript
const watcher = new FileWatcher({
  paths: [
    '/path/to/skills',
    '/path/to/plugins',
    '/path/to/config',
  ],
  recursive: true,
});

await watcher.start();
```

### Hot Reload for Skills

```typescript
const watcher = new FileWatcher({
  paths: '/path/to/skills',
});

const hotReload = new HotReloadManager(watcher, {
  patterns: ['**/*.ts', '**/*.js'],
  onReload: async (changes) => {
    for (const change of changes) {
      // Clear module cache
      delete require.cache[require.resolve(change.path)];
      
      // Re-import
      const skill = await import(change.path);
      console.log(`Reloaded: ${change.relativePath}`);
    }
  },
});

await watcher.start();
hotReload.start();
```

### Plugin System with Hot Reload

```typescript
const watcher = new FileWatcher({
  paths: '/path/to/plugins',
  recursive: true,
});

const pluginRegistry = new Map();

const hotReload = new HotReloadManager(watcher, {
  patterns: ['**/plugin.ts', '**/index.ts'],
  onReload: async (changes) => {
    for (const change of changes) {
      const pluginId = change.relativePath.split('/')[0];
      
      switch (change.type) {
        case 'create':
        case 'update':
          // Unload old plugin
          if (pluginRegistry.has(pluginId)) {
            await pluginRegistry.get(pluginId).unload?.();
          }
          
          // Load new plugin
          const plugin = await import(change.path);
          await plugin.load?.();
          pluginRegistry.set(pluginId, plugin);
          break;
          
        case 'delete':
          // Unload deleted plugin
          if (pluginRegistry.has(pluginId)) {
            await pluginRegistry.get(pluginId).unload?.();
            pluginRegistry.delete(pluginId);
          }
          break;
      }
    }
  },
});

await watcher.start();
hotReload.start();
```

### Dynamic Path Management

```typescript
const watcher = new FileWatcher({
  paths: '/path/to/initial',
});

await watcher.start();

// Add new path
await watcher.addPath('/path/to/additional');

// Remove path
await watcher.removePath('/path/to/initial');

// Get current paths
const paths = watcher.getWatchedPaths();
```

### Error Handling and Retry

```typescript
const watcher = new FileWatcher({
  paths: '/path/to/watch',
  autoRetry: true,
  maxRetries: 5,
  retryDelayMs: 2000,
});

let errorCount = 0;

watcher.on('error', (error) => {
  errorCount++;
  console.error(`Error #${errorCount}:`, error);
  
  if (errorCount >= 3) {
    console.log('Too many errors, stopping');
    watcher.stop();
  }
});

watcher.on('ready', () => {
  console.log('Watcher recovered');
  errorCount = 0;
});

await watcher.start();
```

## Default Ignore Patterns

The watcher automatically ignores:

- `**/node_modules/**`
- `**/.git/**`
- `**/.next/**`
- `**/.cache/**`
- `**/dist/**`
- `**/build/**`
- `**/.turbo/**`
- `**/.vercel/**`
- `**/coverage/**`
- `**/.DS_Store`
- `**/*.log`
- `**/.env*`

## Architecture

### FileWatcher

The core watcher class manages file system monitoring:

1. **Subscription Management** - Each watched path has an independent @parcel/watcher subscription
2. **Event Processing** - Maps native events to standardized FileChangeEvent
3. **Debouncing** - Reduces noise from rapid file changes
4. **Error Recovery** - Automatic retry with exponential backoff
5. **State Management** - Tracks watcher state (idle/starting/active/error/closed)

### HotReloadManager

The hot reload manager adds pattern-based reload logic:

1. **Pattern Matching** - Filters changes by glob patterns
2. **Batch Processing** - Groups rapid changes into single reload
3. **Async Handlers** - Supports async reload callbacks
4. **Error Handling** - Catches and reports reload failures

## Performance

- **Native performance** - Uses platform-native file watching APIs
- **Minimal overhead** - Debouncing reduces event noise
- **Efficient batching** - Groups related changes
- **Low memory footprint** - Cleans up resources properly

## Testing

```bash
npm test
```

Tests cover:
- Basic file watching
- Event detection (create/update/delete)
- Recursive watching
- Ignore patterns
- Dynamic path management
- Debouncing
- Hot reload batching
- Error handling
- Force reload

## License

MIT
