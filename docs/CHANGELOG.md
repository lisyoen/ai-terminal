# 변경사항 (CHANGELOG)

이 파일은 AI Terminal 프로젝트의 주요 변경사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며,
이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [Unreleased]

### 예정사항
- [ ] 터미널 테마 커스터마이징

## [0.8.0] - 2025-10-25 - 빌드 시스템 및 배포 준비

### 추가됨
- Windows 배포 시스템 (electron-builder 설정)
- NSIS 설치형 빌드 지원
- 포터블 실행 파일 생성
- 자동 업데이트 시스템 (선택적, 기본 비활성화)
- 프로덕션 빌드 스크립트 (`start:prod`)
- 배포용 빌드 스크립트 (`dist:win`, `dist:portable`)

### 개선됨
- 개발/프로덕션 환경 분리 개선
- package.json 빌드 설정 정비
- README.md에 빌드/배포 가이드 추가
- DevTools 자동 열림 비활성화 (프로덕션)

### 기술적 개선
- electron-builder 통합 및 설정
- 코드 서명 옵션 (기본 비활성화)
- 자동 업데이트 인프라 구축
- 빌드 아티팩트 경로 정규화

### 수정됨
- 프로덕션 빌드에서 파일 경로 문제 해결
- Windows 배포 환경 호환성 개선
- [ ] 다중 탭 지원
- [ ] 명령 자동완성 기능
- [ ] 설정 UI 추가

---

## [0.8.0] - 2024-12-29

### 추가됨 ✨
- **Windows 배포 시스템**: electron-builder 기반 패키징
- **NSIS 인스톨러**: One-click Windows 인스톨러 지원
- **포터블 앱**: 설치 없이 실행 가능한 독립 실행 파일
- **자동 업데이트**: GitHub Releases 기반 자동 업데이트 시스템
- **배포 스크립트**: 
  - `npm run dist:win` - NSIS 인스톨러 생성
  - `npm run dist:portable` - 포터블 앱 생성
  - `npm run start:prod` - 프로덕션 모드 실행

### 변경됨 🔄
- **main.ts**: AUTO_UPDATE 환경 변수 지원 및 Help 메뉴 추가
- **package.json**: electron-updater 의존성 및 빌드 스크립트 추가
- **빌드 구성**: electron-builder.yml 설정 파일 추가

### 기술적 개선 🔧
- **자동 업데이트 프로바이더**: GitHub 리포지토리 연동
- **코드 서명**: 개발 환경에서는 비활성화, 프로덕션용 설정 준비
- **파일 압축**: 7z 최대 압축으로 배포 파일 크기 최적화
- **메뉴 시스템**: Help → Check for Updates 메뉴 항목 추가

### 배포 정보 📦
- **앱 ID**: `com.lisyoen.ai-terminal`
- **포터블 앱 크기**: ~158MB
- **지원 플랫폼**: Windows 10/11 x64
- **출력 위치**: `dist/release/`

---

## [0.5.0] - 2024-12-28

### 추가됨 ✨
- **SSH 원격 실행 기능**: PowerShell 기반 SSH 명령 실행
- **세션 로깅 시스템**: JSONL 형식 구조화된 로그
- **명령 히스토리 관리**: 중복 제거 및 검색 기능
- **UI 개선사항**:
  - 히스토리 드롭다운 메뉴
  - 토스트 알림 시스템
  - 키보드 단축키 (Ctrl+↑, Ctrl+Enter)
- **로그 로테이션**: 10MB 단위 자동 파일 분할
- **개발 도구**: ESLint, Prettier 설정

### 변경됨 🔄
- `terminal.ts`: SSH 실행 로직 추가
- `ChatPanel.tsx`: 히스토리 UI 통합
- `styles.css`: 새로운 컴포넌트 스타일 추가
- `.gitignore`: 보안 강화 및 로그 파일 제외

### 수정됨 🐛
- child_process 기반 터미널 실행으로 안정성 향상
- Windows PowerShell 호환성 문제 해결
- 메모리 누수 방지를 위한 프로세스 정리

### 보안 🔒
- API 키 및 민감 정보 .gitignore 추가
- PowerShell 스크립트 매개변수 검증 강화
- 로그 파일 위치 APPDATA로 변경

---

## [0.4.0] - 2024-12-27

### 추가됨 ✨
- **터미널-AI 통합**: 명령 실행 후 AI 제안 기능
- **스냅샷 시스템**: 터미널 상태 추적 및 기록
- **LLM 캐시**: 네트워크 오류 시 목업 응답
- **IPC 브리지**: 프론트엔드-백엔드 통신 강화

### 변경됨 🔄
- TypeScript 설정 최적화
- Vite 빌드 구성 개선
- React 컴포넌트 구조 정리

---

## [0.3.0] - 2024-12-26

### 추가됨 ✨
- **2-페인 레이아웃**: 터미널(좌) + AI 채팅(우)
- **실시간 터미널**: PowerShell 프로세스 연동
- **OpenAI API 통합**: gpt-4o-mini 기본 모델
- **환경 변수 설정**: .env 파일 지원

### 기술 스택 🛠️
- Electron 32.0.0
- React 18.3.1
- TypeScript 5.6.2
- Vite 5.4.2

---

## [0.2.0] - 2024-12-25

### 추가됨 ✨
- 기본 Electron 앱 구조
- React 렌더러 프로세스
- 빌드 스크립트 설정

---

## [0.1.0] - 2024-12-24

### 추가됨 ✨
- 프로젝트 초기 설정
- package.json 구성
- 개발 환경 구축

---

## 범례

- ✨ 추가됨 (Added)
- 🔄 변경됨 (Changed)  
- 🐛 수정됨 (Fixed)
- 🗑️ 제거됨 (Removed)
- 🔒 보안 (Security)
- 💥 호환성 변경 (Breaking Changes)