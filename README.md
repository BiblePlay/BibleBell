# 도전 바이블 골든벨 MVP

## 실행

```bash
npm install
npm run dev
```

브라우저에서 표시되는 주소(기본값 `http://localhost:5173`)로 접속합니다.

## 포함 기능

- 10개 카테고리
- 카테고리별 5문제
- 문제 화면
- 정답 보기/숨기기
- 메인으로 이동
- 4개 조 점수 +1 / -1
- 점수 초기화
- 전체화면
- 반응형 레이아웃

## 구조

- `src/components`: 공통 UI
- `src/pages`: 화면
- `src/data`: 카테고리/문제 데이터
- `src/types`: 타입
- `src/styles`: 전역 스타일

문제는 `src/data/questions.ts`에서 계속 추가할 수 있습니다.
