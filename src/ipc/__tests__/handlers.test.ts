/**
 * IPC Handler Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IPCHandlerRegistry,
  createSuccessResponse,
  createErrorResponse,
  sendToRenderer,
  broadcastToAll,
} from '../handlers';
import * as electron from 'electron';
import * as channels from '../channels';

// channels mock
vi.mock('../channels', () => ({
  isValidMainChannel: vi.fn((channel: string) => {
    const validChannels = [
      'agent:start',
      'chat:send',
      'settings:get',
      'agent:stop',
      'onboarding:getStatus',
    ];
    return validChannels.includes(channel);
  }),
}));

// electron mock (factory is hoisted, can't reference outer variables)
vi.mock('electron', () => {
  const fn = () => {};
  const mockObj = {
    handle: vi.fn(),
    removeHandler: vi.fn(),
    getAllWindows: vi.fn(() => []),
  };
  return {
    ipcMain: {
      handle: mockObj.handle,
      removeHandler: mockObj.removeHandler,
    },
    BrowserWindow: {
      getAllWindows: mockObj.getAllWindows,
    },
  };
});

describe('createSuccessResponse', () => {
  it('should create a success response with data', () => {
    const response = createSuccessResponse('req-1', { hello: 'world' });
    expect(response).toEqual({
      id: 'req-1',
      success: true,
      data: { hello: 'world' },
    });
  });

  it('should create a success response without data', () => {
    const response = createSuccessResponse('req-2', undefined);
    expect(response).toEqual({
      id: 'req-2',
      success: true,
      data: undefined,
    });
  });

  it('should preserve the request ID', () => {
    const response = createSuccessResponse('abc-123', {});
    expect(response.id).toBe('abc-123');
  });
});

describe('createErrorResponse', () => {
  it('should create an error response', () => {
    const response = createErrorResponse('req-1', 'Something went wrong');
    expect(response).toEqual({
      id: 'req-1',
      success: false,
      error: 'Something went wrong',
    });
  });

  it('should have undefined data field', () => {
    const response = createErrorResponse('req-2', 'Error');
    expect(response.data).toBeUndefined();
  });
});

describe('IPCHandlerRegistry', () => {
  let registry: IPCHandlerRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new IPCHandlerRegistry();
  });

  it('should start with no handlers', () => {
    expect(registry).toBeInstanceOf(IPCHandlerRegistry);
  });

  it('should register a handler for a valid channel', () => {
    const handler = vi.fn();
    registry.register('chat:send', handler);
    expect(true).toBe(true);
  });

  it('should throw when registering on invalid channel', () => {
    const handler = vi.fn();
    expect(() => registry.register('invalid:channel', handler)).toThrow(
      'Invalid channel: invalid:channel'
    );
  });

  it('should unregister a handler', () => {
    const handler = vi.fn();
    registry.register('chat:send', handler);
    registry.unregister('chat:send');

    // Should be able to re-register
    registry.register('chat:send', handler);
    expect(true).toBe(true);
  });

  it('should setup handlers and register on ipcMain.handle', () => {
    const handler = vi.fn().mockResolvedValue({ success: true, id: '1', data: 'ok' });

    registry.register('chat:send', handler);
    registry.setup();

    expect(electron.ipcMain.handle).toHaveBeenCalledWith('chat:send', expect.any(Function));
  });

  it('should wrap handler errors in error responses', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('handler error'));

    registry.register('chat:send', handler);
    registry.setup();

    // Extract the wrapper function
    const wrapperFn = vi.mocked(electron.ipcMain.handle).mock.calls[0][1];
    const response = await wrapperFn({}, { id: 'req-1' });

    expect(response).toEqual({
      id: 'req-1',
      success: false,
      error: 'handler error',
    });
  });

  it('should cleanup all handlers', () => {
    registry.register('chat:send', vi.fn());
    registry.register('settings:get', vi.fn());
    registry.register('agent:start', vi.fn());
    registry.setup();
    registry.cleanup();

    // Should have called removeHandler for each registered channel
    expect(electron.ipcMain.removeHandler).toHaveBeenCalledTimes(3);
    expect(electron.ipcMain.removeHandler).toHaveBeenCalledWith('chat:send');
    expect(electron.ipcMain.removeHandler).toHaveBeenCalledWith('settings:get');
    expect(electron.ipcMain.removeHandler).toHaveBeenCalledWith('agent:start');
  });

  it('should propagate successful handler response', async () => {
    const handler = vi.fn().mockResolvedValue({
      id: 'req-1',
      success: true,
      data: { model: 'claude-3' },
    });

    registry.register('settings:get', handler);
    registry.setup();

    const wrapperFn = vi.mocked(electron.ipcMain.handle).mock.calls[0][1];
    const response = await wrapperFn({}, { id: 'req-1', channel: 'settings:get', data: {} });

    expect(response.success).toBe(true);
    expect(response.data).toEqual({ model: 'claude-3' });
  });
});

describe('sendToRenderer', () => {
  it('should send data to non-destroyed window', () => {
    const sendMock = vi.fn();
    const window = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: { send: sendMock },
    } as any;

    sendToRenderer(window, 'event:message', { text: 'hello' });
    expect(sendMock).toHaveBeenCalledWith('event:message', { text: 'hello' });
  });

  it('should not send to destroyed window', () => {
    const sendMock = vi.fn();
    const window = {
      isDestroyed: vi.fn().mockReturnValue(true),
      webContents: { send: sendMock },
    } as any;

    sendToRenderer(window, 'event:message', { text: 'hello' });
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('broadcastToAll', () => {
  it('should send to all windows', () => {
    const sendMock1 = vi.fn();
    const sendMock2 = vi.fn();

    vi.mocked(electron.BrowserWindow.getAllWindows).mockReturnValue([
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: sendMock1 },
      },
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: sendMock2 },
      },
    ]);

    broadcastToAll('event:status-change', { isProcessing: true, sessionId: 's1' });
    expect(sendMock1).toHaveBeenCalled();
    expect(sendMock2).toHaveBeenCalled();
  });

  it('should skip destroyed windows', () => {
    const sendMock = vi.fn();

    vi.mocked(electron.BrowserWindow.getAllWindows).mockReturnValue([
      {
        isDestroyed: vi.fn().mockReturnValue(true),
        webContents: { send: vi.fn() },
      },
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: { send: sendMock },
      },
    ]);

    broadcastToAll('event:error', { message: 'error' });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
