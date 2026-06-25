/**
 * Sandbox Example
 *
 * 演示如何使用进程沙箱
 */

import { SandboxExecutor, ToolSandbox, type SandboxConfig } from './sandbox-executor';
import { WindowsJobObject, isWindowsJobObjectAvailable } from './windows-job-object';
import { createLogger } from '../utils/logger';

const logger = createLogger('SandboxExample');

/**
 * 示例：基础命令执行
 */
export async function exampleBasicExecution() {
  const executor = new SandboxExecutor();

  // 执行简单命令
  const result = await executor.execute('echo', ['Hello from sandbox!'], {
    timeout: 5000,
  });

  logger.info('Basic execution result:', {
    exitCode: result.exitCode,
    stdout: result.stdout.trim(),
    duration: result.duration,
  });
}

/**
 * 示例：资源限制
 */
export async function exampleResourceLimits() {
  const executor = new SandboxExecutor();

  const config: SandboxConfig = {
    timeout: 10000,
    maxMemoryMB: 256,
    maxCpuPercent: 50,
  };

  // Linux: 使用 systemd-run
  if (process.platform === 'linux') {
    const result = await executor.execute('sleep', ['2'], config);

    logger.info('Resource-limited execution:', {
      exitCode: result.exitCode,
      duration: result.duration,
    });
  } else {
    logger.info('Resource limits demo (platform-specific)');
  }
}

/**
 * 示例：超时处理
 */
export async function exampleTimeout() {
  const executor = new SandboxExecutor();

  // 执行耗时命令，但设置短超时
  const result = await executor.execute('sleep', ['10'], {
    timeout: 2000,
  });

  logger.info('Timeout result:', {
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    killed: result.killed,
    duration: result.duration,
  });

  if (result.timedOut) {
    logger.warn('Command was terminated due to timeout');
  }
}

/**
 * 示例：实时输出流
 */
export async function exampleStreamOutput() {
  const executor = new SandboxExecutor();

  // 监听实时输出
  executor.on('stdout', (data) => {
    process.stdout.write(`[STDOUT] ${data}`);
  });

  executor.on('stderr', (data) => {
    process.stderr.write(`[STDERR] ${data}`);
  });

  // 执行输出命令
  const result = await executor.execute('node', ['-e', 'console.log("Line 1"); console.error("Error 1"); console.log("Line 2");'], {
    timeout: 5000,
  });

  logger.info('Stream output result:', {
    exitCode: result.exitCode,
    duration: result.duration,
  });
}

/**
 * 示例：安全检查
 */
export async function exampleSecurityCheck() {
  const executor = new SandboxExecutor();

  const dangerousCommands = ['rm -rf /', 'del /f /s /q C:\\', 'format c:'];

  for (const cmd of dangerousCommands) {
    const [command, ...args] = cmd.split(' ');
    const allowed = executor.isCommandAllowed(command, {});

    logger.info(`Command "${cmd}":`, { allowed });
  }
}

/**
 * 示例：工具沙箱
 */
export async function exampleToolSandbox() {
  const sandbox = new ToolSandbox({
    timeout: 5000,
    maxMemoryMB: 256,
    allowNetwork: false,
  });

  // 监听输出
  sandbox.on('stdout', (data) => {
    logger.debug(`Tool output: ${data.trim()}`);
  });

  try {
    // 执行工具命令
    const result = await sandbox.executeToolCommand('node', [
      '-e',
      'console.log(JSON.stringify({ result: "success", data: [1, 2, 3] }))',
    ]);

    logger.info('Tool sandbox result:', {
      exitCode: result.exitCode,
      stdout: result.stdout.trim(),
    });
  } catch (error: any) {
    logger.error('Tool execution failed:', error.message);
  }
}

/**
 * 示例：Windows Job Object（仅 Windows）
 */
export async function exampleWindowsJobObject() {
  if (process.platform !== 'win32') {
    logger.info('Skipping Windows Job Object example (not on Windows)');
    return;
  }

  if (!isWindowsJobObjectAvailable()) {
    logger.warn('Windows Job Object not available');
    return;
  }

  try {
    const job = new WindowsJobObject();

    // 创建 Job Object
    if (!job.createJob('example-job')) {
      throw new Error('Failed to create job');
    }

    // 设置内存限制
    if (!job.setMemoryLimit(512)) {
      throw new Error('Failed to set memory limit');
    }

    // 分配当前进程（仅示例，实际应用中分配子进程）
    // job.assignCurrentProcess();

    logger.info('Windows Job Object created successfully');

    // 清理
    job.close();
  } catch (error: any) {
    logger.error('Windows Job Object example failed:', error);
  }
}

/**
 * 示例：路径白名单
 */
export async function examplePathWhitelist() {
  const executor = new SandboxExecutor();

  const config: SandboxConfig = {
    allowedPaths: ['/tmp', '/var/tmp'],
  };

  const testPaths = ['/tmp/test.txt', '/home/user/file.txt', '/var/tmp/data'];

  for (const path of testPaths) {
    const allowed = executor.isPathAllowed(path, config);
    logger.info(`Path "${path}":`, { allowed });
  }
}

/**
 * 运行所有示例
 */
export async function runAllSandboxExamples() {
  logger.info('=== Example 1: Basic Execution ===');
  await exampleBasicExecution();

  logger.info('\n=== Example 2: Resource Limits ===');
  await exampleResourceLimits();

  logger.info('\n=== Example 3: Timeout ===');
  await exampleTimeout();

  logger.info('\n=== Example 4: Stream Output ===');
  await exampleStreamOutput();

  logger.info('\n=== Example 5: Security Check ===');
  await exampleSecurityCheck();

  logger.info('\n=== Example 6: Tool Sandbox ===');
  await exampleToolSandbox();

  logger.info('\n=== Example 7: Windows Job Object ===');
  await exampleWindowsJobObject();

  logger.info('\n=== Example 8: Path Whitelist ===');
  await examplePathWhitelist();

  logger.info('\n=== All sandbox examples completed ===');
}

// 如果直接运行此文件
if (require.main === module) {
  runAllSandboxExamples().catch(error => {
    logger.error('Sandbox examples failed:', error);
    process.exit(1);
  });
}
