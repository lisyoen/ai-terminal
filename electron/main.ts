import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { validateMessage } from '../types/messages'
import { TerminalManager } from './terminal'

const isDev = process.env.NODE_ENV === 'development'
const autoUpdateEnabled = process.env.AUTO_UPDATE === 'true'

// Optional auto-updater import
let autoUpdater: any = null
if (autoUpdateEnabled && !isDev) {
  try {
    const { autoUpdater: updater } = require('electron-updater')
    autoUpdater = updater
  } catch (error) {
    console.warn('electron-updater not available:', error)
  }
}

class App {
  private mainWindow: BrowserWindow | null = null
  private terminalManager: TerminalManager

  constructor() {
    this.terminalManager = new TerminalManager()
    this.setupApp()
    this.setupIPC()
    this.setupAutoUpdater()
  }

  private setupApp() {
    // Quit when all windows are closed, except on macOS
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    app.on('activate', () => {
      // On macOS, re-create a window in the app when the dock icon is clicked
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow()
      }
    })

    app.whenReady().then(() => {
      this.createWindow()
      this.setupMenu()
    })
  }

  private createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false // Required for node-pty
      }
    })

    // Load the app
    if (process.env.VITE_DEV_SERVER_URL) {
      this.mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
      // DevTools can be opened manually with F12 or Ctrl+Shift+I
      // this.mainWindow.webContents.openDevTools()
    } else {
      this.mainWindow.loadFile(join(__dirname, '../index.html'))
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })
  }

  private setupIPC() {
    // Handle run command requests (local or SSH)
    ipcMain.handle('run', async (_event, data) => {
      try {
        const request = validateMessage.runRequest(data)
        
        let response
        if (request.target && request.target.startsWith('ssh://')) {
          // SSH execution
          response = await this.terminalManager.runSshSingleShot(request)
        } else {
          // Local execution
          response = await this.terminalManager.executeCommand(request)
        }
        
        return response
      } catch (error) {
        console.error('Error in run handler:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    // Handle command history requests
    ipcMain.handle('history:recent', async (_, limit: number = 20) => {
      try {
        return this.terminalManager.getRecentCommands(limit)
      } catch (error) {
        console.error('Error getting recent commands:', error)
        return []
      }
    })

    ipcMain.handle('history:search', async (_, query: string, limit: number = 10) => {
      try {
        return this.terminalManager.searchCommands(query, limit)
      } catch (error) {
        console.error('Error searching commands:', error)
        return []
      }
    })

    ipcMain.handle('history:previous', async (_, currentCommand: string = '') => {
      try {
        return this.terminalManager.getPreviousCommand(currentCommand)
      } catch (error) {
        console.error('Error getting previous command:', error)
        return null
      }
    })

    // Set up terminal output forwarding
    this.terminalManager.on('output', (chunk) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('terminal:chunk', chunk)
      }
    })

    this.terminalManager.on('snapshot', (snapshot) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('snapshot:ready', snapshot)
      }
    })

    this.terminalManager.on('llmSuggestion', (suggestion) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('llm:suggestion', suggestion)
      }
    })

    this.terminalManager.on('error', (error) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('error', error)
      }
    })
  }

  private setupMenu() {
    const template: any[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit()
            }
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Reload',
            accelerator: 'CmdOrCtrl+R',
            click: (item: any, focusedWindow: BrowserWindow) => {
              if (focusedWindow) focusedWindow.reload()
            }
          },
          {
            label: 'Toggle Developer Tools',
            accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
            click: (item: any, focusedWindow: BrowserWindow) => {
              if (focusedWindow) focusedWindow.webContents.toggleDevTools()
            }
          }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About',
            click: () => {
              // Show about dialog
            }
          }
        ]
      }
    ]

    // Add update menu item if auto-update is enabled
    if (autoUpdateEnabled && autoUpdater) {
      template[2].submenu.push({
        type: 'separator'
      }, {
        label: 'Check for Updates...',
        click: () => {
          this.checkForUpdates()
        }
      })
    }

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  private setupAutoUpdater() {
    if (!autoUpdateEnabled || !autoUpdater || isDev) {
      console.log('Auto-updater disabled')
      return
    }

    // Configure auto-updater
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'lisyoen',
      repo: 'ai-terminal',
      private: false
    })

    // Auto-updater events
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...')
    })

    autoUpdater.on('update-available', (info: any) => {
      console.log('Update available:', info)
    })

    autoUpdater.on('update-not-available', (info: any) => {
      console.log('Update not available:', info)
    })

    autoUpdater.on('error', (err: any) => {
      console.error('Error in auto-updater:', err)
    })

    autoUpdater.on('download-progress', (progressObj: any) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond
      log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
      log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')'
      console.log(log_message)
    })

    autoUpdater.on('update-downloaded', (info: any) => {
      console.log('Update downloaded:', info)
      autoUpdater.quitAndInstall()
    })
  }

  private checkForUpdates() {
    if (autoUpdater) {
      autoUpdater.checkForUpdatesAndNotify()
    }
  }
}

// Create the app instance
new App()