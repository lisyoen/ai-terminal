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
    // Use project-local logs directory
    this.logDir = path.join(process.cwd(), 'logs')
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
    // UTC 기준 날짜로 파일명 생성 (YYYYMMDD)
    // 로컬 시스템 날짜를 사용하여 로그 파일 이름 생성
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const today = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
    return path.join(this.logDir, `${today}.jsonl`);
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
      // UTC 기준 타임스탬프로 로테이션
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const dir = path.dirname(filePath);
      const basename = path.basename(filePath, '.jsonl');
      const rotatedPath = path.join(dir, `${basename}-${timestamp}.jsonl`);
      
      fs.renameSync(filePath, rotatedPath);
      console.log(`Log file rotated: ${filePath} -> ${rotatedPath}`);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  appendSnapshot(snapshot: SnapshotReady, target?: string, cwd?: string) {
    try {
      // KST(UTC+9) ISO8601 timestamp
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const year = now.getFullYear();
      const month = pad(now.getMonth() + 1);
      const day = pad(now.getDate());
      const hours = pad(now.getHours());
      const minutes = pad(now.getMinutes());
      const seconds = pad(now.getSeconds());
      const ms = now.getMilliseconds().toString().padStart(3, '0');
      const timestampKST = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}+09:00`;
      const logEntry: LogEntry = {
        timestamp: timestampKST,
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

  // Simple logging method for terminal events
  logTerminalEvent(id: string, trigger: string, message: string, data?: any) {
    try {
      // 입력값 등 추가 데이터는 tail에 명확히 남기고, 로그 entry에 병합
      let tailMsg = message;
      if (data?.inputText) {
        // 한글 입력값이 깨지지 않도록 명확히 처리
        tailMsg += ` | inputText: ${String(data.inputText)}`;
      }
      if (data?.originalCmd) {
        tailMsg += ` | originalCmd: ${String(data.originalCmd)}`;
      }
      if (data?.translatedCmd) {
        tailMsg += ` | translatedCmd: ${String(data.translatedCmd)}`;
      }
      // 로그 entry에 모든 data 필드 병합
    // 로그 entry의 timestamp를 KST(UTC+9) ISO8601 형식으로 기록
    const now = new Date();
    // KST 오프셋 적용 (UTC 기준 +9시간)
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    const timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}+09:00`;
      const logEntry: LogEntry = {
        timestamp,
        id: id,
        trigger: trigger,
        exitCode: data?.exitCode,
        elapsedMs: data?.elapsedMs || 0,
        bytes: Buffer.byteLength(JSON.stringify(data || {}), 'utf8'),
        tail: tailMsg,
        target: data?.target || 'local',
        cwd: data?.cwd || process.cwd(),
        ...data // 모든 추가 필드 병합
      }

  const logFilePath = this.getCurrentLogFilePath();
  console.log(`[DEBUG] logTerminalEvent called. Writing to:`, logFilePath);
  console.log(`[SessionLogger] logTerminalEvent (KST):`, { logFilePath, timestamp: logEntry.timestamp, logEntry });

      if (this.shouldRotateLog(logFilePath)) {
        this.rotateLogFile(logFilePath);
      }

      // 항상 UTF-8로 JSON.stringify 결과를 기록
      const logLine = JSON.stringify(logEntry, null, 0) + '\n';
      fs.appendFileSync(logFilePath, logLine, { encoding: 'utf8' });

    } catch (error) {
      console.error('Failed to log terminal event:', error);
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