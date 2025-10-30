RUS Creator 개발 기획 및 할일 목록

🧭 프로젝트 개요
• 목표: 의료영상 기반 프로젝트에서 다양한 외부 웹서비스(DICOM Viewer, WorkList 등) 및 외부 윈도우 프로그램(Recon, 3D 모델링 툴 등)을 통합 관리할 수 있는 데스크탑 애플리케이션을 개발한다.
• 플랫폼: Windows 전용
• 기술 스택: Electron (React + TypeScript), Node.js, ffi-napi (Windows API 제어)
• 핵심 기능:
• 좌측 메뉴 기반의 패널 UI
• 웹 기반 외부 서비스는 webview로 embed
• 외부 윈도우 프로그램은 spawn → HWND → SetParent로 embed
• 메뉴 전환 시 해당 embed된 요소를 보이거나 숨김 처리

⸻

⚙️ 시스템 아키텍처
• Main Process (Electron): 창 생성, 윈도우 제어, spawn + HWND 처리, IPC 핸들링
• Preload Script: Renderer와 Main 사이 안전한 IPC 브리지
• Renderer (React): 메뉴/레이아웃 구성, webview embed, 외부 프로그램 상태 요청

⸻

📋 초기 셋팅 TODO

1. 프로젝트 구조 구성
   • Vite + React + TypeScript 기반 프로젝트 생성 (renderer/)
   • Electron main process + preload 구성 (electron/)
   • concurrently + cross-env로 dev 모드 스크립트 설정
   • webview 태그 활성화 설정 (webPreferences.webviewTag = true)

2. 기본 UI 구성 (React)
   • 전체 레이아웃: 상단 바 + 좌측 메뉴 + 우측 콘텐츠
   • 좌측 메뉴: WorkList, DICOM Editor, Recon, 3D Modeling
   • 메뉴 클릭 시 상태 전환

3. 외부 웹서비스 embed
   • webview 태그로 WorkList, DICOM Editor embed
   • 메뉴 전환 시 webview 보여주기/숨기기

4. 외부 윈도우 프로그램 embed
   • ffi-napi, ref-napi, ref-struct-napi 설치
   • spawn으로 외부 EXE 실행
   • FindWindowA → HWND 확보
   • SetParent → Electron 창의 HWND로 설정
   • MoveWindow → 지정 영역에 위치
   • ShowWindow/HideWindow → 메뉴 전환에 따라 표시 제어

⸻

🛠️ 보완 계획
• 프로그램 종료 시 외부 프로세스 정리
• 외부 프로그램 종료 감지 및 재시작 옵션
• DPI, 스케일링 대응 (좌표 계산 보정)
• getBoundingClientRect()로 div 위치 → Electron main 전달 구조

⸻

🚀 배포 및 유지보수 계획
• Electron Builder 기반 Windows EXE 빌드
• Fixed 버전 Chromium 런타임 포함 (외부망 환경 대비)
• Settings 저장 구조 (JSON 또는 SQLite)
• 코드 정리 및 API 레이어 모듈화

⸻

🧠 향후 확장 아이디어
• 메뉴/레이아웃 커스터마이징 기능
• 외부 웹서비스 간 SSO (Single Sign-On)
• WebSocket 기반 상태 동기화
• drag & drop 방식의 외부 파일 import
