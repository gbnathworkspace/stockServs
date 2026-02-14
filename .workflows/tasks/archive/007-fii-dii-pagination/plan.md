# Task 007: FII/DII Pagination

- **Type:** feature
- **Status:** in-progress
- **Created:** 2026-02-08

## Problem Statement

FII/DII history table only shows 10 rows (hardcoded `.slice(0, 10)`) and chart shows only 15 days (`.slice(0, 15)`). Backend API supports up to 365 days via `?limit=` param. User wants pagination so all historical data is accessible.

## Acceptance Criteria

- [ ] Backend: Add `offset` parameter to `/fii-dii-history` for true pagination
- [ ] Backend: Return `total` count alongside records for pagination controls
- [ ] Frontend: Replace hardcoded `.slice(0, 10)` table with paginated table (20 rows/page)
- [ ] Frontend: Add Previous/Next page controls with page indicator
- [ ] Frontend: Chart shows data for current page range (dynamic title)
- [ ] Frontend: Summary cards update based on ALL data (not just current page)
- [ ] Styles match existing dark theme / glass theme

## Implementation Steps

1. **Backend** (`nse_data/fii_dii.py`):
   - Add `offset` query param to `/fii-dii-history`
   - Add `total` count to response
   - Keep `limit` param (default 20 per page)

2. **Frontend** (`FiiDiiActivity.jsx`):
   - Add pagination state: `page`, `pageSize=20`, `totalRecords`
   - Fetch paginated data: `/fii-dii-history?limit=20&offset=0`
   - On page change, re-fetch with new offset
   - Table shows all records from current page (no more `.slice(0,10)`)
   - Chart shows records from current page (remove `.slice(0,15)`)
   - Add pagination controls (Prev | Page X of Y | Next)
   - Summary keeps using full history fetch for cumulative totals

3. **CSS** (`styles.css`):
   - Add `.pagination-controls` styles

## Files to Touch

| File | Reason |
|------|--------|
| `nse_data/fii_dii.py` | Add offset param, total count |
| `frontend/src/components/sections/FiiDiiActivity.jsx` | Pagination logic + UI |
| `frontend/src/styles.css` | Pagination control styles |

## Risks & Edge Cases

- If DB has very few records, pagination should gracefully show single page
- Offset beyond total should return empty set (not error)
- Chart must handle variable record counts gracefully

## Rollback Strategy

Revert the 3 files to pre-change state via git.
