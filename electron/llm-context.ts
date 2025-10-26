import { EventEmitter } from 'events'
import type { SnapshotReady, LlmSuggestion } from '../types/messages'
import { config } from './config'

interface ContextEntry {
  id: string
  timestamp: number
  command?: string
  exitCode?: number
  trigger: string
  tail: string
  output?: string
}

export class LlmContextManager extends EventEmitter {
  private contextHistory: ContextEntry[] = []
  private maxContextDepth: number

  constructor() {
    super()
    this.maxContextDepth = config.env.LLM_CONTEXT_DEPTH || 5
  }

  addSnapshot(snapshot: SnapshotReady) {
    const entry: ContextEntry = {
      id: snapshot.id,
      timestamp: Date.now(),
      exitCode: snapshot.summary.exitCode,
      trigger: snapshot.trigger,
      tail: snapshot.tail
    }

    this.contextHistory.push(entry)
    this.trimContext()
  }

  addCommandExecution(commandId: string, command: string, output: string, exitCode?: number) {
    const entry: ContextEntry = {
      id: commandId,
      timestamp: Date.now(),
      command: command,
      exitCode: exitCode,
      trigger: 'user_executed',
      tail: output,
      output: output
    }

    this.contextHistory.push(entry)
    this.trimContext()
  }

  getContextForLlm(): string {
    if (this.contextHistory.length === 0) {
      return 'No previous context available.'
    }

    const contextLines = this.contextHistory.map(entry => {
      // KST(UTC+9) timestamp
      const timestamp = (() => {
        const now = new Date(entry.timestamp);
        const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${kst.getFullYear()}-${pad(kst.getMonth()+1)}-${pad(kst.getDate())} ${pad(kst.getHours())}:${pad(kst.getMinutes())}:${pad(kst.getSeconds())}`;
      })();
      const status = entry.exitCode !== undefined ? `(exit: ${entry.exitCode})` : ''
      const command = entry.command ? `Command: ${entry.command}` : ''
      
      return [
        `--- Context Entry [${entry.trigger}] ${timestamp} ${status} ---`,
        command,
        entry.tail.slice(-200) // Last 200 chars to keep context manageable
      ].filter(Boolean).join('\n')
    })

    return contextLines.join('\n---\n')
  }

  getRecentCommands(limit: number = 3): string[] {
    return this.contextHistory
      .filter(entry => entry.command)
      .slice(-limit)
      .map(entry => entry.command!)
  }

  hasErrorInRecent(lookback: number = 2): boolean {
    const recent = this.contextHistory.slice(-lookback)
    return recent.some(entry => 
      entry.trigger === 'onError' || 
      (entry.exitCode !== undefined && entry.exitCode !== 0)
    )
  }

  getLastError(): ContextEntry | null {
    for (let i = this.contextHistory.length - 1; i >= 0; i--) {
      const entry = this.contextHistory[i]
      if (entry.trigger === 'onError' || (entry.exitCode !== undefined && entry.exitCode !== 0)) {
        return entry
      }
    }
    return null
  }

  clear() {
    this.contextHistory = []
  }

  getContextSummary(): {
    totalEntries: number
    recentCommands: string[]
    hasRecentErrors: boolean
    contextAge: number
  } {
    const oldest = this.contextHistory[0]
    const contextAge = oldest ? Date.now() - oldest.timestamp : 0

    return {
      totalEntries: this.contextHistory.length,
      recentCommands: this.getRecentCommands(),
      hasRecentErrors: this.hasErrorInRecent(),
      contextAge
    }
  }

  private trimContext() {
    if (this.contextHistory.length > this.maxContextDepth) {
      this.contextHistory = this.contextHistory.slice(-this.maxContextDepth)
    }
  }
}