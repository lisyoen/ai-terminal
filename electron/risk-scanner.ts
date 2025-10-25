export interface RiskAssessment {
  score: number // 0-100, higher = more dangerous
  level: 'low' | 'medium' | 'high' | 'critical'
  reasons: string[]
  blockers: string[]
}

export class RiskScanner {
  private static readonly CRITICAL_PATTERNS = [
    // System destruction
    /rm\s+-rf\s+\/\s*$/i,
    /del\s+\/[sq]\s+\*/i,
    /format\s+c:/i,
    /fdisk/i,
    
    // Network attacks
    /ddos|flood|attack/i,
    /nmap.*-sS/i,
    /metasploit/i,
    
    // Malware/backdoors
    /nc.*-l.*-e/i, // netcat backdoor
    /python.*-c.*exec/i,
    /curl.*\|.*sh/i,
    /wget.*\|.*sh/i
  ]

  private static readonly HIGH_RISK_PATTERNS = [
    // File system operations
    /rm\s+-rf/i,
    /del\s+\/[sq]/i,
    /rmdir\s+\/s/i,
    
    // User/permission changes
    /sudo\s+su/i,
    /chmod\s+777/i,
    /chown.*root/i,
    /passwd/i,
    
    // Network operations
    /curl.*-X\s+(POST|PUT|DELETE)/i,
    /wget.*--post/i,
    /ssh.*-o.*StrictHostKeyChecking=no/i,
    
    // Process operations
    /kill\s+-9/i,
    /pkill/i,
    /taskkill.*\/f/i,
    
    // Registry (Windows)
    /reg\s+(delete|add).*HKLM/i,
    
    // Cron/scheduled tasks
    /crontab\s+-e/i,
    /schtasks.*\/create/i
  ]

  private static readonly MEDIUM_RISK_PATTERNS = [
    // File operations
    /mv.*\/dev\/null/i,
    /cp.*-f/i,
    /move.*nul/i,
    
    // Environment changes
    /export\s+PATH=/i,
    /setx\s+PATH/i,
    
    // Network
    /curl\s+/i,
    /wget\s+/i,
    /nc\s+/i,
    
    // Package managers with force
    /npm.*--force/i,
    /pip.*--force/i,
    /apt.*--force-yes/i,
    
    // Git operations
    /git\s+reset.*--hard/i,
    /git\s+push.*--force/i
  ]

  static assess(command: string): RiskAssessment {
    const reasons: string[] = []
    const blockers: string[] = []
    let score = 0

    // Check critical patterns
    for (const pattern of this.CRITICAL_PATTERNS) {
      if (pattern.test(command)) {
        score = Math.max(score, 90)
        reasons.push(`Critical pattern detected: ${pattern.source}`)
        blockers.push('Command contains potentially destructive operations')
      }
    }

    // Check high risk patterns
    for (const pattern of this.HIGH_RISK_PATTERNS) {
      if (pattern.test(command)) {
        score = Math.max(score, 70)
        reasons.push(`High risk pattern: ${pattern.source}`)
      }
    }

    // Check medium risk patterns
    for (const pattern of this.MEDIUM_RISK_PATTERNS) {
      if (pattern.test(command)) {
        score = Math.max(score, 40)
        reasons.push(`Medium risk pattern: ${pattern.source}`)
      }
    }

    // Additional risk factors
    if (command.includes('&&') || command.includes('||') || command.includes(';')) {
      score += 10
      reasons.push('Command chaining detected')
    }

    if (command.includes('sudo') || command.includes('runas')) {
      score += 15
      reasons.push('Elevated privileges requested')
    }

    if (command.includes('|') && (command.includes('sh') || command.includes('bash') || command.includes('powershell'))) {
      score += 20
      reasons.push('Potential code injection via pipe to shell')
    }

    // Remote execution
    if (command.includes('ssh') || command.includes('psexec') || command.includes('winrm')) {
      score += 10
      reasons.push('Remote execution detected')
    }

    // Long or obfuscated commands
    if (command.length > 200) {
      score += 5
      reasons.push('Unusually long command')
    }

    if (/[^\x20-\x7E]/.test(command)) {
      score += 15
      reasons.push('Non-printable characters detected')
    }

    // Determine level
    let level: RiskAssessment['level']
    if (score >= 85) {
      level = 'critical'
    } else if (score >= 60) {
      level = 'high'
    } else if (score >= 30) {
      level = 'medium'
    } else {
      level = 'low'
    }

    return {
      score: Math.min(score, 100),
      level,
      reasons,
      blockers
    }
  }

  static shouldBlock(assessment: RiskAssessment): boolean {
    return assessment.blockers.length > 0 || assessment.level === 'critical'
  }

  static getWarningMessage(assessment: RiskAssessment): string {
    if (assessment.level === 'critical') {
      return '⚠️  CRITICAL: This command may cause irreversible damage to your system!'
    } else if (assessment.level === 'high') {
      return '⚠️  HIGH RISK: This command performs potentially dangerous operations.'
    } else if (assessment.level === 'medium') {
      return '⚠️  MEDIUM RISK: Please review this command carefully before execution.'
    } else {
      return ''
    }
  }
}