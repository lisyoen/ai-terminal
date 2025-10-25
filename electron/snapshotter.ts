import { EventEmitter } from 'events'
import type { SnapshotReady, SnapshotSummary } from '../types/messages'
import { Redactor } from './redact'
import { LlmClient } from './llm-client'
import { SessionLogger } from './session-logger'
import { config } from './config'

interface ActiveCommand {
  id: string
  startTime: number
  request: any
}

export class SnapshotManager extends EventEmitter {
  private tailBuffer: string[] = []
  // private lastOutputAt = 0  // TODO: Use for timeout calculations
  private bytesSinceSnapshot = 0
  private timeoutHandle: any = null
  private llmClient: LlmClient
  private sessionLogger: SessionLogger
  private currentTarget: string = 'local'
  private currentCwd: string = process.cwd()

  constructor() {
    super()
    this.llmClient = new LlmClient()
    this.sessionLogger = new SessionLogger()
  }

  setContext(target: string, cwd: string) {
    this.currentTarget = target
    this.currentCwd = cwd
  }

  processOutput(data: string, activeCommand?: ActiveCommand | null) {
    // this.lastOutputAt = Date.now()  // TODO: Implement timeout functionality
    this.bytesSinceSnapshot += Buffer.byteLength(data, 'utf8')
    
    // Add to tail buffer
    const lines = data.split('\n')
    this.tailBuffer.push(...lines)
    
    // Keep only last N lines
    if (this.tailBuffer.length > config.TAIL_N) {
      this.tailBuffer = this.tailBuffer.slice(-config.TAIL_N)
    }

    // Check for event markers
    this.checkForEvents(data, activeCommand)
    
    // Check for volume-based snapshot
    if (this.bytesSinceSnapshot > config.MAX_BYTES_PER_STEP) {
      this.createSnapshot('onVolume', activeCommand)
    }

    // Set/reset timeout for quiet period
    this.resetQuietTimeout(activeCommand)
  }

  private checkForEvents(data: string, activeCommand?: ActiveCommand | null) {
    const lines = data.split('\n')
    
    for (const line of lines) {
      // Check for command completion
      const endMatch = line.match(new RegExp(`${config.EVENT_MARKERS.END}:(\\w+):END:(\\d+)`))
      if (endMatch) {
        const [, , exitCode] = endMatch
        this.createSnapshot('onExit', activeCommand, {
          exitCode: parseInt(exitCode),
          elapsedMs: activeCommand ? Date.now() - activeCommand.startTime : 0,
          bytes: this.bytesSinceSnapshot
        })
        return
      }

      // Check for prompt (command ready state)
      if (line.trim() === config.LOCAL_PROMPT_TOKEN + '>' || 
          line.trim() === config.REMOTE_PROMPT_TOKEN + '>') {
        if (!activeCommand) { // Only trigger if no active command
          this.createSnapshot('onPrompt', null)
        }
        return
      }

      // Check for errors
      if (this.containsError(line)) {
        this.createSnapshot('onError', activeCommand, {
          elapsedMs: activeCommand ? Date.now() - activeCommand.startTime : 0,
          bytes: this.bytesSinceSnapshot
        })
        return
      }
    }
  }

  private containsError(line: string): boolean {
    return config.ERROR_PATTERNS.some(pattern => pattern.test(line))
  }

  private resetQuietTimeout(activeCommand?: ActiveCommand | null) {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
    }

    if (activeCommand) {
      this.timeoutHandle = setTimeout(() => {
        this.createSnapshot('onTimeout', activeCommand, {
          elapsedMs: Date.now() - activeCommand.startTime,
          bytes: this.bytesSinceSnapshot
        })
      }, config.QUIET_TIMEOUT)
    }
  }

  private async createSnapshot(
    trigger: SnapshotReady['trigger'], 
    activeCommand?: ActiveCommand | null,
    partialSummary?: Partial<SnapshotSummary>
  ) {
    // Clear timeout
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }

    // Prepare tail content
    const rawTail = this.tailBuffer.join('\n')
    const { clean: tail, redactions } = Redactor.redact(rawTail)

    // Create summary
    const summary: SnapshotSummary = {
      elapsedMs: partialSummary?.elapsedMs || 0,
      bytes: partialSummary?.bytes || this.bytesSinceSnapshot,
      ...partialSummary
    }

    // Create snapshot
    const snapshot: SnapshotReady = {
      id: activeCommand?.id || 'system',
      trigger,
      summary,
      tail,
      redactions
    }

    // Log snapshot to session logger before emitting
    this.sessionLogger.appendSnapshot(snapshot, this.currentTarget, this.currentCwd)

    // Emit snapshot event
    this.emit('snapshot', snapshot)

    // Check if should auto-send to LLM
    if (config.AUTO_SEND_TRIGGERS.includes(trigger)) {
      try {
        const suggestion = await this.llmClient.sendSnapshot(snapshot)
        this.emit('llmSuggestion', suggestion)
      } catch (error) {
        console.error('Failed to get LLM suggestion:', error)
      }
    }

    // Reset counters
    this.bytesSinceSnapshot = 0
    this.tailBuffer = []
  }

  destroy() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
    }
  }
}