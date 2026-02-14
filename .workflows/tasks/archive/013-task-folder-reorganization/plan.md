# 013 — Reorganize .workflows/tasks/ & Update Build Workflow Rules

**Type:** refactor
**Status:** planning

---

## Problem Statement

Two issues with the current workflow:

### Issue 1: Task Folder Clutter

The `.workflows/tasks/` folder has 18 task folders with:
1. **Duplicate IDs**: Three `001-*`, two `002-*`, two `006-*`, two `007-*`, two `008-*` folders
2. **No separation** between completed and pending work — everything in one flat folder
3. **Stale statuses** — many tasks marked "in-progress" were completed long ago
4. **Missing plan.md** — 4 folders have no plan.md at all

### Issue 2: Build/Deploy Workflow Not Documented

Current CLAUDE.md Git Rules only say "commit to `jackrnd`" and "confirm before pushing". But the actual workflow should be:

- Work on `jackrnd` branch only
- Complete multiple tasks, accumulating commits on `jackrnd`
- **Never** merge to main or trigger a build after each individual task
- Only merge/build when the user explicitly says **"build"**
- After completing a batch of tasks, ask: "All tasks done — ready to build?" and wait for user confirmation

This prevents unnecessary deployments and lets the user batch changes together.

---

## Current Task State

| Folder | Status | Notes |
|--------|--------|-------|
| 001-fix-option-chain-backend | in-progress | Done |
| 001-option-chain-fix | in-progress | Done (duplicate) |
| 001-validate-order-flow | planning | Abandoned |
| 002-fix-option-chain-frontend | in-progress | Done |
| 002-nifty-strike-search-fix | in-progress | Done |
| 003-prices-not-showing-fix | in-progress | Done |
| 004-watchlist-module-fix | in-progress | Done |
| 005-watchlist-ui-perf | unknown | No plan.md |
| 006-fno-trading-flow-fix | done | Confirmed |
| 006-watchlist-perf-opt | unknown | No plan.md |
| 007-fii-dii-pagination | in-progress | Done |
| 007-fix-frontend-dedup | unknown | No plan.md |
| 008-fix-slow-dashboard-endpoints | done | Confirmed |
| 008-trade-modal-fix | unknown | No plan.md |
| 009-option-chain-empty-data | in-progress | Done |
| 010-option-chain-full-fix | in-progress | Done |
| 011-portfolio-orders-sync | in-progress | Done |
| 012-market-sandbox-connect-redesign | done | Completed & deployed |

---

## Proposed Changes

### Part A: Task Folder Reorganization

```
.workflows/tasks/
├── archive/                    ← Completed/abandoned tasks (historical reference)
│   ├── 001-fix-option-chain-backend/
│   ├── 001-option-chain-fix/
│   ├── ...all 18 existing folders...
│   └── 012-market-sandbox-connect-redesign/
└── <id>-<short-name>/         ← Active/new tasks only (013+)
    ├── plan.md
    ├── conversation.md
    └── outcome.md
```

**Rules:**
- All 18 existing tasks → `archive/` (all completed or abandoned)
- New tasks created at top level of `.workflows/tasks/`
- Task IDs continue from 013+
- When a task is completed → move folder to `archive/`

### Part B: Build/Deploy Workflow in CLAUDE.md

Update the **Git Rules** section in root `CLAUDE.md` to:

```markdown
## Git Rules

- **Only commit to the `jackrnd` branch.** Never switch to, commit to, or push to `main` or any other branch.
- Always confirm with the user before pushing to remote.
- **Never merge to main or trigger a build/deploy after individual tasks.** Accumulate work on `jackrnd`.
- After completing all requested tasks, ask: "All tasks are done — ready to build?"
- **Only merge `jackrnd` → `main` and deploy when the user explicitly says "build".**
- The deploy workflow (merge to main → GitHub Actions → Docker → EC2) is triggered ONLY on user's "build" command.
```

---

## Acceptance Criteria

- [ ] `archive/` subfolder created inside `.workflows/tasks/`
- [ ] All 18 existing task folders moved into `archive/`
- [ ] Root `CLAUDE.md` Git Rules updated with build/deploy workflow
- [ ] Root `CLAUDE.md` Workflow section updated with archive folder structure
- [ ] `docs/CLAUDE.md` updated if it references task structure
- [ ] No task data lost during move

---

## Implementation Steps

1. **Create `archive/` directory** in `.workflows/tasks/`

2. **Move all 18 existing task folders** into `archive/` using `git mv`

3. **Update root `CLAUDE.md`**:
   - Expand Git Rules with build/deploy workflow (never auto-build, wait for "build" command)
   - Update Workflow Directory diagram to show `archive/` subfolder
   - Add rule about moving completed tasks to `archive/`

4. **Update `docs/CLAUDE.md`** if task folder structure is mentioned

5. **Move task 013 to archive** after completion

---

## Files to Touch

| File | Reason |
|------|--------|
| `.workflows/tasks/archive/` | Create directory, move 18 folders in |
| `CLAUDE.md` (root) | Update Git Rules + Workflow structure |
| `docs/CLAUDE.md` | Update if task structure is referenced |

---

## Risks & Edge Cases

- **Git history**: Use `git mv` to preserve file history
- **No code changes**: This is purely folder moves and doc edits
- **Clarity**: The build workflow rules prevent accidental deployments mid-work

---

## Rollback Strategy

- All changes are file moves and doc edits — `git checkout` reverts everything
- No backend/frontend code changes
