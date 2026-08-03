#!/bin/bash

cd "$(dirname "$0")"

echo "🚀 BibleBell 업데이트 시작"

git add .

git commit -m "Update BibleBell"

git push origin main

echo "✅ GitHub 업로드 완료"
read -p "종료하려면 Enter..."
