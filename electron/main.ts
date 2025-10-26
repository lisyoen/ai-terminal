/* electron/main.ts
   Electron Main Process Entry
   - preload는 import하지 않는다! (preload.ts는 별도 번들로 실행됨)
   - BrowserWindow.webPreferences.preload 경로만 설정
*/

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { TerminalManager } from './terminal';

class App {
  public mainWindow: BrowserWindow | null = null;
  private terminalManager: TerminalManager;

  constructor() {
    this.terminalManager = new TerminalManager();
    this.registerIpcHandlers();
    // forwardTerminalEvents는 창 생성 후에 호출해야 함
  }

  async init() {
    await app.whenReady();
    // Singleton guard: only create window if none exist and mainWindow is null
    if (BrowserWindow.getAllWindows().filter(win => !win.isDestroyed()).length === 0 && !this.mainWindow) {
      console.log('[Main] Creating main window...');
      this.createWindow();
      // 창 생성 후 이벤트 포워딩 시작
      this.forwardTerminalEvents();
    } else {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.focus();
      }
      console.warn('[Main] Window already exists, skipping creation.');
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && !this.mainWindow) {
        this.createWindow();
      } else if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.focus();
      }
    });

    app.on('window-all-closed', () => {
      app.quit();
      process.exit(0);
    });
  }

  public createWindow() {
    // __dirname = dist/electron/electron
    const preloadPath = path.join(__dirname, 'preload.js');

    // 이미 창이 있으면 새로 만들지 않음 (정확하게 0개일 때만 생성)
    // Singleton guard for Electron window creation
    if (!(globalThis as any).__AI_TERMINAL_WINDOW_CREATED) {
      (globalThis as any).__AI_TERMINAL_WINDOW_CREATED = false;
    }
    if ((globalThis as any).__AI_TERMINAL_WINDOW_CREATED) {
      console.warn('[Main] 이미 창이 열려 있어 추가 창 생성을 방지합니다.');
      return;
    }
    (globalThis as any).__AI_TERMINAL_WINDOW_CREATED = true;
    console.log('[Main] 창 생성 시작');
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: true, // Buffer 오류 해결을 위해 활성화
        sandbox: false,
      },
      show: true,
    });

    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl && devUrl.startsWith('http')) {
      this.mainWindow.loadURL(devUrl);
      // 개발 모드에서만 DevTools 자동 열기
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      // dist/electron/electron → ../index.html = dist/index.html
      const indexHtml = path.join(__dirname, '../index.html');
      // dist/electron/electron에서 dist/index.html로 이동
      const distIndexHtml = path.resolve(__dirname, '../../index.html');
      this.mainWindow.loadFile(distIndexHtml);
      // 프로덕션에서는 DevTools 열지 않음
    }
  }

  private registerIpcHandlers() {
    // 실행 요청
    ipcMain.handle('run', async (_evt, request) => {
      if (typeof request?.target === 'string' && /^ssh:\/\//i.test(request.target)) {
        return this.terminalManager.runSshSingleShot(request);
      }
      return this.terminalManager.executeCommand(request);
    });

    // 입력값 로그 남기기
    ipcMain.handle('logUserInput', async (_evt, inputText: string) => {
      this.terminalManager.logUserInput(inputText);
      return true;
    });

    // 히스토리: 최근
    ipcMain.handle('history:recent', async (_evt, limit: number = 20) => {
      return this.terminalManager.getRecentCommands(limit);
    });

    // 히스토리: 검색
    ipcMain.handle('history:search', async (_evt, query: string, limit: number = 10) => {
      return this.terminalManager.searchCommands(query, limit);
    });

    // 히스토리: 이전 명령
    ipcMain.handle('history:previous', async (_evt, currentCommand: string) => {
      return this.terminalManager.getPreviousCommand(currentCommand);
    });

    // LLM: 자연어를 PowerShell 명령으로 변환 (deprecated - now handled by AI suggestions)
    ipcMain.handle('llm:convert', async (_evt, data: { userInput: string, context: string }) => {
      try {
        const result = await this.terminalManager.convertUserQuestion(data.userInput, data.context);
        return result;
      } catch (error) {
        console.error('[Main] llm:convert error:', error);
        return null;
      }
    });
  }

  private forwardTerminalEvents() {
    const send = (channel: string, payload: any) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        console.log(`[Main] Forwarding event: ${channel}`, payload);
        this.mainWindow.webContents.send(channel, payload);
      } else {
        console.warn(`[Main] Cannot forward ${channel}: window not ready`);
      }
    };

    this.terminalManager.on('output', (chunk) => {
      console.log('[Main] Terminal output event received:', chunk);
      send('terminal:chunk', chunk);
    });

    this.terminalManager.on('snapshot', (snapshot) => {
      send('snapshot:ready', snapshot);
    });

    this.terminalManager.on('llmSuggestion', (suggestion) => {
      send('llm:suggestion', suggestion);
    });

    this.terminalManager.on('error', (err) => {
      send('error', { message: String(err?.message || err) });
    });
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  const appInstance = new App();
  
  app.on('second-instance', () => {
    if (appInstance.mainWindow) {
      const win = appInstance.mainWindow;
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  appInstance.init().catch((err) => {
    console.error('[Main] Failed to initialize app:', err);
  });
}
