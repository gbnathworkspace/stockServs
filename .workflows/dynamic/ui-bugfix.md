# UI Bugfix Workflow
**Version:** 1.0
**Last refined:** 2026-02-07
**Times used:** 0

---

## Base Prompt

When fixing a UI bug, follow this sequence:

### 1. Reproduce & Document
- Get exact reproduction steps (browser, viewport, user actions)
- Screenshot or describe the broken state vs. expected state
- Check if it's CSS, JS logic, or a data issue

### 2. Isolate the Component
- Identify the exact component tree path to the bug
- Check if the bug is in the component itself or inherited from a parent
- Check responsive breakpoints if layout-related

### 3. Write the Plan
- Create `plan.md` with root cause analysis
- Identify the minimal change needed
- List every file that will be touched

### 4. Fix with Minimal Surface Area
- Change as few files as possible
- Prefer CSS fixes over JS workarounds
- Prefer fixing the data over patching the UI
- Test at mobile, tablet, and desktop widths

### 5. Verify
- Original bug is resolved
- No visual regressions in adjacent components
- Works across target browsers

### 6. Update This Workflow
- Add to learnings log
- If the fix revealed a better approach, edit the Base Prompt above

---

## Anti-Patterns (Do NOT Do These)
- **Fixing symptoms not causes:** Don't add `!important` or magic numbers to hide a layout bug caused by wrong flex/grid logic.
- **Skipping reproduction:** Never assume you know the bug from description alone.

---

## Learnings Log (Append-Only)
| Date | Task | Insight | Action Taken |
|------|------|---------|--------------|
| | | | |
