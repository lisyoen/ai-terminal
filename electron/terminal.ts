import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import type { RunRequest, TerminalChunk, SnapshotReady, GroupedLlmSuggestion } from '../types/messages'
import { SnapshotManager } from './snapshotter'
import { CommandHistory } from './command-history'
import { SessionLogger } from './session-logger'
import { LlmClient } from './llm-client'
import { config } from './config'

interface ActiveCommand {
  id: string
  startTime: number
  request: RunRequest
  process?: ChildProcess
}

export class TerminalManager extends EventEmitter {
  // ...기존 필드 및 생성자 생략...

  private snapshotManager: SnapshotManager;
  private commandHistory: CommandHistory;
  private sessionLogger: SessionLogger;
  private llmClient: LlmClient;
  private activeCommand: ActiveCommand | null = null;
  private isReady = false;
  private powershellProcess: ChildProcess | null = null;
  private outputBuffer = ''; // Buffer to detect markers across chunks

  // ...기존 필드 및 생성자 선언부는 아래에 이미 있으므로 중복 제거...


  constructor() {
    super()
    this.snapshotManager = new SnapshotManager()
    this.commandHistory = new CommandHistory()
    this.sessionLogger = new SessionLogger()
    this.llmClient = new LlmClient()
    this.setupSnapshotManager()
    this.initializeTerminal()
    
    this.writeLog('INIT', 'Terminal manager initialized')
  }

  private writeLog(type: string, message: string, data?: any) {
    // 명령 입력/출력에 실제 입력값과 출력값을 남김
    let logId = 'terminal';
    let logMsg = message;
    let logData = { ...data };
    if (type === 'COMMAND_REQUEST' || type === 'COMMAND_START') {
      logId = 'command_input';
      logMsg = `[INPUT] ${message}`;
      // 입력창에 표시된 내용과 실제 입력값 모두 기록
      if (data?.cmd) logData.inputCmd = data.cmd;
      if (data?.originalCmd) logData.inputCmd = data.originalCmd;
      if (data?.translatedCmd) logData.translatedCmd = data.translatedCmd;
    }
    if (type === 'TERMINAL_OUTPUT') {
      logId = 'command_output';
      logMsg = `[OUTPUT] ${message}`;
      // 터미널에 찍힌 실제 출력값 기록
      if (data?.text) logData.outputText = data.text;
    }
    this.sessionLogger.logTerminalEvent(logId, type, logMsg, logData);
    
    // Also console log for immediate debugging
    console.log(`[${type}]`, message, data ? JSON.stringify(data) : '')
  }

  private translateKoreanCommand(cmd: string): string {
    const command = cmd.trim()
    
    // Korean command translations
    const koreanCommands: { [key: string]: string } = {
      // File operations
      '파일목록 보여줘': 'Get-ChildItem',
      '파일목록': 'Get-ChildItem',
      '목록': 'Get-ChildItem',
      '파일 목록': 'Get-ChildItem',
      '폴더 목록': 'Get-ChildItem',
      '디렉토리 목록': 'Get-ChildItem',
      'ls': 'Get-ChildItem',
      'dir': 'Get-ChildItem',
      
      // Navigation
      '현재 위치': 'Get-Location',
      '위치': 'Get-Location',
      '경로': 'Get-Location',
      '현재 경로': 'Get-Location',
      'pwd': 'Get-Location',
      
      // System info
      '사용자': 'whoami',
      '사용자 정보': 'whoami',
      '계정': 'whoami',
      '날짜': 'Get-Date',
      '시간': 'Get-Date',
      '현재 시간': 'Get-Date',
      'date': 'Get-Date',
      
      // Process info
      '프로세스': 'Get-Process',
      '프로세스 목록': 'Get-Process',
      'ps': 'Get-Process',
      
      // System info
      '시스템 정보': 'Get-ComputerInfo',
      '컴퓨터 정보': 'Get-ComputerInfo',
      
      // Help
      '도움말': 'Get-Help',
      '도움': 'Get-Help',
      'help': 'Get-Help',
      
      // History
      '히스토리': 'Get-History',
      '명령 기록': 'Get-History',
      '이력': 'Get-History',
      'history': 'Get-History'
    }
    
    // Check for exact match first
    if (koreanCommands[command]) {
      return koreanCommands[command]
    }
    
    // Check for partial matches (case insensitive)
    const lowerCommand = command.toLowerCase()
    for (const [korean, powershell] of Object.entries(koreanCommands)) {
      if (lowerCommand.includes(korean.toLowerCase())) {
        return powershell
      }
    }
    
    // If no translation found, return original command
    return command
  }

  private setupSnapshotManager() {
    this.snapshotManager.on('snapshot', (snapshot: SnapshotReady) => {
      this.emit('snapshot', snapshot)
    })

    this.snapshotManager.on('llmSuggestion', (suggestion: GroupedLlmSuggestion) => {
      this.emit('llmSuggestion', suggestion)
    })
  }

  private async initializeTerminal() {
    try {
      // Find PowerShell executable
      const powershellCmd = await this.findPowerShellExecutable()
      
      // 먼저 chcp 65001로 코드페이지 변경
      const chcp = spawn('cmd.exe', ['/c', 'chcp 65001'], { windowsHide: true });
      await new Promise((resolve) => chcp.on('exit', resolve));
      // Start PowerShell process
      this.powershellProcess = spawn(powershellCmd, [
        '-NoLogo',
        '-NoExit',
        '-Command',
        '[Console]::OutputEncoding = [Text.Encoding]::UTF8; [Console]::InputEncoding = [Text.Encoding]::UTF8'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true
      })

      this.setupPowerShellHandlers()
      this.isReady = true
      
    } catch (error) {
      this.emit('error', {
        id: 'terminal',
        message: `Failed to initialize terminal: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }

  private async findPowerShellExecutable(): Promise<string> {
    // Try pwsh.exe first (PowerShell 7+), then fall back to powershell.exe
    const candidates = ['pwsh.exe', 'powershell.exe']
    
    for (const cmd of candidates) {
      try {
        // Simple check - try to spawn and see if it works
        const testProcess = spawn(cmd, ['-Command', 'exit'], { 
          stdio: 'pipe',
          windowsHide: true 
        })
        
        await new Promise((resolve, reject) => {
          testProcess.on('exit', resolve)
          testProcess.on('error', reject)
          setTimeout(() => reject(new Error('timeout')), 2000)
        })
        
        return cmd
      } catch {
        continue
      }
    }
    
    throw new Error('No PowerShell executable found')
  }

  private setupPowerShellHandlers() {
    if (!this.powershellProcess) return

    this.powershellProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      // Pass entire output to handler which will parse and log appropriately
      this.handlePowerShellOutput(text);
    });

    this.powershellProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf8')
      this.handlePowerShellOutput(text)
    })

    this.powershellProcess.on('exit', (code) => {
      this.emit('error', {
        id: 'terminal',
        message: `PowerShell process exited with code ${code}`
      })
      this.isReady = false
      this.powershellProcess = null
    })

    this.powershellProcess.on('error', (error) => {
      this.emit('error', {
        id: 'terminal',
        message: `PowerShell process error: ${error.message}`
      })
      this.isReady = false
      this.powershellProcess = null
    })

    // Send initial welcome and setup - REMOVED
    // Let PowerShell handle its own prompt naturally
  }

  private handlePowerShellOutput(text: string) {
    const commandId = this.activeCommand?.id || 'terminal'
    
    // Add to buffer for marker detection (keep last 500 chars to catch split markers)
    this.outputBuffer += text
    if (this.outputBuffer.length > 500) {
      this.outputBuffer = this.outputBuffer.slice(-500)
    }
    
    // 중요: 출력 내용은 로그하지 않고 이벤트만 전달 (로그 과다 방지)
    // 대신 snapshot에서 전체 출력을 기록함
    
    // Filter out AI event markers from user display
    let filteredText = text
    if (text.includes('__AI_EVT__')) {
      // Remove lines containing AI event markers
      filteredText = text
        .split('\n')
        .filter(line => !line.includes('__AI_EVT__'))
        .join('\n')
      
      this.writeLog('FILTER', 'AI 이벤트 마커 필터링', {
        originalLength: text.length,
        filteredLength: filteredText.length
      })
      
      // If all text was filtered out, don't emit anything
      if (!filteredText.trim()) {
        this.snapshotManager.processOutput(text, this.activeCommand)
        return
      }
    }
    
    const chunk: TerminalChunk = {
      id: commandId,
      text: filteredText
    }
    
    this.emit('output', chunk)
    this.snapshotManager.processOutput(text, this.activeCommand)
    
    // Check for command completion marker - use buffer to catch split markers
    if (this.activeCommand && this.outputBuffer.includes(`__AI_EVT__:${this.activeCommand.id}:END:`)) {
      // Extract exit code from marker (handle both "END:0" and "END:" formats)
      const exitCodeMatch = this.outputBuffer.match(new RegExp(`__AI_EVT__:${this.activeCommand.id}:END:(\\d+)`))
      const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1]) : 0 // Default to 0 if no code
      
      // Update command history with exit code
      this.commandHistory.addCommand(
        this.activeCommand.id,
        this.activeCommand.request.cmd,
        this.activeCommand.request.target || 'local',
        this.activeCommand.request.cwd || process.cwd(),
        exitCode
      )
      
      this.activeCommand = null
      this.outputBuffer = '' // Clear buffer after command completes
    }
  }

  async executeCommand(request: RunRequest): Promise<{ success: boolean; error?: string }> {
    // 명령 입력값을 로그에 반드시 남김
    this.writeLog('COMMAND_REQUEST', 'Command execution requested', {
      id: request.id,
      cmd: request.cmd,
      inputText: request.cmd, // 입력창에 표시된 내용
      target: request.target,
      cwd: request.cwd,
      mode: request.mode
    })

    if (!this.isReady || !this.powershellProcess) {
      this.writeLog('COMMAND_ERROR', 'Terminal not ready')
      return { success: false, error: 'Terminal not ready' }
    }

    if (this.activeCommand) {
      this.writeLog('COMMAND_ERROR', 'Another command already running', {
        activeCommandId: this.activeCommand.id
      })
      return { success: false, error: 'Another command is already running' }
    }

    try {
      // Translate Korean commands to PowerShell
      const translatedCmd = this.translateKoreanCommand(request.cmd)
      this.activeCommand = {
        id: request.id,
        startTime: Date.now(),
        request: { ...request, cmd: translatedCmd }
      }
      // 명령 입력값(원본, 번역, 입력창 표시 내용) 모두 로그에 남김
      this.writeLog('COMMAND_START', 'Command execution started', {
        id: request.id,
        originalCmd: request.cmd,
        inputText: request.cmd,
        translatedCmd: translatedCmd,
        startTime: this.activeCommand.startTime
      })

      // Update snapshot manager context
      this.snapshotManager.setContext(request.target || 'local', request.cwd || process.cwd())

      // Add command to history (use original command for history)
      this.commandHistory.addCommand(
        request.id,
        request.cmd,
        request.target || 'local',
        request.cwd || process.cwd()
      )

      // Send translated command to PowerShell with completion marker
      const commandWithMarker = `${translatedCmd}; Write-Host "__AI_EVT__:${request.id}:END:$LASTEXITCODE"\n`
      
      if (this.powershellProcess.stdin && !this.powershellProcess.stdin.destroyed) {
        this.powershellProcess.stdin.write(commandWithMarker)
      } else {
        throw new Error('PowerShell stdin not available')
      }

      return { success: true }

    } catch (error) {
      this.activeCommand = null
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      this.emit('error', {
        id: request.id,
        message: errorMsg
      })
      return { success: false, error: errorMsg }
    }
  }

  // Called by snapshot manager when command completes
  onCommandComplete(id: string) {
    if (this.activeCommand && this.activeCommand.id === id) {
      this.activeCommand = null
    }
  }

  write(data: string) {
    if (this.powershellProcess && this.powershellProcess.stdin && !this.powershellProcess.stdin.destroyed) {
      this.powershellProcess.stdin.write(data)
    }
  }

  resize(_cols: number, _rows: number) {
    // PowerShell doesn't support PTY-style resize, but we could potentially
    // send a command to adjust the console buffer if needed
  }

  async runSshSingleShot(request: RunRequest): Promise<{ success: boolean; error?: string }> {
    try {
      // Parse SSH target from request (e.g., "ssh://user@host")
      const sshMatch = request.target?.match(/^ssh:\/\/(.+)$/)
      if (!sshMatch) {
        return { success: false, error: 'Invalid SSH target format' }
      }

      const sshTarget = sshMatch[1]
      
      // Update snapshot manager context
      this.snapshotManager.setContext(request.target, request.cwd || process.cwd())

      // Add command to history
      this.commandHistory.addCommand(
        request.id,
        request.cmd,
        request.target,
        request.cwd || process.cwd()
      )

      const scriptPath = path.join(__dirname, '..', 'scripts', 'pwsh', 'Invoke-AiSsh.ps1')
      
      // Execute SSH script
      const sshProcess = spawn('pwsh', [
        '-File', scriptPath,
        '-Id', request.id,
        '-Target', request.target,
        '-UserCmd', request.cmd
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })

      this.activeCommand = {
        id: request.id,
        startTime: Date.now(),
        request,
        process: sshProcess
      }
      // SSH 명령 실행 후 종료 마커 처리 (예시, 실제 종료 코드 필요시 이벤트에서 처리)

      sshProcess.on('error', (error: any) => {
        this.emit('error', {
          id: request.id,
          message: `SSH process error: ${error.message}`
        })
        this.activeCommand = null
      })

      return { success: true }

    } catch (error: any) {
      this.activeCommand = null
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      this.emit('error', {
        id: request.id,
        message: errorMsg
      })
      return { success: false, error: errorMsg }
    }
  }

  getRecentCommands(limit?: number): any[] {
    if (!this.commandHistory) return [];
    return this.commandHistory.getRecentCommands(limit ?? 20);
  }

  searchCommands(query: string, limit?: number): any[] {
    if (!this.commandHistory) return [];
    return this.commandHistory.searchCommands(query, limit ?? 10);
  }

  getPreviousCommand(currentCommand?: string): any {
    if (!this.commandHistory) return null;
    return this.commandHistory.getPreviousCommand(currentCommand ?? '');
  }

  getCommandsByTarget(target: string, limit?: number): any[] {
    if (!this.commandHistory) return [];
    return this.commandHistory.getCommandsByTarget(target, limit ?? 20);
  }

  /**
   * 사용자가 입력창에 명령을 입력할 때마다 로그에 남김
   */
  logUserInput(inputText: string) {
    console.log('[DEBUG] logUserInput called with:', inputText);
    this.writeLog('USER_INPUT', 'User entered command', {
      inputText: inputText
    });
  }

  /**
   * 사용자 질문을 GPT를 통해 PowerShell 명령으로 변환
   */
  async convertUserQuestion(userInput: string, context?: string): Promise<{ command: string; explanation: string } | null> {
    return this.llmClient.convertUserQuestion(userInput, context);
  }

  destroy() {
    if (this.powershellProcess) {
      this.powershellProcess.kill();
      this.powershellProcess = null;
    }
    // Ensure history is saved before destroying
    this.commandHistory.flush();
    this.snapshotManager.destroy();
  }
}
