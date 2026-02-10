# Performance Analysis Workflow
**Version:** 1.0
**Last refined:** 2026-02-07
**Times used:** 0

---

## Base Prompt

When analyzing and fixing performance issues:

### 1. Measure First
- Establish baseline metrics (load time, FCP, LCP, bundle size, memory)
- Identify the specific user-facing symptom (slow load, janky scroll, etc.)
- Profile — don't guess. Use browser devtools, Lighthouse, or equivalent.

### 2. Identify the Bottleneck
- Is it network (large payloads, too many requests)?
- Is it rendering (unnecessary re-renders, layout thrashing)?
- Is it computation (expensive operations on the main thread)?
- Is it memory (leaks, oversized state)?

### 3. Plan the Fix
- Create `plan.md` targeting the specific bottleneck
- Define measurable improvement targets
- Prefer systemic fixes over band-aids

### 4. Fix One Thing at a Time
- Make one change, measure again
- If it helped, keep it. If not, revert.
- Document before/after numbers for each change

### 5. Verify No Regressions
- Feature still works correctly
- No new performance issues introduced elsewhere
- Metrics meet the targets set in the plan

### 6. Update This Workflow
- Log the bottleneck type and what worked
- If a new profiling technique helped, add it to Step 1

---

## Anti-Patterns (Do NOT Do These)
- **Optimizing without profiling:** Gut-feel optimization wastes time and often makes things worse.
- **Premature optimization:** Fix the actual bottleneck, not what "looks" slow.
- **Mega-PRs:** One change at a time so you know what actually helped.

---

## Learnings Log (Append-Only)
| Date | Task | Insight | Action Taken |
|------|------|---------|--------------|
| | | | |
