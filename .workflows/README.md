# Workflow Management System

Every task follows a structured, documented workflow. No coding without a plan.

## Directory Structure

```
.workflows/
├── README.md                          ← This file
├── static/                            ← Rarely change (procedural checklists)
│   ├── host-local.md
│   ├── deploy-staging.md
│   └── database-migration.md
├── dynamic/                           ← Evolve after each use (living prompts)
│   ├── ui-bugfix.md
│   ├── feature-implementation.md
│   ├── performance-analysis.md
│   └── api-integration.md
└── tasks/                             ← One folder per task
    └── <id>-<short-name>/
        ├── plan.md
        ├── conversation.md
        └── outcome.md
```

## Quick Start

1. Identify the task type (bugfix / feature / performance / other)
2. Read the matching dynamic workflow from `.workflows/dynamic/`
3. Create a task folder: `.workflows/tasks/<id>-<name>/`
4. Write `plan.md` following the workflow's instructions
5. Execute the plan
6. After completion, update the dynamic workflow with learnings
