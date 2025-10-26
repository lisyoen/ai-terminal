import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

interface HistoryEntry {
  id: string
  command: string
  target: string
  cwd: string
  timestamp: string
  exitCode?: number
}

export class CommandHistory {
  private historyFilePath: string
  private memoryCache: HistoryEntry[] = []
  private maxEntries: number = 1000
  private maxMemoryEntries: number = 100

  constructor() {
    // Use APPDATA on Windows, ~/.config on Linux/Mac
    const appDataDir = process.env.APPDATA || path.join(os.homedir(), '.config')
    const configDir = path.join(appDataDir, 'ai-terminal')
    this.historyFilePath = path.join(configDir, 'history.json')
    
    this.ensureConfigDirectory()
    this.loadHistory()
  }

  private ensureConfigDirectory() {
    try {
      const dir = path.dirname(this.historyFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        console.log(`Created config directory: ${dir}`)
      }
    } catch (error) {
      console.error('Failed to create config directory:', error)
    }
  }

  private loadHistory() {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const content = fs.readFileSync(this.historyFilePath, 'utf8')
        const entries = JSON.parse(content) as HistoryEntry[]
        
        // Load most recent entries into memory cache
        this.memoryCache = entries.slice(-this.maxMemoryEntries)
        console.log(`Loaded ${this.memoryCache.length} history entries from disk`)
      }
    } catch (error) {
      console.error('Failed to load command history:', error)
      this.memoryCache = []
    }
  }

  private saveHistory() {
    try {
      // Load all existing entries
      let allEntries: HistoryEntry[] = []
      
      if (fs.existsSync(this.historyFilePath)) {
        const content = fs.readFileSync(this.historyFilePath, 'utf8')
        allEntries = JSON.parse(content) as HistoryEntry[]
      }

      // Merge with memory cache, removing duplicates
      const mergedEntries = [...allEntries]
      
      for (const memEntry of this.memoryCache) {
        const existingIndex = mergedEntries.findIndex(e => 
          e.id === memEntry.id || 
          (e.command === memEntry.command && e.timestamp === memEntry.timestamp)
        )
        
        if (existingIndex >= 0) {
          // Update existing entry
          mergedEntries[existingIndex] = memEntry
        } else {
          // Add new entry
          mergedEntries.push(memEntry)
        }
      }

      // Sort by timestamp and keep only maxEntries
      mergedEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const trimmedEntries = mergedEntries.slice(-this.maxEntries)

      // Save to disk
      fs.writeFileSync(this.historyFilePath, JSON.stringify(trimmedEntries, null, 2), 'utf8')
      console.log(`Saved ${trimmedEntries.length} history entries to disk`)
      
    } catch (error) {
      console.error('Failed to save command history:', error)
    }
  }

  addCommand(id: string, command: string, target: string = 'local', cwd: string = process.cwd(), exitCode?: number) {
    // KST(UTC+9) timestamp
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const pad = (n: number) => n.toString().padStart(2, '0');
    const kstTimestamp = `${kst.getFullYear()}-${pad(kst.getMonth()+1)}-${pad(kst.getDate())} ${pad(kst.getHours())}:${pad(kst.getMinutes())}:${pad(kst.getSeconds())}`;
    const entry: HistoryEntry = {
      id,
      command: command.trim(),
      target,
      cwd,
      timestamp: kstTimestamp,
      exitCode
    }

    // Check for duplicate commands (same command, ignore case and whitespace)
    const normalizedCommand = entry.command.toLowerCase().replace(/\s+/g, ' ')
    const isDuplicate = this.memoryCache.some(existing => 
      existing.command.toLowerCase().replace(/\s+/g, ' ') === normalizedCommand &&
      existing.target === target
    )

    if (!isDuplicate) {
      // Add to memory cache
      this.memoryCache.push(entry)
      
      // Trim memory cache if needed
      if (this.memoryCache.length > this.maxMemoryEntries) {
        this.memoryCache = this.memoryCache.slice(-this.maxMemoryEntries)
      }

      console.log(`Added command to history: ${command} (${target})`)
    } else {
      console.log(`Skipped duplicate command: ${command}`)
    }

    // Save periodically (every 10 commands)
    if (this.memoryCache.length % 10 === 0) {
      this.saveHistory()
    }
  }

  getRecentCommands(limit: number = 20): HistoryEntry[] {
    // Return most recent commands from memory cache
    return [...this.memoryCache]
      .reverse() // Most recent first
      .slice(0, limit)
  }

  searchCommands(query: string, limit: number = 10): HistoryEntry[] {
    const queryLower = query.toLowerCase()
    
    return this.memoryCache
      .filter(entry => 
        entry.command.toLowerCase().includes(queryLower) ||
        entry.cwd.toLowerCase().includes(queryLower) ||
        entry.target.toLowerCase().includes(queryLower)
      )
      .reverse() // Most recent first
      .slice(0, limit)
  }

  getPreviousCommand(currentCommand: string = ''): string | null {
    // Find the most recent command that's different from current
    const normalizedCurrent = currentCommand.toLowerCase().trim()
    
    for (let i = this.memoryCache.length - 1; i >= 0; i--) {
      const entry = this.memoryCache[i]
      const normalizedEntry = entry.command.toLowerCase().trim()
      
      if (normalizedEntry !== normalizedCurrent && normalizedEntry.length > 0) {
        return entry.command
      }
    }
    
    return null
  }

  getCommandsByTarget(target: string, limit: number = 20): HistoryEntry[] {
    return this.memoryCache
      .filter(entry => entry.target === target)
      .reverse() // Most recent first
      .slice(0, limit)
  }

  clearHistory() {
    try {
      this.memoryCache = []
      if (fs.existsSync(this.historyFilePath)) {
        fs.unlinkSync(this.historyFilePath)
      }
      console.log('Command history cleared')
    } catch (error) {
      console.error('Failed to clear command history:', error)
    }
  }

  getStats(): { total: number, targets: string[], oldestEntry?: string, newestEntry?: string } {
    const targets = [...new Set(this.memoryCache.map(e => e.target))]
    const timestamps = this.memoryCache.map(e => e.timestamp).sort()
    
    return {
      total: this.memoryCache.length,
      targets,
      oldestEntry: timestamps[0],
      newestEntry: timestamps[timestamps.length - 1]
    }
  }

  // Called when app is closing to ensure data is saved
  flush() {
    this.saveHistory()
  }
}