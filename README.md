# AI Terminal

AI Terminal은 터미널 명령 실행과 AI 지원 기능을 결합한 Electron 기반 애플리케이션입니다. 왼쪽 터미널 패널과 오른쪽 AI 채팅 패널로 구성된 2-페인 인터페이스를 제공합니다.

![AI Terminal Screenshot](docs/screenshots/main-interface.png)

## 주요 기능

### 🚀 실시간 터미널 실행
- **로컬 PowerShell 세션**: 실제 PowerShell 프로세스 연동
- **SSH 원격 실행**: 단발성 SSH 명령 실행 지원
- **실시간 출력 스트리밍**: stdout/stderr 즉시 표시

### 📊 세션 로깅 시스템
- **JSONL 형식 로그**: 구조화된 로그 데이터
- **자동 로그 로테이션**: 10MB 단위 파일 분할
- **로그 위치**: `%APPDATA%/ai-terminal/logs/{YYYYMMDD}.jsonl`

### 📝 명령 히스토리 관리
- **스마트 히스토리**: 중복 제거 및 메타데이터 저장
- **키보드 단축키**: Ctrl+↑ (이전 명령), Ctrl+Enter (전송)
- **히스토리 파일**: `%APPDATA%/ai-terminal/history.json`

### 🤖 AI 지원 기능
- **OpenAI API 연동**: gpt-4o-mini 기본 모델
- **스마트 명령 제안**: 터미널 출력 분석 후 다음 명령 제안
- **LLM 응답 캐시**: 네트워크 오류 시 목업 응답

### 🌐 SSH 기능
- **단발 SSH 실행**: `ssh://user@host` 형식 지원
- **PowerShell 스크립트 기반**: 크로스 플랫폼 호환
- **실시간 결과 표시**: 원격 명령 실행 결과 즉시 확인

## 빠른 시작

### 1. 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 별도 터미널에서 Electron 앱 실행
npx electron dist/electron/main.js
```

### 2. LLM 설정 (선택사항)

1. `.env.example`을 `.env`로 복사
2. OpenAI API 키 설정:

```env
OPENAI_API_KEY=sk-your-actual-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

### 3. SSH 사용 예시

1. 채팅 패널에서 "SSH Remote" 선택
2. 대상 서버 입력: `user@hostname`
3. 명령 실행:

```bash
uname -a && whoami && pwd
ls -la /home
```

## 스크린샷

| 기능 | 스크린샷 |
|------|----------|
| 메인 인터페이스 | ![Main](docs/screenshots/main-interface.png) |
| SSH 실행 | ![SSH](docs/screenshots/ssh-execution.png) |
| 히스토리 드롭다운 | ![History](docs/screenshots/history-dropdown.png) |
| 토스트 알림 | ![Toast](docs/screenshots/toast-notifications.png) |

## 프로젝트 구조

```
ai-terminal/
├── electron/                 # Electron 메인 프로세스
│   ├── main.ts               # 앱 진입점
│   ├── terminal.ts           # 터미널 관리자
│   ├── session-logger.ts     # 세션 로깅
│   ├── command-history.ts    # 명령 히스토리
│   └── llm-client.ts         # LLM API 클라이언트
├── src/                      # React 렌더러 프로세스
│   ├── components/           # UI 컴포넌트
│   └── styles.css           # 스타일시트
├── scripts/                  # 외부 스크립트
│   └── pwsh/
│       └── Invoke-AiSsh.ps1  # SSH 실행 스크립트
└── docs/                     # 문서 및 스크린샷
```

## 사용자 데이터 위치

- **로그 파일**: `%APPDATA%/ai-terminal/logs/`
- **히스토리 파일**: `%APPDATA%/ai-terminal/history.json`
- **설정 파일**: 프로젝트 루트의 `.env`

## 개발 가이드

### 스크립트 명령어

```bash
npm run dev          # Vite 개발 서버 시작
npm run build        # TypeScript 컴파일
npm run lint         # ESLint 실행
npm run format       # Prettier 포맷팅
npm run electron     # Electron 앱 실행
```

### 환경 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 키 | - |
| `OPENAI_BASE_URL` | API 엔드포인트 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 사용할 모델 | `gpt-4o-mini` |
| `NODE_ENV` | 환경 모드 | `development` |
| `VITE_DEV_SERVER_URL` | Vite 서버 URL | `http://localhost:5173` |

## 기술 스택

- **프레임워크**: Electron + React + TypeScript
- **빌드 도구**: Vite + esbuild
- **UI**: CSS Grid + Flexbox
- **터미널**: child_process (PowerShell)
- **로깅**: JSONL + 로그 로테이션
- **AI**: OpenAI API (ChatGPT)

## 빌드 및 배포

### 시스템 요구사항

- **Node.js**: 20.x 이상
- **Windows**: Windows 10/11 (64-bit)
- **여유 공간**: 2GB 이상
- **권한**: 개발자 모드 또는 관리자 권한 (심볼릭 링크 생성용)

### 개발 빌드

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 별도 터미널에서 Electron 실행
npm run build:electron
npm run electron
```

### 프로덕션 빌드

```bash
# 전체 빌드 (Renderer + Electron)
npm run build

# 프로덕션 실행
npm run start:prod
```

### Windows 배포판 생성

```bash
# NSIS 설치형 (.exe)
npm run dist:win

# 포터블 버전 (압축 해제 후 실행)
npm run dist:portable
```

### 빌드 결과물

- **설치형**: `release/AI-Terminal-0.5.0-Setup.exe`
- **포터블**: `release/win-unpacked/AI Terminal.exe`

### 자동 업데이트 설정 (선택사항)

기본적으로 자동 업데이트는 비활성화되어 있습니다.

```bash
# .env 파일에 추가
AUTO_UPDATE=true
```

활성화 시 Help 메뉴에서 "Check for Updates" 옵션이 표시됩니다.

### 일반적인 빌드 문제

**권한 오류 (EACCES):**
```bash
# PowerShell을 관리자 권한으로 실행
# 또는 개발자 모드 활성화 (설정 > 업데이트 및 보안 > 개발자용)
```

**코드 서명 오류:**
```bash
# 코드 서명 비활성화 (개발용)
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"
npm run dist:portable
```

**캐시 문제:**
```bash
# 캐시 삭제 후 재시도
Remove-Item -Recurse -Force node_modules/.cache
Remove-Item -Recurse -Force dist
npm run build
```

**심볼릭 링크 오류:**
```bash
# Windows 개발자 모드 활성화 필요
# 또는 관리자 권한으로 PowerShell 실행
```

## 라이선스

MIT License

## 기여 방법

1. 이슈 생성 또는 기존 이슈 확인
2. 기능 브랜치 생성: `git checkout -b feature/new-feature`
3. 변경사항 커밋: `git commit -m "feat: 새로운 기능 추가"`
4. 브랜치 푸시: `git push origin feature/new-feature`
5. Pull Request 생성

## 문제 해결

### 자주 발생하는 문제

**Q: 터미널에 출력이 나타나지 않아요**
A: PowerShell 경로를 확인하세요: `where.exe pwsh` 또는 `where.exe powershell`

**Q: LLM API 호출이 실패해요**
A: `.env` 파일의 `OPENAI_API_KEY`가 올바른지 확인하세요

**Q: SSH 연결이 안돼요**
A: SSH 키 설정과 대상 서버 접근 권한을 확인하세요

**Q: 포트 충돌이 발생해요**
A: `netstat -an | findstr :5173`으로 사용 중인 포트를 확인하세요

### 로그 확인

```powershell
# 오늘 생성된 로그 확인
Get-Content "$env:APPDATA\ai-terminal\logs\$(Get-Date -Format 'yyyyMMdd').jsonl"

# 명령 히스토리 확인
Get-Content "$env:APPDATA\ai-terminal\history.json" | ConvertFrom-Json
```

## 빌드 및 배포

### 개발 빌드

```powershell
# 개발 모드 실행
npm run dev

# 프로덕션 모드 실행
npm run start:prod
```

### Windows 배포 패키지 생성

```powershell
# 포터블 실행 파일 생성 (코드 서명 없음)
npm run dist:portable

# NSIS 인스톨러 생성 (코드 서명 필요)
npm run dist:win
```

생성된 파일:
- **포터블 앱**: `dist/release/win-unpacked/AI Terminal.exe` (158MB)
- **NSIS 인스톨러**: `dist/release/AI Terminal Setup 0.8.0.exe` (코드 서명 시)

### 자동 업데이트

프로덕션 빌드에서는 GitHub Releases를 통한 자동 업데이트를 지원합니다:

```javascript
// 환경 변수로 제어
AUTO_UPDATE=true npm run start:prod
```

자동 업데이트 기능:
- GitHub Releases API 연동
- 백그라운드 다운로드
- 재시작 후 업데이트 적용
- Help 메뉴에서 수동 확인 가능

### 빌드 요구사항

- **Node.js**: 18.x 이상
- **npm**: 9.x 이상
- **운영체제**: Windows 10/11 x64
- **코드 서명** (선택): 인증서 파일 (.p12) 및 비밀번호

### 배포 구성

`electron-builder.yml`에서 설정:
- **앱 ID**: `com.lisyoen.ai-terminal`
- **출력 디렉터리**: `dist/release`
- **대상 플랫폼**: Windows x64
- **압축**: 7z (최대 압축)

## 버전 히스토리

최신 변경사항은 [CHANGELOG.md](docs/CHANGELOG.md)를 참조하세요.

---

**AI Terminal** - 터미널과 AI의 완벽한 조화 🚀