import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import type { RunRequest, TerminalChunk, SnapshotReady, LlmSuggestion } from '../types/messages'
import { SnapshotManager } from './snapshotter'
import { CommandHistory } from './command-history'
import { config } from './config'

interface ActiveCommand {
  id: string
  startTime: number
  request: RunRequest
  process?: ChildProcess
}

export class TerminalManager extends EventEmitter {
  private snapshotManager: SnapshotManager
  private commandHistory: CommandHistory
  private activeCommand: ActiveCommand | null = null
  private isReady = false
  private powershellProcess: ChildProcess | null = null

  constructor() {
    super()
    this.snapshotManager = new SnapshotManager()
    this.commandHistory = new CommandHistory()
    this.setupSnapshotManager()
    this.initializeTerminal()
  }

  private setupSnapshotManager() {
    this.snapshotManager.on('snapshot', (snapshot: SnapshotReady) => {
      this.emit('snapshot', snapshot)
    })

    this.snapshotManager.on('llmSuggestion', (suggestion: LlmSuggestion) => {
      this.emit('llmSuggestion', suggestion)
    })
  }

  private async initializeTerminal() {
    try {
      // Find PowerShell executable
      const powershellCmd = await this.findPowerShellExecutable()
      
      // Start PowerShell process
      this.powershellProcess = spawn(powershellCmd, [
        '-NoLogo',
        '-NoExit',
        '-Command',
        `$host.ui.RawUI.WindowTitle = 'AI Terminal'; function prompt { '${config.LOCAL_PROMPT_TOKEN}> ' }`
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
      const text = data.toString('utf8')
      this.handlePowerShellOutput(text)
    })

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

    // Send initial welcome and setup
    setTimeout(() => {
      const welcomeText = `AI Terminal PowerShell Session\n${config.LOCAL_PROMPT_TOKEN}> `
      const chunk: TerminalChunk = {
        id: 'terminal',
        text: welcomeText
      }
      this.emit('output', chunk)
    }, 500)
  }

  private handlePowerShellOutput(text: string) {
    const commandId = this.activeCommand?.id || 'terminal'
    
    const chunk: TerminalChunk = {
      id: commandId,
      text
    }
    
    this.emit('output', chunk)
    this.snapshotManager.processOutput(text, this.activeCommand)
    
    // Check for command completion marker
    if (this.activeCommand && text.includes(`__AI_EVT__:${this.activeCommand.id}:END:`)) {
      // Extract exit code from marker
      const exitCodeMatch = text.match(`__AI_EVT__:${this.activeCommand.id}:END:(\\d+)`)
      const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1]) : undefined
      
      // Update command history with exit code
      if (exitCode !== undefined) {
        this.commandHistory.addCommand(
          this.activeCommand.id,
          this.activeCommand.request.cmd,
          this.activeCommand.request.target || 'local',
          this.activeCommand.request.cwd || process.cwd(),
          exitCode
        )
      }
      
      this.activeCommand = null
    }
  }

  async executeCommand(request: RunRequest): Promise<{ success: boolean; error?: string }> {
    if (!this.isReady || !this.powershellProcess) {
      return { success: false, error: 'Terminal not ready' }
    }

    if (this.activeCommand) {
      return { success: false, error: 'Another command is already running' }
    }

    try {
      this.activeCommand = {
        id: request.id,
        startTime: Date.now(),
        request
      }

      // Update snapshot manager context
      this.snapshotManager.setContext(request.target || 'local', request.cwd || process.cwd())

      // Add command to history
      this.commandHistory.addCommand(
        request.id,
        request.cmd,
        request.target || 'local',
        request.cwd || process.cwd()
      )

      // Send command to PowerShell with completion marker
      const commandWithMarker = `${request.cmd}; Write-Host "__AI_EVT__:${request.id}:END:$LASTEXITCODE"\n`
      
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

      sshProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf8')
        this.handlePowerShellOutput(text)
      })

      sshProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf8')
        this.handlePowerShellOutput(text)
      })

      sshProcess.on('exit', (code) => {
        const endMarker = `__AI_EVT__:${request.id}:END:${code || 0}`
        this.handlePowerShellOutput(endMarker)
        this.activeCommand = null
      })

      sshProcess.on('error', (error) => {
        this.emit('error', {
          id: request.id,
          message: `SSH process error: ${error.message}`
        })
        this.activeCommand = null
      })

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

  // Command history methods
  getRecentCommands(limit: number = 20) {
    return this.commandHistory.getRecentCommands(limit)
  }

  searchCommands(query: string, limit: number = 10) {
    return this.commandHistory.searchCommands(query, limit)
  }

  getPreviousCommand(currentCommand: string = '') {
    return this.commandHistory.getPreviousCommand(currentCommand)
  }

  getCommandsByTarget(target: string, limit: number = 20) {
    return this.commandHistory.getCommandsByTarget(target, limit)
  }

  destroy() {
    if (this.powershellProcess) {
      this.powershellProcess.kill()
      this.powershellProcess = null
    }
    // Ensure history is saved before destroying
    this.commandHistory.flush()
    this.snapshotManager.destroy()
  }
}