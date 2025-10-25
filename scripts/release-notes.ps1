#!/usr/bin/env pwsh
<#
.SYNOPSIS
    AI Terminal 릴리스 노트 자동 생성 스크립트

.DESCRIPTION
    최근 N개의 커밋을 분석하여 CHANGELOG 항목 초안을 생성합니다.
    커밋 메시지를 분류하고 마크다운 형식으로 출력합니다.

.PARAMETER CommitCount
    분석할 최근 커밋 수 (기본값: 10)

.PARAMETER Since
    특정 태그/커밋 이후의 변경사항만 분석 (선택사항)

.PARAMETER OutputFile
    결과를 파일로 저장할 경로 (선택사항, 기본값: 콘솔 출력)

.EXAMPLE
    .\scripts\release-notes.ps1
    최근 10개 커밋을 분석하여 릴리스 노트 생성

.EXAMPLE
    .\scripts\release-notes.ps1 -CommitCount 20 -Since "v0.4.0"
    v0.4.0 태그 이후의 최근 20개 커밋 분석

.EXAMPLE
    .\scripts\release-notes.ps1 -OutputFile "CHANGELOG_DRAFT.md"
    릴리스 노트를 파일로 저장
#>

param(
    [Parameter(Mandatory = $false)]
    [int]$CommitCount = 10,
    
    [Parameter(Mandatory = $false)]
    [string]$Since = $null,
    
    [Parameter(Mandatory = $false)]
    [string]$OutputFile = $null
)

# 스크립트 설정
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Git 설치 확인
function Test-GitInstalled {
    try {
        $null = git --version
        return $true
    }
    catch {
        Write-Error "Git이 설치되지 않았거나 PATH에 없습니다."
        return $false
    }
}

# Git 저장소 확인
function Test-GitRepository {
    try {
        $null = git rev-parse --git-dir
        return $true
    }
    catch {
        Write-Error "현재 디렉토리가 Git 저장소가 아닙니다."
        return $false
    }
}

# 커밋 메시지 분류
function Get-CommitCategory {
    param([string]$Message)
    
    $lowerMessage = $Message.ToLower()
    
    if ($lowerMessage -match "^(feat|feature)(\(.+\))?:") {
        return "✨ Features"
    }
    elseif ($lowerMessage -match "^(fix|bugfix)(\(.+\))?:") {
        return "🐛 Bug Fixes"
    }
    elseif ($lowerMessage -match "^(docs?)(\(.+\))?:") {
        return "📚 Documentation"
    }
    elseif ($lowerMessage -match "^(style|format)(\(.+\))?:") {
        return "💄 Styling"
    }
    elseif ($lowerMessage -match "^(refactor|ref)(\(.+\))?:") {
        return "♻️ Refactoring"
    }
    elseif ($lowerMessage -match "^(perf|performance)(\(.+\))?:") {
        return "⚡ Performance"
    }
    elseif ($lowerMessage -match "^(test|tests)(\(.+\))?:") {
        return "🧪 Testing"
    }
    elseif ($lowerMessage -match "^(build|ci|cd)(\(.+\))?:") {
        return "🔨 Build & CI"
    }
    elseif ($lowerMessage -match "^(chore|maint|maintenance)(\(.+\))?:") {
        return "🔧 Maintenance"
    }
    elseif ($lowerMessage -match "^(release|version)(\(.+\))?:") {
        return "🚀 Release"
    }
    else {
        return "📝 Other Changes"
    }
}

# 커밋 메시지 정리
function Format-CommitMessage {
    param([string]$Message)
    
    # 첫 번째 줄만 사용 (제목)
    $title = $Message.Split("`n")[0].Trim()
    
    # 기존 이모지 제거
    $title = $title -replace "^[\p{So}\p{Cs}]+\s*", ""
    
    # Conventional Commits 형식 정리
    if ($title -match "^([a-zA-Z]+)(\(.+\))?:\s*(.+)$") {
        $scope = if ($matches[2]) { $matches[2] } else { "" }
        $description = $matches[3]
        return "**${scope}**: ${description}"
    }
    
    return $title
}

# 현재 버전 가져오기
function Get-CurrentVersion {
    try {
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        return $packageJson.version
    }
    catch {
        return "Unknown"
    }
}

# 다음 버전 제안
function Get-NextVersion {
    param([string]$CurrentVersion, [array]$Commits)
    
    if ($CurrentVersion -eq "Unknown") {
        return "1.0.0"
    }
    
    # 버전 파싱
    if ($CurrentVersion -match "^(\d+)\.(\d+)\.(\d+)") {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        $patch = [int]$matches[3]
        
        # 브레이킹 체인지 확인
        $hasBreaking = $Commits | Where-Object { $_.Message -match "BREAKING CHANGE" -or $_.Message -match "^[^:]+!:" }
        if ($hasBreaking) {
            return "$($major + 1).0.0"
        }
        
        # Feature 추가 확인
        $hasFeature = $Commits | Where-Object { $_.Message -match "^feat(\(.+\))?:" }
        if ($hasFeature) {
            return "$major.$($minor + 1).0"
        }
        
        # 기본적으로 패치 버전 증가
        return "$major.$minor.$($patch + 1)"
    }
    
    return $CurrentVersion
}

# 메인 함수
function Main {
    Write-Host "🚀 AI Terminal 릴리스 노트 생성기" -ForegroundColor Cyan
    Write-Host "=====================================`n" -ForegroundColor Cyan
    
    # 사전 확인
    if (-not (Test-GitInstalled)) { exit 1 }
    if (-not (Test-GitRepository)) { exit 1 }
    
    # Git 로그 명령 구성
    $gitArgs = @("log", "--oneline", "--pretty=format:%H|%s|%an|%ad", "--date=short")
    
    if ($Since) {
        $gitArgs += "${Since}..HEAD"
    }
    else {
        $gitArgs += "-n", $CommitCount
    }
    
    Write-Host "📊 커밋 분석 중..." -ForegroundColor Yellow
    
    # 커밋 정보 수집
    try {
        $gitOutput = & git @gitArgs
        if (-not $gitOutput) {
            Write-Warning "분석할 커밋이 없습니다."
            return
        }
    }
    catch {
        Write-Error "Git 로그를 가져오는 중 오류 발생: $($_.Exception.Message)"
        return
    }
    
    # 커밋 파싱
    $commits = @()
    foreach ($line in $gitOutput) {
        if ($line -match "^([a-f0-9]+)\|(.+)\|(.+)\|(.+)$") {
            $commits += @{
                Hash = $matches[1]
                Message = $matches[2]
                Author = $matches[3]
                Date = $matches[4]
                Category = Get-CommitCategory $matches[2]
                FormattedMessage = Format-CommitMessage $matches[2]
            }
        }
    }
    
    Write-Host "✅ $($commits.Count)개 커밋 분석 완료`n" -ForegroundColor Green
    
    # 버전 정보
    $currentVersion = Get-CurrentVersion
    $nextVersion = Get-NextVersion $currentVersion $commits
    
    # 릴리스 노트 생성
    $releaseNotes = @()
    $releaseNotes += "# 릴리스 노트 - v${nextVersion}"
    $releaseNotes += ""
    $releaseNotes += "_생성일: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')_"
    $releaseNotes += ""
    $releaseNotes += "## 📋 버전 정보"
    $releaseNotes += "- **이전 버전**: v${currentVersion}"
    $releaseNotes += "- **새 버전**: v${nextVersion}"
    $releaseNotes += "- **분석 커밋 수**: $($commits.Count)개"
    $releaseNotes += ""
    
    # 카테고리별 분류
    $categories = $commits | Group-Object Category | Sort-Object Name
    
    $releaseNotes += "## 📝 변경사항"
    $releaseNotes += ""
    
    foreach ($category in $categories) {
        $releaseNotes += "### $($category.Name)"
        $releaseNotes += ""
        
        foreach ($commit in $category.Group) {
            $shortHash = $commit.Hash.Substring(0, 7)
            $releaseNotes += "- $($commit.FormattedMessage) ([``$shortHash``](../../commit/$($commit.Hash)))"
        }
        $releaseNotes += ""
    }
    
    # 기여자 정보
    $contributors = $commits | Group-Object Author | Sort-Object Count -Descending
    $releaseNotes += "## 👥 기여자"
    $releaseNotes += ""
    foreach ($contributor in $contributors) {
        $commitCount = $contributor.Count
        $releaseNotes += "- **$($contributor.Name)**: ${commitCount}개 커밋"
    }
    $releaseNotes += ""
    
    # 릴리스 체크리스트
    $releaseNotes += "## ✅ 릴리스 체크리스트"
    $releaseNotes += ""
    $releaseNotes += "- [ ] 버전 업데이트 (package.json)"
    $releaseNotes += "- [ ] CHANGELOG.md 업데이트"
    $releaseNotes += "- [ ] 빌드 및 테스트"
    $releaseNotes += "- [ ] Git 태그 생성: ``git tag v${nextVersion}``"
    $releaseNotes += "- [ ] 원격 저장소 푸시: ``git push origin v${nextVersion}``"
    $releaseNotes += "- [ ] GitHub 릴리스 생성"
    $releaseNotes += "- [ ] 릴리스 노트 배포"
    $releaseNotes += ""
    
    # 푸터
    $releaseNotes += "---"
    $releaseNotes += "_이 릴리스 노트는 자동으로 생성되었습니다. 필요에 따라 수정해 주세요._"
    
    # 출력
    $output = $releaseNotes -join "`n"
    
    if ($OutputFile) {
        try {
            $output | Out-File -FilePath $OutputFile -Encoding UTF8
            Write-Host "✅ 릴리스 노트가 저장되었습니다: $OutputFile" -ForegroundColor Green
        }
        catch {
            Write-Error "파일 저장 중 오류 발생: $($_.Exception.Message)"
        }
    }
    else {
        Write-Host $output
    }
    
    Write-Host "`n🎉 릴리스 노트 생성 완료!" -ForegroundColor Green
}

# 스크립트 실행
if ($MyInvocation.InvocationName -ne '.') {
    Main
}