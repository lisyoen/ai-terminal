/* electron/main.ts
   Electron Main Process Entry
   - preload는 import하지 않는다! (preload.ts는 별도 번들로 실행됨)
   - BrowserWindow.webPreferences.preload 경로만 설정
*/

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { TerminalManager } from './terminal';

class App {
  private mainWindow: BrowserWindow | null = null;
  private terminalManager: TerminalManager;

  constructor() {
    this.terminalManager = new TerminalManager();
    this.registerIpcHandlers();
    this.forwardTerminalEvents();
  }

  async init() {
    await app.whenReady();
    this.createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on('window-all-closed', () => {
      // Windows에서도 모든 창 닫히면 종료
      app.quit();
    });
  }

  private createWindow() {
    // __dirname = dist/electron/electron
    const preloadPath = path.join(__dirname, 'preload.js');

    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: true,
    });

    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl && devUrl.startsWith('http')) {
      this.mainWindow.loadURL(devUrl);
      // 개발 모드에서만 자동 오픈(필요 시 주석 해제)
      // this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
      // dist/electron/electron → ../../index.html = dist/index.html
      const indexHtml = path.join(__dirname, '../../index.html');
      this.mainWindow.loadFile(indexHtml);
      // 프로덕션에선 DevTools 자동 열지 않음
    }
  }

  private registerIpcHandlers() {
    // 실행 요청
    ipcMain.handle('run', async (_evt, request) => {
      // request.target 이 ssh:// 로 시작하면 SSH 단발 실행, 아니면 로컬 실행
      if (typeof request?.target === 'string' && /^ssh:\/\//i.test(request.target)) {
        return this.terminalManager.runSshSingleShot(request);
      }
      return this.terminalManager.executeCommand(request);
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
  }

  private forwardTerminalEvents() {
    const send = (channel: string, payload: any) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(channel, payload);
      }
    };

    this.terminalManager.on('output', (chunk) => {
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

const appInstance = new App();
appInstance.init().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[Main] Failed to initialize app:', err);
});
