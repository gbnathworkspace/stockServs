# 015 — Project skill: run & end-to-end test stockServs locally

**Type:** other (tooling / agent skill)
**Status:** done

## Problem Statement
Running stockServs locally for an end-to-end check needs several non-obvious steps that agents
(and people) get wrong: the committed `.env` points at the hosted Neon Postgres, the Fyers
redirect URI points at the production EC2 host, login expects form fields, Fyers dev apps use an
`https://127.0.0.1` redirect, and live order controls sit next to sandbox ones. A project skill
in `.claude/skills/` captures the verified path so the next run is fast and safe.

## Acceptance Criteria
- [ ] Baseline: fresh agents without the skill planned a local run; failures recorded
- [ ] `.claude/skills/stockservs-local-e2e/SKILL.md` addresses each recorded failure
- [ ] Re-test: fresh agents with the skill produce safe, correct plans
- [ ] No secrets in the skill; production data and real-money orders protected by explicit rules

## Implementation Steps
1. Baseline scenarios (normal run, Fyers connect, time pressure) with read-only planning agents
2. Write SKILL.md (frontmatter "Use when…", commands, safety rules, screen checklist)
3. Re-run the same scenarios with the skill; close gaps
4. Commit on `jackrnd`; push only after user confirms

## Files to Touch
- `.claude/skills/stockservs-local-e2e/SKILL.md` — new skill
- `.workflows/tasks/015-local-e2e-skill/` — plan/outcome

## Risks & Edge Cases
- Skill drifting from code (routes, env var names) — reference file paths so drift is visible
- Leaking credentials — skill references env var names only

## Rollback Strategy
Delete `.claude/skills/stockservs-local-e2e/`; no app code changes.
