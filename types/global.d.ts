// Global type definitions for AI Terminal

interface AITerminalAPI {
  request(channel: string, ...args: any[]): Promise<any>
  on(channel: string, callback: (...args: any[]) => void): void
  off(channel: string, callback: (...args: any[]) => void): void
}

declare global {
  interface Window {
    ai: AITerminalAPI
  }
}

export {}