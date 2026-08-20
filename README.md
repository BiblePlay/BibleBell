# 도전 바이블 골든벨 (BibleBell PUBLIC FINAL)

GitHub Pages에서 실행하고, 각 사용자가 자기 문제·이미지·영상·오디오를 자기 컴퓨터에 보관하여 사용하는 100문제 BibleBell 공개판입니다.

## 가장 중요한 사용 흐름

1. `https://bibleplay.github.io/BibleBell/` 접속
2. 문제와 미디어를 편집
3. 처음 **전체 데이터 저장**을 누를 때 저장할 **위치만** 선택
4. BibleBell이 선택한 위치 안에 항상 `BibleBell_Data` 폴더를 자동 생성
5. 이후 **전체 데이터 저장**은 같은 `BibleBell_Data`를 계속 최신 상태로 갱신
6. 다른 컴퓨터에서는 **전체 데이터 불러오기 → `BibleBell_Data` 폴더 자체 선택**

사용자가 `BibleBell_Data`라는 폴더 이름을 직접 만들 필요는 없습니다.

## BibleBell_Data

```text
BibleBell_Data/
├── questions.xlsx
├── questions.json
├── manifest.json
└── media/
    ├── images/
    ├── videos/
    └── audio/
```

- **GitHub 웹**: 공통 프로그램 틀
- **브라우저 저장소**: 같은 컴퓨터·같은 브라우저에서 작업 이어쓰기
- **BibleBell_Data**: Excel + JSON + 미디어를 함께 보관·백업·이동하는 기준 폴더
- **BibleGoldenBell 바로가기**: 바탕화면에서 더블클릭해 같은 BibleBell 웹을 여는 실행 바로가기

관리자 화면의 **저장 폴더 열기**에서 현재 연결된 `BibleBell_Data` 위치를 언제든 확인할 수 있습니다. 웹 브라우저 보안상 Finder/탐색기 창을 강제로 직접 실행하는 대신, 연결된 위치를 시스템 폴더 창에서 열어 확인하는 방식입니다.

## 다른 컴퓨터로 이동

`BibleBell_Data` 폴더 전체를 USB·외장하드·클라우드 등으로 복사한 뒤 새 컴퓨터에서 같은 BibleBell 웹을 열고:

**관리자 모드 → 전체 데이터 불러오기 → `BibleBell_Data` 폴더 자체 선택**

그 위 폴더나 `media` 하위 폴더를 선택하지 않습니다.

> Excel만 옮기면 문제 글자는 복원할 수 있지만 실제 그림·영상·오디오 파일은 함께 이동하지 않습니다. 완전한 이동은 `BibleBell_Data` 전체를 사용하세요.

## 게임 구조 — 변경 금지 기준

- 10개 카테고리 × 10문제 = 100문제
- 번호별 고정 점수: `10,10,20,20,30,30,40,40,50,50`
- 카테고리 + 번호가 문제 위치
- 문제유형/답변유형은 문제별로 변경 가능
- Excel Import/Export 시 정렬 순서와 무관하게 카테고리+번호 기준 복원

## 개발 실행

```bash
npm install
npm run dev
```

배포는 `.github/workflows/deploy.yml`의 GitHub Pages workflow를 사용합니다.


## 저장 폴더 규칙
- 사용자는 `전체 데이터 저장`을 누른 뒤 저장할 **위치만** 선택합니다.
- `BibleBell_Data` 폴더를 직접 만들 필요가 없습니다. BibleBell이 선택한 위치 안에 자동 생성합니다.
- 이후 `저장 폴더 열기`로 연결 위치를 확인하고, `저장 위치 변경`은 위치를 바꿀 때만 사용합니다.
- 다른 컴퓨터에서는 `전체 데이터 불러오기`에서 `BibleBell_Data` 폴더 자체를 선택합니다.
