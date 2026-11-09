#!/bin/zsh
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "${0:A:h}"
mkdir -p .logs
if [[ ! -f dist/index.html ]]; then
  echo "Готовим платформу…"
  npm run build
fi
if ! curl --noproxy '*' --max-time 2 --silent --fail http://127.0.0.1:5173/ >/dev/null; then
  nohup node scripts/serve.mjs > .logs/platform.log 2>&1 < /dev/null &
  echo $! > .logs/platform.pid
  for attempt in {1..30}; do
    if curl --noproxy '*' --max-time 2 --silent --fail http://127.0.0.1:5173/ >/dev/null; then break; fi
    sleep 0.2
  done
fi
open http://127.0.0.1:5173/
echo "Платформа открыта. Это окно можно закрыть."
