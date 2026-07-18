#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
SERVICE_DIR="$HOME/.config/systemd/user"
PORT="${1:-${PORT:-3456}}"
SERVICE_NAME="clawui-${PORT}.service"
LOG_FILE="${LOG_FILE:-/tmp/clawui_back.log}"
CLAWUI_DATA_DIR="${CLAWUI_DATA_DIR:-.clawui_release}"

export PATH="$HOME/.npm-global/bin:$HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
# Build needs devDependencies even if NODE_ENV is production.
export NPM_CONFIG_PRODUCTION=false
export npm_config_production=false
export NPM_CONFIG_INCLUDE=dev
export npm_config_include=dev

info() { echo "[restart] $*"; }
warn() { echo "[restart][warn] $*"; }
fail() { echo "[restart][error] $*" >&2; exit 1; }

ensure_node_project_deps() {
  local dir="$1"
  local label="$2"
  if [ ! -d "$dir/node_modules" ]; then
    info "Installing $label dependencies..."
    (cd "$dir" && npm install --include=dev)
  fi
}

wait_for_port() {
  local port="$1"
  local attempts="${2:-15}"
  local i
  for ((i=1; i<=attempts; i++)); do
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
      return 0
    fi
    sleep 1
  done
  return 1
}

show_port_process() {
  ss -tlnp 2>/dev/null | grep ":${PORT} " || true
}

restart_with_systemd() {
  info "Restarting systemd user service: $SERVICE_NAME"
  systemctl --user daemon-reload
  systemctl --user restart "$SERVICE_NAME"
}

stop_existing_backend() {
  local port="$1"
  local killed=0

  # Kill by absolute path match
  if pkill -f "$BACKEND_DIR/dist/index.js" 2>/dev/null; then
    info "Killed process by path match"
    killed=1
  fi

  # Kill by relative path match (handles processes started from project dir)
  if pkill -f "node dist/index.js" 2>/dev/null; then
    info "Killed process by relative path match"
    killed=1
  fi

  # Kill by port using fuser
  if command -v fuser >/dev/null 2>&1; then
    local pids
    pids=$(fuser "${port}/tcp" 2>/dev/null | xargs) || true
    if [ -n "$pids" ]; then
      info "Killing processes on port $port: $pids"
      kill $pids 2>/dev/null || true
      killed=1
    fi
  fi

  # Wait for port to be free
  if [ "$killed" -eq 1 ]; then
    info "Waiting for port $port to be free..."
    local i
    for ((i=1; i<=10; i++)); do
      if ! ss -tlnp 2>/dev/null | grep -q ":${port} "; then
        info "Port $port is free"
        return 0
      fi
      sleep 1
    done
    warn "Port $port still in use after 10s, proceeding anyway"
  fi
}

restart_with_nohup() {
  warn "Systemd service $SERVICE_NAME was not found; falling back to nohup startup."
  stop_existing_backend "$PORT"

  info "Starting backend with nohup on port $PORT..."
  cd "$BACKEND_DIR"
  nohup env PORT="$PORT" CLAWUI_DATA_DIR="$CLAWUI_DATA_DIR" /usr/bin/node dist/index.js >"$LOG_FILE" 2>&1 &
}

info "Project root: $PROJECT_ROOT"
info "Port: $PORT"
info "Service: $SERVICE_NAME"

[ -f "$PROJECT_ROOT/package.json" ] || fail "package.json not found in $PROJECT_ROOT"
[ -f "$BACKEND_DIR/package.json" ] || fail "backend/package.json not found"
[ -f "$FRONTEND_DIR/package.json" ] || fail "frontend/package.json not found"

ensure_node_project_deps "$PROJECT_ROOT" "root"
ensure_node_project_deps "$BACKEND_DIR" "backend"
ensure_node_project_deps "$FRONTEND_DIR" "frontend"

info "Building latest code..."
cd "$PROJECT_ROOT"
npm rebuild
npm run build

if [ -f "$SERVICE_DIR/$SERVICE_NAME" ]; then
  restart_with_systemd
else
  restart_with_nohup
fi

info "Waiting for backend port $PORT..."
if wait_for_port "$PORT" 20; then
  info "Backend is listening:"
  show_port_process
else
  warn "Backend port $PORT is not listening after restart."
  if [ -f "$SERVICE_DIR/$SERVICE_NAME" ]; then
    warn "Recent systemd logs:"
    journalctl --user -u "$SERVICE_NAME" -n 80 --no-pager || true
  else
    warn "Recent nohup logs:"
    tail -n 80 "$LOG_FILE" 2>/dev/null || true
  fi
  exit 1
fi

if command -v curl >/dev/null 2>&1; then
  info "Health check:"
  curl -fsS "http://127.0.0.1:${PORT}/health" || warn "Health check failed; service may still be warming up."
  echo
fi

info "Restart complete."
info "Local access:   http://localhost:$PORT"
LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ -n "${LOCAL_IP:-}" ]; then
  info "Network access: http://$LOCAL_IP:$PORT"
fi

if [ -f "$SERVICE_DIR/$SERVICE_NAME" ]; then
  info "Status command: systemctl --user status $SERVICE_NAME"
  info "Logs command:   journalctl --user -u $SERVICE_NAME -f"
else
  info "Logs command:   tail -f $LOG_FILE"
fi
