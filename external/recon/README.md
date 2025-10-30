# RECON External Executables

이 폴더에는 RECON 하위 메뉴별 실행 파일을 저장합니다.

## 폴더 구조

```
external/recon/
├── stomach/    - 위(Stomach) 관련 실행 파일
├── kidney/     - 신장(Kidney) 관련 실행 파일
├── lung/       - 폐(Lung) 관련 실행 파일
├── liver/      - 간(Liver) 관련 실행 파일
└── colon/      - 대장(Colon) 관련 실행 파일
```

## 사용 방법

1. 각 부위별 폴더에 실행 파일을 추가하세요.
2. 지원되는 파일 형식: `.exe`, `.bat`, `.cmd`, `.ps1`
3. 각 폴더에는 하나의 실행 파일만 필요합니다.
4. 실행 파일이 있으면 해당 메뉴가 자동으로 활성화됩니다.

## 예시

예를 들어, kidney 메뉴를 활성화하려면:

- `external/recon/kidney/myApp.exe` 파일을 생성하세요.
- RUS Creator를 재시작하면 자동으로 Kidney 메뉴가 활성화됩니다.
