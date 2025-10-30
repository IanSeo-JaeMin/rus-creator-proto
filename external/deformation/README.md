# Deformation External Executables

이 폴더에는 Deformation 하위 메뉴별 실행 파일을 저장합니다.

## 폴더 구조

```
external/deformation/
├── pneumo-editor/  - Pneumo Editor 실행 파일 (3D 모델 편집)
└── hu3d-maker/     - hu3D Maker 실행 파일 (메인)
```

## 사용 방법

1. 각 하위 메뉴 폴더에 실행 파일을 추가하세요.
2. 지원되는 파일 형식: `.exe`, `.bat`, `.cmd`, `.ps1`
3. 각 폴더에는 하나의 실행 파일만 필요합니다.
4. 실행 파일이 있으면 해당 메뉴가 자동으로 활성화됩니다.

## 예시

예를 들어, Pneumo Editor 메뉴를 활성화하려면:

- `external/deformation/pneumo-editor/myApp.exe` 파일을 생성하세요.
- RUS Creator를 재시작하면 자동으로 Pneumo Editor 메뉴가 활성화됩니다.

## 참고

- Pneumo Editor: 3D 모델을 편집할 수 있는 기능입니다.
- hu3D Maker: Deformation의 메인 실행 파일입니다.
