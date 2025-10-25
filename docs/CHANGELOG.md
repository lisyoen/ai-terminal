# 변경사항 (CHANGELOG)

이 파일은 AI Terminal 프로젝트의 주요 변경사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며,
이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [Unreleased]

### 예정사항
- [ ] 터미널 테마 커스터마이징
- [ ] 다중 탭 지원
- [ ] 명령 자동완성 기능
- [ ] 설정 UI 추가

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