# 015 — Outcome

**Result:** done — `.claude/skills/stockservs-local-e2e/SKILL.md` added; `.gitignore` now keeps
`.claude/skills/` while still ignoring other local Claude state (worktrees, settings).

## Baseline (fresh planning agents, no skill)
- Normal run: good (chose SQLite on its own, correct form-encoded login); no warning about the
  "Fyers Live" switch in the trade window; one wrong endpoint (`/auth/me`).
- Fyers connect: wrote the Fyers secret into the git-tracked `.env`; no recovery for Edge's
  certificate warning or Fyers "invalid auth token".
- 10-minute demo pressure: defaulted to the shared Neon DB ("confirm with the owner"), suggested
  a wrong redirect (`localhost:8000/fyers/callback`), Vite :5173, stale UI names.

## With the skill
- Demo-pressure and Fyers scenarios both followed all three hard rules (SQLite, secrets only as
  launch env vars, no real-money orders), used the single :8000 origin, verified `auth-url`
  before the browser step, and checked data values (OI, PCR, bid≤ask, `nse_fallback`).
- Refactor: added `read -rs` for the secret, `curl -sk` for https mode, InPrivate tip, and
  deleting `$S` / unsetting the secret on cleanup.
- Sections 1–2 of the skill were executed verbatim against SQLite: all endpoints behaved as
  documented (health 200, signup, form login, wallet 100000, trade, summary, orders, 401).

## Deviations from plan
- No matching dynamic workflow in `.workflows/dynamic/` for a tooling task, so no Learnings Log
  entry was appended.

## Follow-ups noticed (not fixed here)
- `option_clock_service.get_system_access_token()` shares the newest Fyers token across users.
- Signup ignores `display_name` (`routes/auth.py:70`).
