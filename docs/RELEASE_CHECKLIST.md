# AI Terminal 릴리스 체크리스트

이 문서는 AI Terminal 프로젝트의 새로운 버전을 안전하고 체계적으로 릴리스하기 위한 단계별 가이드입니다.

## 📋 사전 준비

### 1. 환경 확인
- [ ] Node.js 22+ 설치 확인
- [ ] Git 설치 및 설정 확인
- [ ] GitHub CLI (gh) 설치 확인 (선택사항)
- [ ] PowerShell 7+ 사용 확인

### 2. 코드 상태 확인
- [ ] 모든 변경사항이 커밋되었는지 확인
- [ ] 메인 브랜치가 최신 상태인지 확인
- [ ] CI/CD 파이프라인이 통과했는지 확인
- [ ] 모든 테스트가 성공했는지 확인

```bash
# 코드 상태 확인
git status
git pull origin main
npm test
npm run build
```

## 🏷️ 버전 관리

### 3. 릴리스 노트 생성
```powershell
# 자동 릴리스 노트 생성
.\scripts\release-notes.ps1

# 특정 태그 이후 변경사항 분석
.\scripts\release-notes.ps1 -Since "v0.4.0"

# 파일로 저장
.\scripts\release-notes.ps1 -OutputFile "CHANGELOG_DRAFT.md"
```

### 4. 버전 결정
다음 가이드라인에 따라 새 버전 번호를 결정합니다:

- **Major (X.0.0)**: Breaking changes 또는 주요 아키텍처 변경
- **Minor (x.Y.0)**: 새로운 기능 추가 (하위 호환성 유지)
- **Patch (x.y.Z)**: 버그 수정 및 작은 개선

### 5. package.json 버전 업데이트
```bash
# NPM을 통한 버전 업데이트
npm version patch   # 패치 버전 증가
npm version minor   # 마이너 버전 증가
npm version major   # 메이저 버전 증가

# 또는 수동으로 package.json 편집
```

## 📝 문서 업데이트

### 6. CHANGELOG.md 업데이트
- [ ] `docs/CHANGELOG.md` 파일에 새 버전 항목 추가
- [ ] 릴리스 날짜 설정
- [ ] 변경사항을 카테고리별로 정리:
  - ✨ Features (새로운 기능)
  - 🐛 Bug Fixes (버그 수정)
  - 📚 Documentation (문서)
  - ♻️ Refactoring (리팩토링)
  - ⚡ Performance (성능)
  - 🔨 Build & CI (빌드/CI)

### 7. README.md 확인
- [ ] 설치 가이드가 최신인지 확인
- [ ] 새로운 기능이 문서화되었는지 확인
- [ ] 스크린샷이 최신 버전을 반영하는지 확인

## 🔨 빌드 및 테스트

### 8. 최종 빌드
```bash
# 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# 린팅 및 타입 체크
npm run lint
npm run build:electron

# 렌더러 빌드
npm run build:renderer

# 전체 빌드
npm run build
```

### 9. 애플리케이션 테스트
```bash
# 프로덕션 모드 실행
npm run start:prod

# 주요 기능 테스트
# - 터미널 실행
# - AI 채팅 기능
# - 명령 히스토리
# - SSH 연결 (있는 경우)
```

### 10. 배포 패키지 생성
```bash
# Windows 실행 파일 생성
npm run dist:win

# 포터블 버전 생성
npm run dist:portable

# 빌드 결과 확인
ls release/
```

## 🚀 Git 태그 및 릴리스

### 11. Git 태그 생성
```bash
# 현재 버전 확인
node -p "require('./package.json').version"

# 태그 생성 (v접두사 포함)
git tag v1.2.3

# 태그에 메시지 추가 (권장)
git tag -a v1.2.3 -m "Release v1.2.3: Feature updates and bug fixes"

# 태그 확인
git tag -l
```

### 12. 원격 저장소 푸시
```bash
# 코드 변경사항 푸시
git add .
git commit -m "release: prepare v1.2.3"
git push origin main

# 태그 푸시
git push origin v1.2.3

# 모든 태그 푸시 (선택사항)
git push origin --tags
```

## 📦 GitHub 릴리스

### 13. GitHub 릴리스 생성
#### 웹 인터페이스 방식:
1. GitHub 저장소의 "Releases" 페이지 이동
2. "Create a new release" 클릭
3. 태그 선택: `v1.2.3`
4. 릴리스 제목: `AI Terminal v1.2.3`
5. 릴리스 노트 작성 (CHANGELOG 내용 활용)
6. 바이너리 파일 업로드:
   - `release/AI-Terminal-1.2.3-Setup.exe`
   - 기타 배포 파일들

#### CLI 방식 (GitHub CLI 사용):
```bash
# 릴리스 생성
gh release create v1.2.3 \
  --title "AI Terminal v1.2.3" \
  --notes-file CHANGELOG_DRAFT.md \
  release/AI-Terminal-1.2.3-Setup.exe

# 릴리스 확인
gh release list
```

### 14. 릴리스 검증
- [ ] 릴리스 페이지가 올바르게 표시되는지 확인
- [ ] 다운로드 링크가 작동하는지 확인
- [ ] 릴리스 노트가 완전한지 확인
- [ ] 태그가 올바른 커밋을 가리키는지 확인

## 🔄 사후 작업

### 15. 다음 개발 준비
```bash
# 개발 브랜치 생성 (선택사항)
git checkout -b develop

# package.json에서 버전을 개발 버전으로 설정
# 예: "1.2.4-dev" 또는 "1.3.0-dev"
```

### 16. 팀 알림
- [ ] 팀 채널에 릴리스 공지
- [ ] 사용자 가이드 업데이트 필요성 검토
- [ ] 다음 릴리스 계획 수립

## 🔧 유용한 스크립트

### 자동화된 릴리스 스크립트 예시
```powershell
# scripts/auto-release.ps1
param(
    [Parameter(Mandatory)]
    [ValidateSet("patch", "minor", "major")]
    [string]$VersionType
)

# 1. 버전 업데이트
npm version $VersionType --no-git-tag-version

# 2. 릴리스 노트 생성
.\scripts\release-notes.ps1 -OutputFile "RELEASE_NOTES.md"

# 3. 빌드
npm run build
npm run dist:win

# 4. Git 태그 및 푸시
$version = node -p "require('./package.json').version"
git add .
git commit -m "release: v$version"
git tag "v$version"
git push origin main
git push origin "v$version"

Write-Host "✅ 릴리스 v$version 준비 완료!" -ForegroundColor Green
Write-Host "GitHub에서 릴리스를 생성하고 바이너리를 업로드하세요." -ForegroundColor Yellow
```

## 📊 릴리스 메트릭

매 릴리스마다 다음 정보를 기록하여 개선점을 찾으세요:

- [ ] 릴리스 준비 시간
- [ ] 발견된 이슈 수
- [ ] 사용자 피드백
- [ ] 다운로드 통계
- [ ] 버그 보고서

## 🆘 문제 해결

### 일반적인 문제들:

**빌드 실패**
```bash
# 캐시 정리
npm run clean
rm -rf node_modules package-lock.json
npm install
```

**태그 중복 오류**
```bash
# 기존 태그 삭제
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
```

**Electron 빌드 오류**
```bash
# Electron 재설치
npm uninstall electron
npm install electron --save-dev
```

## 📞 지원

릴리스 과정에서 문제가 발생하면:
- GitHub Issues에 문제 보고
- 팀 채널에서 도움 요청
- 이전 릴리스 로그 확인

---

**마지막 업데이트**: 2025-10-25  
**다음 검토 예정**: 매 분기별 또는 주요 릴리스 후