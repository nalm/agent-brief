#!/usr/bin/env bash
# Stop keep-alive, tunnels, and this app's node, then start them again.
# The public hostname changes. Read public-url.txt afterwards.
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p "$ROOT/logs"

if [[ -f "$ROOT/.keepalive.pid" ]]; then
  kp="$(cat "$ROOT/.keepalive.pid" 2>/dev/null || true)"
  if [[ -n "${kp:-}" ]] && kill -0 "$kp" 2>/dev/null; then
    kill "$kp" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
      kill -0 "$kp" 2>/dev/null || break
      sleep 0.2
    done
    kill -9 "$kp" 2>/dev/null || true
  fi
fi

kill_matching() {
  local sig="$1" needle="$2" prefix="$3" pid cmd
  for pid in $(pgrep -f "$needle" || true); do
    cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
    case "$cmd" in
      "$prefix"*|*" $prefix"*) kill "$sig" "$pid" 2>/dev/null || true ;;
    esac
  done
}
kill_matching -TERM "$ROOT/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4173" "$ROOT/bin/cloudflared"
kill_matching -TERM "nokey@localhost.run" "ssh "
sleep 0.5
kill_matching -KILL "$ROOT/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4173" "$ROOT/bin/cloudflared"
kill_matching -KILL "nokey@localhost.run" "ssh "

pid="$(ss -ltnp 2>/dev/null | awk '/:4173 /{print}' | grep -oE 'pid=[0-9]+' | head -n 1 | cut -d= -f2 || true)"
if [[ -n "${pid:-}" ]]; then
  cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
  if [[ "$cmd" == *server.js* ]]; then
    kill "$pid" 2>/dev/null || true
    sleep 0.3
    kill -9 "$pid" 2>/dev/null || true
  fi
fi

rm -f "$ROOT/public-url.txt" "$ROOT/.tunnel.pid" "$ROOT/.server.pid" "$ROOT/.cf429"
setsid nohup "$ROOT/keepalive.sh" >> "$ROOT/logs/keepalive.out" 2>&1 < /dev/null &
echo "restarted. A new public URL will be written to $ROOT/public-url.txt"
