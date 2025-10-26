import type { RunRequest, TerminalChunk, SnapshotReady, LlmSuggestion, ErrorMessage } from '../types/messages.js'

export class IpcBridge {
  private static isElectron = typeof window !== 'undefined' && window.ai

  static async runCommand(request: RunRequest): Promise<{ success: boolean; error?: string }> {
    if (!this.isElectron) {
      throw new Error('IPC not available - not running in Electron')
    }
    
    return window.ai.request('run', request)
  }

  static onTerminalChunk(callback: (chunk: TerminalChunk) => void): () => void {
    if (!this.isElectron || !window.ai.on || !window.ai.off) {
      return () => {}
    }

    window.ai.on('terminal:chunk', callback)
    return () => window.ai.off!('terminal:chunk', callback)
  }

  static onSnapshotReady(callback: (snapshot: SnapshotReady) => void): () => void {
    if (!this.isElectron || !window.ai.on || !window.ai.off) {
      return () => {}
    }

    window.ai.on('snapshot:ready', callback)
    return () => window.ai.off!('snapshot:ready', callback)
  }

  static onLlmSuggestion(callback: (suggestion: LlmSuggestion) => void): () => void {
    if (!this.isElectron || !window.ai.on || !window.ai.off) {
      return () => {}
    }

    window.ai.on('llm:suggestion', callback)
    return () => window.ai.off!('llm:suggestion', callback)
  }

  static onError(callback: (error: ErrorMessage) => void): () => void {
    if (!this.isElectron || !window.ai.on || !window.ai.off) {
      return () => {}
    }

    window.ai.on('error', callback)
    return () => window.ai.off!('error', callback)
  }

  // Command history methods
  static async getRecentCommands(limit: number = 20): Promise<any[]> {
    if (!this.isElectron) {
      return []
    }
    
    return window.ai.request('history:recent', limit)
  }

  static async searchCommands(query: string, limit: number = 10): Promise<any[]> {
    if (!this.isElectron) {
      return []
    }
    
    return window.ai.request('history:search', query, limit)
  }

  static async getPreviousCommand(currentCommand: string = ''): Promise<string | null> {
    if (!this.isElectron) {
      return null
    }
    
    return window.ai.request('history:previous', currentCommand)
  }

  // LLM command conversion
  static async convertNaturalLanguageToCommand(userInput: string, context: string = ''): Promise<{command?: string, explanation?: string}> {
    if (!this.isElectron) {
      return {}
    }
    
    return window.ai.request('llm:convert', { userInput, context })
  }
}