#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo 'Node.js 24 LTSをインストールしてから、もう一度実行してください。https://nodejs.org/'
  exit 1
fi
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22||(major===22&&minor<12)){console.error("Node.js 22.12以上が必要です。24 LTSを推奨します。");process.exit(1)}'
npm ci
printf '\n起動したら、ブラウザで http://localhost:3000 を開いてください。終了は Control+C。\n'
exec npm run dev
