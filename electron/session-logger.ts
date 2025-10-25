import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { SnapshotReady } from '../types/messages'

interface LogEntry {
  timestamp: string
  id: string
  trigger: string
  exitCode?: number
  elapsedMs: number
  bytes: number
  tail: string
  target?: string
  cwd?: string
}

export class SessionLogger {
  private logDir: string
  private maxFileSize: number = 10 * 1024 * 1024 // 10MB
  
  constructor() {
    // Use APPDATA on Windows, ~/.config on Linux/Mac
    const appDataDir = process.env.APPDATA || path.join(os.homedir(), '.config')
    this.logDir = path.join(appDataDir, 'ai-terminal', 'logs')
    this.ensureLogDirectory()
  }

  private ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true })
        console.log(`Created log directory: ${this.logDir}`)
      }
    } catch (error) {
      console.error('Failed to create log directory:', error)
    }
  }

  private getCurrentLogFilePath(): string {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    return path.join(this.logDir, `${today}.jsonl`)
  }

  private shouldRotateLog(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        return false
      }
      const stats = fs.statSync(filePath)
      return stats.size >= this.maxFileSize
    } catch (error) {
      console.error('Error checking log file size:', error)
      return false
    }
  }

  private rotateLogFile(filePath: string) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const dir = path.dirname(filePath)
      const basename = path.basename(filePath, '.jsonl')
      const rotatedPath = path.join(dir, `${basename}-${timestamp}.jsonl`)
      
      fs.renameSync(filePath, rotatedPath)
      console.log(`Log file rotated: ${filePath} -> ${rotatedPath}`)
    } catch (error) {
      console.error('Failed to rotate log file:', error)
    }
  }

  appendSnapshot(snapshot: SnapshotReady, target?: string, cwd?: string) {
    try {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        id: snapshot.id,
        trigger: snapshot.trigger,
        exitCode: snapshot.summary.exitCode,
        elapsedMs: snapshot.summary.elapsedMs,
        bytes: snapshot.summary.bytes,
        tail: snapshot.tail,
        target: target || 'local',
        cwd: cwd || process.cwd()
      }

      const logFilePath = this.getCurrentLogFilePath()
      
      // Check if log rotation is needed
      if (this.shouldRotateLog(logFilePath)) {
        this.rotateLogFile(logFilePath)
      }

      // Append log entry as JSONL
      const logLine = JSON.stringify(logEntry) + '\n'
      fs.appendFileSync(logFilePath, logLine, 'utf8')
      
      console.log(`Logged snapshot ${snapshot.id} to ${logFilePath}`)
    } catch (error) {
      console.error('Failed to append snapshot to log:', error)
    }
  }

  getRecentLogs(limit: number = 50): LogEntry[] {
    try {
      const logFilePath = this.getCurrentLogFilePath()
      
      if (!fs.existsSync(logFilePath)) {
        return []
      }

      const content = fs.readFileSync(logFilePath, 'utf8')
      const lines = content.trim().split('\n').filter(line => line.length > 0)
      
      // Get the last 'limit' entries
      const recentLines = lines.slice(-limit)
      
      return recentLines.map(line => {
        try {
          return JSON.parse(line) as LogEntry
        } catch (error) {
          console.error('Failed to parse log line:', line, error)
          return null
        }
      }).filter(entry => entry !== null) as LogEntry[]
      
    } catch (error) {
      console.error('Failed to read recent logs:', error)
      return []
    }
  }

  searchLogs(query: string, days: number = 7): LogEntry[] {
    try {
      const results: LogEntry[] = []
      const queryLower = query.toLowerCase()
      
      // Generate file paths for the last 'days' days
      for (let i = 0; i < days; i++) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
        const filePath = path.join(this.logDir, `${dateStr}.jsonl`)
        
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8')
          const lines = content.trim().split('\n').filter(line => line.length > 0)
          
          for (const line of lines) {
            try {
              const entry = JSON.parse(line) as LogEntry
              
              // Search in tail content, target, and cwd
              if (entry.tail.toLowerCase().includes(queryLower) ||
                  entry.target?.toLowerCase().includes(queryLower) ||
                  entry.cwd?.toLowerCase().includes(queryLower)) {
                results.push(entry)
              }
            } catch (error) {
              // Skip invalid JSON lines
              continue
            }
          }
        }
      }
      
      // Sort by timestamp (newest first)
      return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      
    } catch (error) {
      console.error('Failed to search logs:', error)
      return []
    }
  }

  getLogDirectory(): string {
    return this.logDir
  }

  cleanup(daysToKeep: number = 30) {
    try {
      const files = fs.readdirSync(this.logDir)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const filePath = path.join(this.logDir, file)
          const stats = fs.statSync(filePath)
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath)
            console.log(`Cleaned up old log file: ${file}`)
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error)
    }
  }
}