function Invoke-AiWrapped {
    param(
        [string]$Id,
        [string]$Cmd
    )
    
    Write-Output "`n__AI_EVT__:$Id:START"
    $Error.Clear()
    $LASTEXITCODE = 0
    
    try {
        Invoke-Expression $Cmd
    }
    catch {
        if ($LASTEXITCODE -eq 0) {
            $LASTEXITCODE = 1
        }
    }
    
    Write-Output "`n__AI_EVT__:$Id:END:$LASTEXITCODE"
}