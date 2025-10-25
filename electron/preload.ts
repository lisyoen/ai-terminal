import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('ai', {
  request: (channel: string, payload?: any) => {
    // Whitelist channels
    const validChannels = ['run']
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, payload)
    }
    throw new Error(`Invalid channel: ${channel}`)
  },

  // Subscribe to events
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = ['terminal:chunk', 'snapshot:ready', 'llm:suggestion', 'error']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    } else {
      throw new Error(`Invalid channel: ${channel}`)
    }
  },

  // Remove event listeners
  off: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = ['terminal:chunk', 'snapshot:ready', 'llm:suggestion', 'error']
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback)
    } else {
      throw new Error(`Invalid channel: ${channel}`)
    }
  }
})

// Type declaration for the exposed API
declare global {
  interface Window {
    ai: {
      request: (channel: string, payload?: any) => Promise<any>
      on: (channel: string, callback: (...args: any[]) => void) => void
      off: (channel: string, callback: (...args: any[]) => void) => void
    }
  }
}