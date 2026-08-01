#!/bin/bash

# 이 파일이 있는 프로젝트 폴더로 이동
cd "$(dirname "$0")"

echo "🚀 BibleBell 시작 중..."

# 의존성 확인
if [ ! -d "node_modules" ]; then
    echo "📦 처음 실행입니다. npm install을 실행합니다..."
    npm install
fi

# 개발 서버 실행
npm run dev &
PID=$!

# 서버가 시작될 때까지 잠시 대기
sleep 3

# 브라우저 자동 열기
open http://localhost:5173

# 서버가 종료될 때까지 대기
wait $PID