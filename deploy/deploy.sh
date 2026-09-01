#!/usr/bin/env bash
# Deploys/updates xorome on this machine. Run ON the VPS itself (e.g. over
# SSH) — this has no knowledge of remote SSH credentials, it only acts on
# whatever machine it's actually running on.
#
# First run: creates the xorome system user, clones the repo to
# /opt/xorome, installs dependencies, installs the systemd units, and
# starts the timer. Later runs: pulls the latest main, reinstalls
# dependencies, restarts the timer so unit-file changes take effect.
#
# Requires: git, node/npm already on PATH (see deploy/README.md — a
# system-wide Node install is strongly recommended over nvm for a
# single-purpose VPS), and a populated /opt/xorome/.env (this script does
# NOT create one — copy .env.example there and fill it in before the timer
# can run a real session).
set -euo pipefail

REPO_DIR="/opt/xorome"
REPO_URL="https://github.com/pyco404/xorome.git"
BRANCH="main"
SERVICE_USER="xorome"

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (or with sudo) — this installs systemd units and manages the $SERVICE_USER user." >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git not found on PATH — install it first." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found on PATH — install Node.js first (see deploy/README.md)." >&2
  exit 1
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  echo "creating system user $SERVICE_USER..."
  # --no-create-home: a distro's /etc/skel dotfiles would make $REPO_DIR
  # non-empty, and `git clone` refuses to clone into a non-empty
  # directory. The service doesn't need a traditional home dir anyway —
  # WorkingDirectory is set explicitly in the systemd unit.
  useradd --system --home-dir "$REPO_DIR" --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "cloning $REPO_URL into $REPO_DIR..."
  mkdir -p "$REPO_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
  chown -R "$SERVICE_USER:$SERVICE_USER" "$REPO_DIR"
fi

cd "$REPO_DIR"
sudo -u "$SERVICE_USER" git fetch origin
sudo -u "$SERVICE_USER" git checkout "$BRANCH"
sudo -u "$SERVICE_USER" git reset --hard "origin/$BRANCH"

if [ ! -f "$REPO_DIR/.env" ]; then
  echo
  echo "WARNING: no .env at $REPO_DIR/.env yet." >&2
  echo "copy .env.example there and fill it in — the timer will fail every run until you do." >&2
  echo
fi

echo "installing dependencies..."
sudo -u "$SERVICE_USER" npm ci

echo "installing systemd units..."
install -m 644 "$REPO_DIR/deploy/systemd/xorome-session.service" /etc/systemd/system/xorome-session.service
install -m 644 "$REPO_DIR/deploy/systemd/xorome-session.timer" /etc/systemd/system/xorome-session.timer

systemctl daemon-reload
systemctl enable --now xorome-session.timer

echo
echo "deployed $(git rev-parse --short HEAD)."
echo
systemctl status xorome-session.timer --no-pager || true
echo
echo "next scheduled run:"
systemctl list-timers xorome-session.timer --no-pager || true
