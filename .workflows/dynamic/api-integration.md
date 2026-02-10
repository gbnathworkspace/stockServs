# API Integration Workflow
**Version:** 1.0
**Last refined:** 2026-02-07
**Times used:** 0

---

## Base Prompt

When integrating a new API or modifying an existing integration:

### 1. Understand the API
- Read the API docs thoroughly
- Identify authentication method (API key, OAuth, JWT)
- Note rate limits, quotas, and error codes
- Test endpoints manually (Postman/curl) before writing code

### 2. Design the Integration
- Create `plan.md` with endpoint mapping
- Define request/response schemas (Pydantic models)
- Plan error handling strategy (retries, fallbacks, timeouts)
- Decide on caching strategy if applicable

### 3. Implement
- Create service file in `services/`
- Create route file in `routes/`
- Add Pydantic schemas in `schemas/`
- Register router in `main.py`
- Add caching via `services/cache.py` if needed

### 4. Handle Edge Cases
- API down / timeout → graceful fallback
- Rate limited → exponential backoff
- Invalid response → validate and log
- Auth expired → refresh or re-authenticate

### 5. Verify
- All endpoints return expected data
- Error cases handled gracefully
- No sensitive data (API keys) leaked in responses or logs

### 6. Update This Workflow
- Add to learnings log
- Note any API-specific quirks discovered

---

## Anti-Patterns (Do NOT Do These)
- **Hardcoding API keys:** Always use env vars or config manager.
- **No timeout on HTTP calls:** Always set timeouts to avoid hanging.
- **Ignoring rate limits:** Respect API rate limits to avoid bans.
- **No error handling:** Never assume the API always returns 200.

---

## Learnings Log (Append-Only)
| Date | Task | Insight | Action Taken |
|------|------|---------|--------------|
| | | | |
