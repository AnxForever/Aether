/**
 * Windows Job Object - Process isolation on Windows
 *
 * 使用 koffi FFI 调用 Windows Job Object API 实现进程隔离
 */

import koffi from 'koffi';
import { createLogger } from '../utils/logger';

const logger = createLogger('WindowsJobObject');

// Windows API 类型定义
const HANDLE = koffi.pointer('HANDLE', koffi.opaque());
const DWORD = 'uint32';
const BOOL = 'int32';
const LPVOID = koffi.pointer('LPVOID', koffi.opaque());

// Job Object 限制标志
const JOB_OBJECT_LIMIT_PROCESS_TIME = 0x00000002;
const JOB_OBJECT_LIMIT_PROCESS_MEMORY = 0x00000100;
const JOB_OBJECT_LIMIT_JOB_MEMORY = 0x00000200;
const JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION = 0x00000400;
const JOB_OBJECT_LIMIT_BREAKAWAY_OK = 0x00000800;
const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;

/**
 * JOBOBJECT_BASIC_LIMIT_INFORMATION 结构体
 */
const JOBOBJECT_BASIC_LIMIT_INFORMATION = koffi.struct('JOBOBJECT_BASIC_LIMIT_INFORMATION', {
  PerProcessUserTimeLimit: 'int64',
  PerJobUserTimeLimit: 'int64',
  LimitFlags: DWORD,
  MinimumWorkingSetSize: 'size_t',
  MaximumWorkingSetSize: 'size_t',
  ActiveProcessLimit: DWORD,
  Affinity: 'size_t',
  PriorityClass: DWORD,
  SchedulingClass: DWORD,
});

/**
 * IO_COUNTERS 结构体
 */
const IO_COUNTERS = koffi.struct('IO_COUNTERS', {
  ReadOperationCount: 'uint64',
  WriteOperationCount: 'uint64',
  OtherOperationCount: 'uint64',
  ReadTransferCount: 'uint64',
  WriteTransferCount: 'uint64',
  OtherTransferCount: 'uint64',
});

/**
 * JOBOBJECT_EXTENDED_LIMIT_INFORMATION 结构体
 */
const JOBOBJECT_EXTENDED_LIMIT_INFORMATION = koffi.struct(
  'JOBOBJECT_EXTENDED_LIMIT_INFORMATION',
  {
    BasicLimitInformation: JOBOBJECT_BASIC_LIMIT_INFORMATION,
    IoInfo: IO_COUNTERS,
    ProcessMemoryLimit: 'size_t',
    JobMemoryLimit: 'size_t',
    PeakProcessMemoryUsed: 'size_t',
    PeakJobMemoryUsed: 'size_t',
  }
);

// Job Object 信息类型
const JobObjectExtendedLimitInformation = 9;

/**
 * Windows Job Object 管理器
 */
export class WindowsJobObject {
  private kernel32: any;
  private jobHandle: any = null;

  constructor() {
    if (process.platform !== 'win32') {
      throw new Error('WindowsJobObject only works on Windows');
    }

    try {
      // 加载 kernel32.dll
      this.kernel32 = koffi.load('kernel32.dll');

      // 定义函数签名
      this.defineApiFunctions();

      logger.info('Windows Job Object initialized');
    } catch (error: any) {
      logger.error('Failed to initialize Windows Job Object:', error as Error);
      throw error;
    }
  }

  /**
   * 定义 Windows API 函数
   */
  private defineApiFunctions(): void {
    // CreateJobObjectW
    this.kernel32.CreateJobObjectW = this.kernel32.func(
      'CreateJobObjectW',
      HANDLE,
      [LPVOID, 'str16']
    );

    // AssignProcessToJobObject
    this.kernel32.AssignProcessToJobObject = this.kernel32.func(
      'AssignProcessToJobObject',
      BOOL,
      [HANDLE, HANDLE]
    );

    // SetInformationJobObject
    this.kernel32.SetInformationJobObject = this.kernel32.func(
      'SetInformationJobObject',
      BOOL,
      [HANDLE, DWORD, LPVOID, DWORD]
    );

    // CloseHandle
    this.kernel32.CloseHandle = this.kernel32.func('CloseHandle', BOOL, [HANDLE]);

    // OpenProcess
    this.kernel32.OpenProcess = this.kernel32.func('OpenProcess', HANDLE, [
      DWORD,
      BOOL,
      DWORD,
    ]);

    // GetCurrentProcess
    this.kernel32.GetCurrentProcess = this.kernel32.func(
      'GetCurrentProcess',
      HANDLE,
      []
    );
  }

  /**
   * 创建 Job Object
   */
  createJob(name?: string): boolean {
    try {
      this.jobHandle = this.kernel32.CreateJobObjectW(null, name || null);

      if (!this.jobHandle || this.jobHandle === 0) {
        logger.error('Failed to create job object');
        return false;
      }

      logger.info(`Job object created: ${name || 'anonymous'}`);
      return true;
    } catch (error: any) {
      logger.error('CreateJobObject failed:', error as Error);
      return false;
    }
  }

  /**
   * 设置内存限制
   */
  setMemoryLimit(limitMB: number): boolean {
    if (!this.jobHandle) {
      logger.error('Job handle is null');
      return false;
    }

    try {
      const limitInfo = {
        BasicLimitInformation: {
          PerProcessUserTimeLimit: 0,
          PerJobUserTimeLimit: 0,
          LimitFlags: JOB_OBJECT_LIMIT_PROCESS_MEMORY | JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
          MinimumWorkingSetSize: 0,
          MaximumWorkingSetSize: 0,
          ActiveProcessLimit: 0,
          Affinity: 0,
          PriorityClass: 0,
          SchedulingClass: 0,
        },
        IoInfo: {
          ReadOperationCount: 0,
          WriteOperationCount: 0,
          OtherOperationCount: 0,
          ReadTransferCount: 0,
          WriteTransferCount: 0,
          OtherTransferCount: 0,
        },
        ProcessMemoryLimit: limitMB * 1024 * 1024,
        JobMemoryLimit: limitMB * 1024 * 1024,
        PeakProcessMemoryUsed: 0,
        PeakJobMemoryUsed: 0,
      };

      const buffer = koffi.alloc(JOBOBJECT_EXTENDED_LIMIT_INFORMATION, limitInfo as any);

      const result = this.kernel32.SetInformationJobObject(
        this.jobHandle,
        JobObjectExtendedLimitInformation,
        buffer,
        koffi.sizeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION)
      );

      if (!result) {
        logger.error('Failed to set memory limit');
        return false;
      }

      logger.info(`Memory limit set: ${limitMB} MB`);
      return true;
    } catch (error: any) {
      logger.error('SetMemoryLimit failed:', error as Error);
      return false;
    }
  }

  /**
   * 将进程分配到 Job Object
   */
  assignProcess(processHandle: any): boolean {
    if (!this.jobHandle) {
      logger.error('Job handle is null');
      return false;
    }

    try {
      const result = this.kernel32.AssignProcessToJobObject(
        this.jobHandle,
        processHandle
      );

      if (!result) {
        logger.error('Failed to assign process to job');
        return false;
      }

      logger.debug('Process assigned to job');
      return true;
    } catch (error: any) {
      logger.error('AssignProcessToJobObject failed:', error as Error);
      return false;
    }
  }

  /**
   * 将当前进程分配到 Job Object
   */
  assignCurrentProcess(): boolean {
    try {
      const currentProcess = this.kernel32.GetCurrentProcess();
      return this.assignProcess(currentProcess);
    } catch (error: any) {
      logger.error('AssignCurrentProcess failed:', error as Error);
      return false;
    }
  }

  /**
   * 打开进程句柄
   */
  openProcess(pid: number): any {
    try {
      const PROCESS_ALL_ACCESS = 0x1fffff;
      const handle = this.kernel32.OpenProcess(PROCESS_ALL_ACCESS, 0, pid);

      if (!handle || handle === 0) {
        logger.error(`Failed to open process: ${pid}`);
        return null;
      }

      return handle;
    } catch (error: any) {
      logger.error('OpenProcess failed:', error as Error);
      return null;
    }
  }

  /**
   * 关闭 Job Object
   */
  close(): void {
    if (this.jobHandle) {
      try {
        this.kernel32.CloseHandle(this.jobHandle);
        logger.info('Job object closed');
      } catch (error: any) {
        logger.error('CloseHandle failed:', error as Error);
      }
      this.jobHandle = null;
    }
  }
}

/**
 * 检查 Windows Job Object 是否可用
 */
export function isWindowsJobObjectAvailable(): boolean {
  if (process.platform !== 'win32') {
    return false;
  }

  try {
    const job = new WindowsJobObject();
    const created = job.createJob('test-job');
    job.close();
    return created;
  } catch {
    return false;
  }
}
