#!/bin/zsh
cd "${0:A:h}"
if [[ -f .logs/platform.pid ]]; then
  campus_pid=$(cat .logs/platform.pid)
  if ps -p "$campus_pid" -o command= | grep -q 'scripts/serve.mjs'; then
    kill "$campus_pid"
    echo "Платформа остановлена."
  fi
  rm -f .logs/platform.pid
fi
