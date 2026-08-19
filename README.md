# 도전 바이블 골든벨 (BibleBell PUBLIC FINAL)

GitHub Pages에서 실행하고, 각 사용자가 자기 문제·이미지·영상·오디오를 자기 컴퓨터에 보관하여 사용하는 100문제 BibleBell 공개판입니다.

## 기본 구조

- **GitHub/PWA**: 공통 프로그램 틀
- **브라우저 저장소**: 같은 컴퓨터·같은 브라우저에서 작업 이어쓰기
- **BibleBell_Data**: Excel + JSON + 미디어를 함께 보관·이동하는 사용자 데이터 폴더

## 사용 시작

1. `https://bibleplay.github.io/BibleBell/` 접속
2. 홈의 **앱 설치** 사용
   - 브라우저가 공식 PWA 설치창을 지원하면 바로 설치창이 열립니다.
   - 그렇지 않으면 현재 환경에 맞는 설치 방법을 안내합니다.
3. 관리자 모드에서 **저장 위치 지정**
4. 문제/미디어 편집
5. 작업을 마친 뒤 **데이터 보내기**

## 다른 컴퓨터로 이동

`BibleBell_Data` 폴더 전체를 복사한 뒤 새 컴퓨터에서 같은 BibleBell 웹을 열고:

**관리자 모드 → 데이터 불러오기 → 가져온 BibleBell_Data 선택**

문제와 미디어를 복원합니다.

> Excel만 옮기면 문제 글자는 복원할 수 있지만 실제 그림·영상·오디오 파일은 함께 이동하지 않습니다. 완전한 이동은 `BibleBell_Data` 전체를 사용하세요.

## 게임 구조

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
