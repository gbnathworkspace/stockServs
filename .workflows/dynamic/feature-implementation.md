# Feature Implementation Workflow
**Version:** 1.0
**Last refined:** 2026-02-07
**Times used:** 0

---

## Base Prompt

When implementing a new feature, follow this sequence:

### 1. Understand the Full Scope
- What does the user see and interact with?
- What data does it need?
- What existing systems does it touch?
- What are the edge cases?

### 2. Design Before Code
- Create `plan.md` with component tree sketch
- Define the data model / state shape
- Define API contracts if backend is involved
- List acceptance criteria as testable statements

### 3. Build in Layers
- Layer 1: Data model and state management
- Layer 2: Core logic / business rules
- Layer 3: UI components (static first, then interactive)
- Layer 4: Integration, error handling, loading states
- Layer 5: Polish (animations, edge cases, accessibility)

### 4. Checkpoint After Each Layer
- Does the plan still hold?
- Any scope creep? Push it to a follow-up task
- Any technical debt introduced? Document it

### 5. Final Review
- All acceptance criteria met
- No hardcoded values or temporary hacks left in
- Responsive and accessible

### 6. Update This Workflow
- Add to learnings log
- Refine the Base Prompt if a better layering order was found

---

## Anti-Patterns (Do NOT Do These)
- **Building UI before data model is solid:** Always start with the data shape.
- **Gold-plating:** Don't add features that weren't asked for.
- **Skipping Layer 4:** Error and loading states are not optional.

---

## Learnings Log (Append-Only)
| Date | Task | Insight | Action Taken |
|------|------|---------|--------------|
| | | | |
