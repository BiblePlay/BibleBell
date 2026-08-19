#!/bin/zsh

# 이 파일이 들어 있는 BibleBell 폴더를 기준으로 실행합니다.
# 컴퓨터마다 경로가 달라도 절대경로를 수정할 필요가 없습니다.
cd -- "$(dirname -- "$0")" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm이 필요합니다. 웹 버전만 사용할 경우 이 파일을 실행할 필요가 없습니다."
  read "?Enter를 누르면 종료합니다."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "처음 실행 준비 중입니다. 필요한 패키지를 설치합니다..."
  npm install || exit 1
fi

npm run dev
