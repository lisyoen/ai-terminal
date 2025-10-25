param(
    [Parameter(Mandatory=$true)]
    [string]$Id,
    
    [Parameter(Mandatory=$true)]
    [string]$Target,
    
    [Parameter(Mandatory=$true)]
    [string]$UserCmd
)

# AI Terminal SSH Wrapper Script
# This script establishes SSH connection and executes commands with proper event markers

# Function to write timestamped output
function Write-TimestampedOutput {
    param([string]$Message, [string]$Type = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    Write-Host "[$timestamp] [$Type] $Message" -ForegroundColor $(if($Type -eq "ERROR"){"Red"}else{"Green"})
}

# Function to escape command for shell execution
function Escape-ShellCommand {
    param([string]$Command)
    # Escape single quotes by replacing ' with '\''
    return $Command -replace "'", "'\'''"
}

try {
    Write-TimestampedOutput "Starting SSH session for command ID: $Id"
    Write-TimestampedOutput "Target: $Target"
    Write-TimestampedOutput "Command: $UserCmd"
    
    # Parse target (remove ssh:// prefix and extract user@host)
    $cleanTarget = $Target -replace '^ssh://', ''
    if ($cleanTarget -match '^(.+@.+?)(?::(\d+))?$') {
        $UserHost = $Matches[1]
        $Port = $Matches[2]
        Write-TimestampedOutput "Parsed SSH target - UserHost: $UserHost$(if($Port){", Port: $Port"})"
    } else {
        throw "Invalid SSH target format. Expected user@host, got: $cleanTarget"
    }
    
    # Escape the user command for shell execution
    $EscapedCmd = Escape-ShellCommand -Command $UserCmd
    
    # Create the wrapped command that will be executed on remote host
    $WrappedCmd = @"
bash -lc '
echo "=== AI Terminal SSH Session Started ==="
echo "Target: $cleanTarget"
echo "Command ID: $Id"
echo "Executing: $UserCmd"
echo "=== Command Output ==="
$EscapedCmd
EXIT_CODE=`$?
echo "=== Command Completed ==="
echo "__AI_EVT__:$Id:END:`$EXIT_CODE"
exit `$EXIT_CODE
'
"@
    
    Write-TimestampedOutput "Initiating SSH connection..."
    
    # Build SSH arguments
    $sshArgs = @(
        '-tt'
        '-o', 'StrictHostKeyChecking=no'
        '-o', 'UserKnownHostsFile=NUL'  # Windows equivalent of /dev/null
        '-o', 'LogLevel=ERROR'
        '-o', 'BatchMode=no'
        '-o', 'ConnectTimeout=30'
    )
    
    # Add port if specified
    if ($Port) {
        $sshArgs += @('-p', $Port)
    }
    
    $sshArgs += @($UserHost, $WrappedCmd)
    
    Write-TimestampedOutput "SSH arguments: $($sshArgs -join ' ')"
    
    # Execute SSH command directly and capture output
    $process = Start-Process -FilePath 'ssh' -ArgumentList $sshArgs -Wait -PassThru -NoNewWindow -RedirectStandardOutput -RedirectStandardError
    
    # Read output files if they exist
    if (Test-Path $process.StandardOutput.FileName) {
        Get-Content $process.StandardOutput.FileName | ForEach-Object { Write-Host $_ }
    }
    
    if (Test-Path $process.StandardError.FileName) {
        Get-Content $process.StandardError.FileName | ForEach-Object { Write-Host "SSH-ERR: $_" -ForegroundColor Yellow }
    }
    
    $exitCode = $process.ExitCode
    Write-TimestampedOutput "SSH process completed with exit code: $exitCode"
    
    # Ensure completion marker is output
    Write-Host "__AI_EVT__:$Id:END:$exitCode"
    
    exit $exitCode
    
} catch {
    $errorMsg = $_.Exception.Message
    Write-TimestampedOutput "SSH execution failed: $errorMsg" "ERROR"
    
    # Output error marker
    Write-Host "SSH Error: $errorMsg" -ForegroundColor Red
    Write-Host "__AI_EVT__:$Id:END:1"
    
    exit 1
}