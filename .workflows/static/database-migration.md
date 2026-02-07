# Database Migration

## Steps
1. Update model in `database/models.py`
2. Create migration SQL file in `migrations/` with descriptive name
3. Test migration locally against a dev database
4. Run migration via `migrations/run_migration.py` or direct SQL
5. Verify schema changes with a quick query
6. Update `docs/CLAUDE.md` if new models were added

## Rollback
- Keep a corresponding rollback SQL file for each migration
- Test rollback before deploying to production

## Troubleshooting
- Connection refused → check `DATABASE_URL` env var
- Permission denied → ensure DB user has ALTER/CREATE privileges
- Migration already applied → check migration tracking table

---
**Changelog**
- 2026-02-07: Initial version
