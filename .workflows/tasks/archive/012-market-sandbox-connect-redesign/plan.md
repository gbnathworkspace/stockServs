# 012 — Merge Market Sandbox & Market Connect into One Unified Section

**Type:** refactor
**Status:** planning

---

## Problem Statement

The app has two nearly identical sidebar entries:

| Feature | Market Sandbox | Market Connect |
|---------|---------------|----------------|
| Component | `VirtualTrading.jsx` (mode="virtual") | `RealTrading.jsx` wrapping `VirtualTrading.jsx` (mode="real") |
| Tabs | Trade, Portfolio, Orders, Option Chain, **Wallet** | Trade, Portfolio, Orders, Option Chain |
| Data Source | Fyers API for prices, local DB for trades | Fyers API for prices AND execution |
| Execution | Virtual (paper trading) | Real (Fyers live orders) |
| Badge | "SANDBOX" (green) | "LIVE" (orange pulse) |

**The problem:** `RealTrading.jsx` is just a thin wrapper that checks Fyers connection and passes `mode="real"` to the exact same `VirtualTrading` component. Users see two sidebar items that look 95% identical, creating confusion about which to use.

---

## Proposed Design: Unified Trading Hub

### Single Sidebar Entry: "Trading"

Replace both "Market Sandbox" and "Market Connect" with **one** section called **"Trading"** that has a clear mode toggle inside.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Trading                                                │
│  ┌──────────────────────────────┐                       │
│  │  [🟢 Sandbox]  [🔴 Live]    │  ← Mode toggle bar   │
│  └──────────────────────────────┘                       │
│                                                         │
│  [Trade] [Portfolio] [Orders] [F&O] [Wallet*]           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │        Active tab content here                  │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  * Wallet tab only visible in Sandbox mode              │
└─────────────────────────────────────────────────────────┘
```

### Mode Toggle Behavior

**Sandbox Mode (Default):**
- Green "Sandbox" badge
- Wallet tab visible
- Trades execute against virtual portfolio
- No broker connection required
- Footer shows "Demo Mode"

**Live Mode:**
- If Fyers NOT connected → Show inline connect prompt (not a full-page takeover)
- If Fyers connected → Orange "Live" badge, trades execute via Fyers
- Wallet tab hidden
- Connected broker banner at top (with disconnect option)
- Footer shows "Live Trading"

### Inline Connect Prompt (when switching to Live without Fyers)

```
┌─────────────────────────────────────────────────────────┐
│  [Sandbox]  [🔴 Live ←selected]                        │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  🔗 Connect Your Broker                         │    │
│  │                                                 │    │
│  │  Connect Fyers to enable live trading.          │    │
│  │  [Connect Fyers]  [Back to Sandbox]             │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Tabs still visible but disabled until connected        │
└─────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

- [ ] Single "Trading" sidebar entry replaces both "Market Sandbox" and "Market Connect"
- [ ] Mode toggle (Sandbox / Live) at the top of the trading section
- [ ] Sandbox mode works exactly as before (paper trading)
- [ ] Live mode checks Fyers connection; shows inline connect prompt if not connected
- [ ] Live mode works exactly as before when Fyers is connected
- [ ] Wallet tab only visible in Sandbox mode
- [ ] Mode badge updates (green Sandbox / orange Live)
- [ ] Sidebar footer badge reflects current mode
- [ ] User's last selected mode is remembered (localStorage)
- [ ] Smooth transition between modes (no full page reload)
- [ ] Remove old "Market Connect" sidebar entry
- [ ] Remove `RealTrading.jsx` (its logic moves into unified component)

---

## Implementation Steps

1. **Update Sidebar.jsx**
   - Remove "Market Connect" (`real-trading`) entry
   - Rename "Market Sandbox" to "Trading"
   - Keep single `trading` section ID

2. **Create TradingModeToggle component**
   - Sandbox / Live toggle bar
   - Stores selected mode in `localStorage('trading_mode')`
   - Emits mode change to parent

3. **Refactor VirtualTrading.jsx**
   - Add mode toggle bar at the top (above tabs)
   - Integrate Fyers connection check inline (from RealTrading.jsx)
   - Show connect prompt overlay when Live is selected but Fyers not connected
   - Keep all existing tab logic intact

4. **Update App.jsx routing**
   - Remove `real-trading` case from `renderContent()`
   - Remove `RealTrading` import
   - Update section titles

5. **Delete RealTrading.jsx**
   - All its logic (connect/disconnect/status check) absorbed into VirtualTrading

6. **Update sidebar footer**
   - Dynamic badge: "SANDBOX" or "LIVE" based on current mode

---

## Files to Touch

| File | Reason |
|------|--------|
| `frontend/src/components/Sidebar.jsx` | Remove Market Connect entry, rename Market Sandbox |
| `frontend/src/components/VirtualTrading.jsx` | Add mode toggle, integrate Fyers connect logic |
| `frontend/src/components/RealTrading.jsx` | **DELETE** — absorbed into VirtualTrading |
| `frontend/src/App.jsx` | Remove real-trading route, clean up imports |

---

## Risks & Edge Cases

- **User on Market Connect page during update:** URL history may still reference `real-trading` — add fallback in App.jsx to redirect to `trading`
- **Fyers connection mid-session:** If user connects Fyers while in Sandbox, Live toggle should become available without page reload
- **Mode persistence:** If user was in Live mode and Fyers disconnects (token expires), should auto-fall back to Sandbox with a notification

---

## Rollback Strategy

- Changes are frontend-only, no backend modifications
- If issues arise, revert the commit — old sidebar entries and RealTrading.jsx are restored
- No database schema changes involved
