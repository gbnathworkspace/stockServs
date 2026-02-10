# Task 008: Outcome

## Status: Done

## What Changed

### 1. VirtualTrading.jsx — `onSelectToken` handler (line 726-748)
- **Display name**: Parses the raw Fyers identifier into a user-friendly format like "NIFTY 20450 PE (13 Nov)"
- **Lot sizes**: Added correct lot size map (NIFTY=75, BANKNIFTY=15, FINNIFTY=25, MIDCPNIFTY=50)
- **Price fetch**: Now calls `handleSelectStock()` instead of `setSelectedStock()`, which auto-fetches live price via Fyers quotes API when LTP is 0

### 2. TradeModal.jsx — Full rewrite
- Shows `displayName` (e.g., "NIFTY 20450 PE (13 Nov)") in header, raw identifier as subtitle
- Shows "₹ --" when price is 0 instead of "₹0.00"
- Shows warning banner when market closed: "enter price manually or wait for market hours"
- Price input enabled when market closed (disabled only when market order + price available)
- Total value formatted with Indian locale (en-IN)
- Placeholder text on price input when no price available

### 3. modal.css — Added all missing styles
- `.trade-modal` scoped width (420px)
- `.modal-subtitle` for the raw identifier display
- `.trade-warning` banner
- `.toggle-group` / `.toggle-btn` for broker and order type toggles
- `.form-row` grid layout for qty/price inputs
- `.form-group` label and input styling
- `.trade-summary` / `.summary-row` with proper spacing
- `.trade-actions` / `.trade-btn` / `.buy-btn` / `.sell-btn` with gradients and hover effects
- Glass theme overrides
- Mobile responsive breakpoint

## What Went Well
- Clean separation: display name for UI, raw symbol for API
- Price fetch reuse via existing `handleSelectStock`
- All CSS properly scoped under `.trade-modal` to avoid conflicts
