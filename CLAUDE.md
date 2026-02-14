# CLAUDE.md - Master Rules

See [docs/CLAUDE.md](docs/CLAUDE.md) for full project documentation.

## Git Rules

- **Only commit to the `jackrnd` branch.** Never switch to, commit to, or push to `main` or any other branch.
- Always confirm with the user before pushing to remote.
- **Never merge to main or trigger a build/deploy after individual tasks.** Accumulate work on `jackrnd`.
- After completing all requested tasks, ask: "All tasks are done — ready to build?"
- **Only merge `jackrnd` → `main` and deploy when the user explicitly says "build".**
- The deploy workflow (merge to main → GitHub Actions → Docker → EC2) is triggered ONLY on user's "build" command.

## Temporary File Rules

**Auto-cleanup requirement**: Any temporary files or directories created during testing, debugging, or execution MUST be deleted immediately after use. This includes:

- Files matching `tmpclaude-*` patterns
- Any scratch files created for one-off tests (e.g., `run_direct_test.py`, `test_*.py` scratch scripts)
- Temporary data files, logs, or outputs generated during debugging

**Rules:**
1. Never leave temporary files in the working directory after task completion
2. If a temp file is created for testing or debugging, delete it as the final step of that task
3. Use the scratchpad directory (`$TEMP/claude/...`) for intermediate work instead of the project root
4. Before finishing any task, check for and clean up any `tmpclaude-*` files or other temp artifacts created during the session
5. Do not commit temporary files to git

## Workflow Management System

**Every task MUST follow a structured workflow.** Never start coding without a plan. Never finish a task without updating the workflow.

### Workflow Directory: `.workflows/`

```
.workflows/
├── static/           ← Stable procedural checklists (host-local, deploy, migrations)
├── dynamic/          ← Living prompts that evolve after each use
│   ├── ui-bugfix.md
│   ├── feature-implementation.md
│   ├── performance-analysis.md
│   └── api-integration.md
└── tasks/            ← Active tasks at top level
    ├── archive/      ← Completed/abandoned tasks (historical reference)
    │   └── <id>-<short-name>/
    └── <id>-<short-name>/
        ├── plan.md          ← MANDATORY before any code changes
        ├── conversation.md  ← Key decisions & reasoning
        └── outcome.md       ← What happened vs. the plan
```

### Before Any Task

1. Identify the task type (bugfix / feature / performance / refactor / api-integration)
2. Read the matching dynamic workflow from `.workflows/dynamic/`
3. Create a task folder: `.workflows/tasks/<id>-<short-name>/`
4. Write `plan.md` following the workflow's instructions — **never skip this**

### `plan.md` Template

Every task folder must have a `plan.md` with:
- **Type** (bugfix | feature | performance | refactor | other)
- **Status** (planning | in-progress | review | done)
- **Problem Statement** — what exactly is broken, missing, or needed
- **Root Cause Analysis** (for bugfixes)
- **Acceptance Criteria** — checkboxes
- **Implementation Steps** — numbered
- **Files to Touch** — with reasons
- **Risks & Edge Cases**
- **Rollback Strategy**

### After Every Task — Refinement Loop

1. Review what went well and what didn't
2. Append to the Learnings Log in the matching dynamic workflow
3. Update the Base Prompt in the dynamic workflow if a better approach was found
4. Add new anti-patterns if mistakes were made
5. Bump the version number of the dynamic workflow
6. Write `outcome.md` in the task folder
7. Move the completed task folder to `.workflows/tasks/archive/`
