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

이 문서는 **새로운 Windows 환경에서 rus-creator-proto 프로젝트를 처음 세팅할 때**
필요한 모든 개발 환경 설정 절차를 정리한 가이드입니다.

---

## 🧱 System Requirements

| 구성 요소                 | 권장 버전             | 비고                                |
| ------------------------- | --------------------- | ----------------------------------- |
| OS                        | Windows 10 / 11 (x64) | 관리자 권한 필요                    |
| Node.js                   | v20.x (LTS 이상)      | NVM 사용 권장                       |
| PNPM                      | v10.x 이상            | 전역 설치 필요                      |
| Python                    | 3.8 ~ 3.11            | node-gyp용                          |
| Visual Studio Build Tools | 2022 (v17.x)          | “Desktop development with C++” 필수 |
| Electron                  | 38.5.0                | Node 20 기반                        |

---

## ⚙️ 1. 필수 도구 설치

### 1-1. Node.js 설치

[NVM for Windows](https://github.com/coreybutler/nvm-windows/releases) 설치 후:

```powershell
nvm install 20.12.2
nvm use 20.12.2
```

### 1-2. PNPM 설치

```powershell
npm install -g pnpm
```

### 1-3. Python 설치

```powershell
winget install Python.Python.3.11
python --version
```

### 1-4. Visual Studio Build Tools 설치

[공식 다운로드 페이지](https://visualstudio.microsoft.com/downloads/) →  
“**Build Tools for Visual Studio 2022**” 선택 후 아래 항목 체크:

- ✅ MSVC v143 C++ x64/x86 build tools
- ✅ Windows 10 SDK (10.0.x)
- ✅ CMake tools for Windows
- ✅ Windows Debugging Tools

---

## 🧩 2. 환경 변수 설정

PowerShell(관리자 아님)에서 실행:

```powershell
setx GYP_MSVS_VERSION 2022
```

터미널 재시작 후 확인:

```powershell
echo $env:GYP_MSVS_VERSION
# 출력: 2022
```

> 💡 node-gyp이 VS2022를 인식하지 못하는 문제를 방지하기 위함입니다.

---

## 🪄 3. 프로젝트 클론 및 패키지 설치

```powershell
git clone https://github.com/<YOUR_ORG>/rus-creator-proto.git
cd rus-creator-proto
pnpm install
```

---

## 🧰 4. Native Module (ffi-napi) 세팅

Electron 38.5.0 + Node 20.x 환경에서는 기존 `ffi-napi@4.0.3`이 빌드되지 않기 때문에  
호환 포크 버전을 사용합니다.

```powershell
pnpm add ffi-napi@4.0.3 ref-napi@3.0.3
```

빌드 시 에러 발생 시, 아래 명령으로 재컴파일합니다:

```powershell
pnpx electron-rebuild -f -w ffi-napi --version 38.5.0
```

성공 시 로그:

```
√ Rebuild Complete
```

> 💡 이 명령은 Electron 버전에 맞게 native 모듈을 재컴파일합니다.

---

## 🧩 5. Visual Studio Build Tools 인식 확인

```powershell
where msbuild
where cl
```

정상일 경우:

```
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\amd64\MSBuild.exe
C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.x.xxxxx\bin\Hostx64\x64\cl.exe
```

---

## 🧠 6. Electron 앱 빌드 & 실행

### 개발용 실행

```powershell
pnpm dev
```

### 윈도우 빌드

```powershell
pnpm build:win
```

> 결과물은 `/dist` 폴더에 생성됩니다.

---

## 🧾 7. 문제 해결 가이드

| 증상                                            | 원인                                      | 해결책                              |
| ----------------------------------------------- | ----------------------------------------- | ----------------------------------- |
| `Could not find any Visual Studio installation` | VS Build Tools 미설치 또는 PATH 인식 실패 | `setx GYP_MSVS_VERSION 2022` 실행   |
| `error C2440` (get-uv-event-loop-napi-h)        | ffi-napi 구버전 불호환                    | Electron rebuild 수행               |
| `MODULE_NOT_FOUND: ffi_bindings.node`           | rebuild 미수행                            | `pnpx electron-rebuild` 재실행      |
| Python not found                                | node-gyp용 Python 누락                    | `winget install Python.Python.3.11` |

---

## 🧩 8. 확인용 테스트 코드

```js
const ffi = require('ffi-napi')
const ref = require('ref-napi')

console.log('ffi loaded:', !!ffi.Library)
```

실행 시:

```
ffi loaded: true
```

가 출력되면 빌드 성공입니다 ✅

---

## 📦 9. 빌드 환경 백업 팁

프로젝트 루트에 `.npmrc` 파일을 추가해두면, 다른 PC에서도 동일한 환경 유지가 가능합니다.

```ini
node-linker=hoisted
strict-peer-dependencies=false
auto-install-peers=true
```

---

## 🧭 Version Summary

| 항목          | 버전             |
| ------------- | ---------------- |
| Node.js       | 20.12.2          |
| PNPM          | 10.20.0          |
| Electron      | 38.5.0           |
| ffi-napi      | 4.0.3            |
| ref-napi      | 3.0.3            |
| Visual Studio | 2022 Build Tools |
| Python        | 3.11.x           |

---

## ✅ 최종 체크리스트

- [x] Node + PNPM 설치 완료
- [x] Visual Studio Build Tools 설치 및 인식
- [x] GYP_MSVS_VERSION=2022 설정
- [x] Python 설치
- [x] `pnpm install` 정상 완료
- [x] `pnpx electron-rebuild` 성공
- [x] 앱 실행 정상 확인 (`ffi loaded: true`)
      .

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
