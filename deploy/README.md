# Deploying xorome to a VPS

Replaces the laptop-bound cron scripts (`.supply-test/`, `.session-batch/`)
with a systemd timer on an always-on server — the session loop stops
depending on this laptop being awake, and survives reboots.

**Honesty check on what's verified here**: the systemd unit files are
syntax-validated (`systemd-analyze verify`, `systemd-analyze calendar`) and
the deploy script's shell syntax is checked (`bash -n`), but none of this
has been run end-to-end against a real VPS — there wasn't one available to
target. Read through `deploy.sh` before running it as root on a real
machine, same as you should with any script that creates a system user and
installs systemd units.

## Prerequisites on the VPS

- A fresh Debian/Ubuntu-family VPS (the script uses `useradd`,
  `apt`-style assumptions aren't hardcoded, but it's only been reasoned
  through against that family).
- **Node.js installed system-wide** — via your distro's package manager or
  the [NodeSource](https://github.com/nodesource/distributions) apt repo,
  so `node`/`npm` land at a stable path like `/usr/bin/npm`. This matters
  more than it sounds: the systemd service runs with a minimal `PATH`
  (`/usr/local/bin:/usr/bin:/bin`) that won't include an nvm install
  (typically under `~/.nvm/...`, a specific user's home directory). If you
  use nvm anyway, edit the `Environment=PATH=...` line in
  `systemd/xorome-session.service` to include it, or set `Environment=` to
  the nvm node version's `bin` directory directly.
- git.
- Root/sudo access, to create the `xorome` system user and install the
  systemd units.

## Deploy

```bash
sudo ./deploy/deploy.sh
```

First run: creates the `xorome` system user, clones the repo to
`/opt/xorome`, runs `npm ci`, installs the two systemd units, enables and
starts the timer.

Re-running `sudo ./deploy/deploy.sh` later pulls the latest `main`,
reinstalls dependencies, and re-registers the systemd units (picking up
any changes to them) — safe to run repeatedly.

## Getting .env onto the server

`.env` is gitignored on purpose — `git clone`/`git pull` will **never**
bring it onto the server, deploy.sh doesn't create one, and that's
deliberate: it's the one file holding real secrets, most importantly
**`SUPABASE_SERVICE_ROLE_KEY`** (full read/write on every table, bypasses
every RLS policy) and **`ANTHROPIC_API_KEY`** (bills directly to your
account). Both belong in this file and nowhere else — not committed,
not in the systemd unit files, not pasted into a shell history you'll
forget about.

Copy it over explicitly, from your local machine, after deploy.sh's first
run has created `/opt/xorome`:

```bash
scp .env root@your-vps-host:/opt/xorome/.env
```

Then on the VPS, lock it down to the service user only:

```bash
sudo chown xorome:xorome /opt/xorome/.env
sudo chmod 600 /opt/xorome/.env
```

`chmod 600` means only the `xorome` user (and root) can even read the
file — not "world-readable, but nobody's looking." Confirm both landed:

```bash
sudo -u xorome test -r /opt/xorome/.env && echo "readable by xorome: ok"
stat -c "%a %U:%G" /opt/xorome/.env   # expect: 600 xorome:xorome
```

If you don't already have a `.env` to copy, build one from the template
instead and fill in real values before the `scp` step —
`cp .env.example .env` locally, edit it, then copy it over the same way.

## What it installs

- `/etc/systemd/system/xorome-session.service` — a oneshot unit that runs
  `npm run session` (the full read → generate → post → make loop) with
  `/opt/xorome/.env` injected via `EnvironmentFile`.
- `/etc/systemd/system/xorome-session.timer` — fires the service every 3
  hours on the hour, **UTC** explicitly (`OnCalendar=*-*-* 0/3:00:00 UTC`)
  — matching `SESSION_INTERVAL_HOURS` and independent of whatever
  timezone the VPS ends up configured with. `Persistent=true` means a
  run missed while the machine was off fires once as soon as the timer is
  active again, instead of silently skipping it.
- `/etc/systemd/system/xorome-funding.service` + `.timer` — a separate,
  lighter pair that runs `npm run check-funding` every 30 minutes,
  independent of the session loop (money-tracking shouldn't depend on
  whether a posting session succeeds). Watches the Solana treasury
  address for new incoming transfers and logs each as a real ledger
  entry — real signature, real amount, real block time. Idempotent by
  transaction signature, so re-running never double-counts.

Unlike `.session-batch/run.sh` (the cron script from the 8-run baseline
test), this timer is **not** self-limiting — it runs indefinitely, which
is the point of it being the production scheduler rather than a bounded
test harness.

## Verifying it after deploying

```bash
# Timer registered and enabled?
systemctl status xorome-session.timer

# When's the next run, and did the last one succeed?
systemctl list-timers xorome-session.timer

# Watch a run's output live, or review a past one:
journalctl -u xorome-session.service -f
journalctl -u xorome-session.service --since "3 hours ago"

# Trigger one immediately without waiting for the timer, to confirm the
# whole thing actually works end-to-end on this machine:
sudo systemctl start xorome-session.service
```

That last command is the real test — run it once right after deploying
and confirm a session actually completes (check the journal, then check
`npm run batch:report` or the `sessions`/`posts` tables) before trusting
the timer to run unattended.

## Stopping it

```bash
sudo systemctl disable --now xorome-session.timer
```
