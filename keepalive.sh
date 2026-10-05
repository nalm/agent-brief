#!/usr/bin/env bash
# Restarts the MVP server and a public tunnel if either is down.
# Prefers a Cloudflare quick tunnel. If trycloudflare.com returns 429,
# falls back to localhost.run (no account) for 30 minutes.
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p "$ROOT/logs"
exec 9>"$ROOT/.keepalive.lock"
if ! flock -n 9; then
  echo "keepalive already running"
  exit 0
fi
echo $$ > "$ROOT/.keepalive.pid"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*" >> "$ROOT/logs/keepalive.log"
}

server_up() {
  curl -sf -o /dev/null --max-time 3 "http://127.0.0.1:4173/"
}

port_listening() {
  ss -ltn | awk '{print $4}' | grep -Eq '(^|:)4173$'
}

start_server() {
  if server_up; then
    return 0
  fi
  if port_listening; then
    log "port 4173 is listening but HTTP check failed; not spawning another node"
    return 1
  fi
  log "node down; starting server.js"
  setsid nohup node "$ROOT/server.js" >> "$ROOT/logs/server.log" 2>&1 < /dev/null &
  echo $! > "$ROOT/.server.pid"
  local _
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if server_up; then
      log "node is up"
      return 0
    fi
    sleep 0.5
  done
  log "node failed to become healthy"
  return 1
}

pids_matching() {
  local needle="$1" prefix="$2" pid cmd
  for pid in $(pgrep -f "$needle" || true); do
    cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
    case "$cmd" in
      "$prefix"*|*" $prefix"*) printf '%s\n' "$pid" ;;
    esac
  done
}

cf_pids() {
  pids_matching "$ROOT/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4173" "$ROOT/bin/cloudflared"
}

ssh_pids() {
  pids_matching "nokey@localhost.run" "ssh "
}

cf_cooled_down() {
  local marker="$ROOT/.cf429"
  if [[ ! -f "$marker" ]]; then
    return 0
  fi
  local now mtime
  now="$(date +%s)"
  mtime="$(stat -c %Y "$marker")"
  if (( now - mtime >= 1800 )); then
    return 0
  fi
  return 1
}

note_cf_failure() {
  local logf="$ROOT/logs/cloudflared.log"
  if [[ -n "$(cf_pids)" || ! -f "$logf" ]]; then
    return 0
  fi
  if ! grep -q "429" "$logf"; then
    return 0
  fi
  local now mtime
  now="$(date +%s)"
  mtime="$(stat -c %Y "$logf")"
  # Only a fresh failure counts. A stale log must not block the next attempt.
  if (( now - mtime > 90 )); then
    return 0
  fi
  if [[ ! -f "$ROOT/.cf429" ]] || [[ "$(stat -c %Y "$ROOT/.cf429")" -lt "$mtime" ]]; then
    touch "$ROOT/.cf429"
    log "cloudflared quick tunnel returned 429; using localhost.run for 30 minutes"
  fi
}

start_cloudflared() {
  if [[ ! -x "$ROOT/bin/cloudflared" ]]; then
    log "missing $ROOT/bin/cloudflared"
    touch "$ROOT/.cf429"
    return 1
  fi
  log "starting cloudflared quick tunnel"
  : > "$ROOT/logs/cloudflared.log"
  setsid nohup "$ROOT/bin/cloudflared" tunnel --no-autoupdate --url "http://127.0.0.1:4173" \
    >> "$ROOT/logs/cloudflared.log" 2>&1 < /dev/null &
  echo $! > "$ROOT/.tunnel.pid"
}

start_localhost_run() {
  if ! command -v ssh >/dev/null 2>&1; then
    log "ssh is not installed; cannot fall back to localhost.run"
    return 1
  fi
  log "starting localhost.run tunnel"
  : > "$ROOT/logs/localhost-run.log"
  setsid nohup ssh \
    -o StrictHostKeyChecking=accept-new \
    -o UserKnownHostsFile="$ROOT/logs/known_hosts" \
    -o ServerAliveInterval=30 \
    -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    -o ConnectTimeout=25 \
    -R 80:127.0.0.1:4173 \
    nokey@localhost.run >> "$ROOT/logs/localhost-run.log" 2>&1 < /dev/null &
  echo $! > "$ROOT/.tunnel.pid"
}

start_tunnel() {
  local c s
  note_cf_failure
  c="$(cf_pids)"
  s="$(ssh_pids)"
  if [[ -n "$c" || -n "$s" ]]; then
    return 0
  fi
  if cf_cooled_down; then
    start_cloudflared
    return 0
  fi
  start_localhost_run
}

capture_url() {
  local url prev src
  url=""
  src=""
  if [[ -n "$(cf_pids)" ]]; then
    url="$(grep -oE 'https://[A-Za-z0-9-]+\.trycloudflare\.com' "$ROOT/logs/cloudflared.log" 2>/dev/null | tail -n 1 || true)"
    src="cloudflared"
  elif [[ -n "$(ssh_pids)" ]]; then
    url="$(grep -oE 'https://[A-Za-z0-9]+\.lhr\.life' "$ROOT/logs/localhost-run.log" 2>/dev/null | tail -n 1 || true)"
    src="localhost.run"
  fi
  if [[ -z "$url" ]]; then
    return 0
  fi
  prev=""
  if [[ -f "$ROOT/public-url.txt" ]]; then
    prev="$(tr -d '[:space:]' < "$ROOT/public-url.txt" 2>/dev/null || true)"
  fi
  if [[ "$url" != "$prev" ]]; then
    printf '%s\n' "$url" > "$ROOT/public-url.txt"
    log "public url ($src): $url"
  fi
}

log "keepalive started pid $$"
while true; do
  start_server || true
  start_tunnel || true
  capture_url
  sleep 15
done
