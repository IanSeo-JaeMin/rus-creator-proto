# rus-creator

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows (권장: Windows에서 직접 빌드)
$ pnpm build:win

# For windows (빌드만 실행, 의존성 설치 제외)
$ pnpm build:win:local

# For macOS (quarantine 속성 자동 제거 포함)
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```

#### Windows 빌드 방법

**⚠️ 중요:** Windows 빌드는 반드시 **Windows 환경에서 직접 빌드**해야 합니다.

**빌드 방법:**
```bash
# Windows에서 실행
pnpm install
pnpm build:win
```

**필수 요구사항:**

1. **Node.js** (v22 권장)
   - 다운로드: https://nodejs.org/

2. **pnpm**
   ```bash
   npm install -g pnpm
   ```

3. **Visual Studio Build Tools** (필수 - native modules 빌드용)
   - 다운로드: https://visualstudio.microsoft.com/downloads/
   - 설치 시 **"Desktop development with C++"** 워크로드 선택
   - 또는 **"Build Tools for Visual Studio"** 다운로드 후 C++ 도구 설치

4. **Python** (node-gyp를 위한, 대부분 Node.js 설치 시 포함됨)
   - Python 3.x 필요
   - 설치 확인: `python --version`

**설치 확인:**
```bash
# Visual Studio Build Tools 확인
where cl
# 또는
gyp --version
```

**빌드 스크립트:**
- `pnpm build:win` - 전체 빌드 (의존성 설치 + 빌드)
- `pnpm build:win:local` - 빠른 빌드 (이미 의존성이 설치된 경우)

**참고:** 이 프로젝트는 현재 프로토타입 단계이며, Windows에서 직접 빌드하도록 설정되어 있습니다. CI/CD 워크플로우(`.github/workflows/build-windows.yml`)는 프로덕션 단계에서 사용할 수 있도록 준비되어 있습니다.

## macOS 빌드 파일 실행 시 "손상된 파일" 오류 해결 방법

macOS에서 빌드된 파일을 다른 컴퓨터로 전송할 때 "손상된 파일"이라는 오류가 발생할 수 있습니다. 이는 macOS Gatekeeper의 보안 정책 때문입니다.

> **참고**: `pnpm build:mac` 명령어는 빌드 후 자동으로 quarantine 속성을 제거합니다. 하지만 다른 컴퓨터로 전송한 파일은 다시 다운로드하면 quarantine 속성이 재부여될 수 있습니다.

### 해결 방법 1: 터미널에서 quarantine 속성 제거 (권장)

받은 파일을 다운로드 폴더에서 실행하려고 할 때 다음 명령어를 실행하세요:

**ZIP 파일의 경우:**

```bash
# ZIP 파일 압축 해제 후
cd ~/Downloads
unzip rus-creator-1.0.0-arm64-mac.zip
xattr -cr rus-creator.app
```

**DMG 파일의 경우:**

```bash
# DMG 파일 마운트 후
xattr -cr /Volumes/rus-creator/rus-creator.app
# 앱을 Applications로 복사한 후
xattr -cr /Applications/rus-creator.app
```

**또는 간단하게:**

```bash
# 다운로드 받은 파일 경로를 직접 지정
xattr -cr ~/Downloads/rus-creator.app
```

### 해결 방법 2: 시스템 설정에서 실행 허용

1. 파일을 한 번 실행해보면 "파일이 손상되었습니다" 메시지가 나옵니다.
2. **시스템 설정** > **개인정보 보호 및 보안**으로 이동
3. 스크롤을 내려 "차단이 해제되었습니다" 버튼이 보이면 **"확인 없이 열기"** 클릭

### 참고사항

- 이 오류는 코드 서명이 없는 앱에서 정상적으로 발생하는 macOS의 보안 기능입니다.
- 프로덕션 배포를 위해서는 Apple Developer 인증서로 코드 서명하는 것을 권장합니다.
