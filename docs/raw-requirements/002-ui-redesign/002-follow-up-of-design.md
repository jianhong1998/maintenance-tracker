# UI Redesign — Design Follow-ups

**Source:** Gap analysis between `docs/superpowers/specs/2026-04-14-ui-redesign-design.md` and `docs/superpowers/plans/2026-04-14-ui-redesign.md` (2026-04-14).

**Purpose:** These items are **not blockers** for the current implementation plan (see `001-issues-to-fix.md` for blockers). They are requirements the spec did not cover, or concerns that should be addressed in a follow-up design/implementation pass after the first redesign ships.

A downstream agent should treat this file as an inbox for the next iteration — each item needs either a design decision, a follow-up task, or an explicit "won't fix" with reason.

---

## 1. Accessibility

### 1.1 Dropdown menu semantics (maintenance card `⋮` button)
- **Current plan:** The `⋮` button has `aria-label="actions"` but no `aria-expanded`, no `aria-haspopup="menu"`. Dropdown items are `<button>` elements, not `role="menuitem"`. No keyboard navigation (arrow keys, Enter to select, Esc to close).
- **Why it matters:** Screen readers announce it as a generic button; the dropdown is invisible to assistive tech until focus lands inside. Keyboard users can open it with Enter but cannot dismiss it with Esc (only click-outside works).
- **Follow-up:** Add `aria-expanded={isDropdownOpen}`, `aria-haspopup="menu"`, `aria-controls="<id>"` on the trigger. Wrap the dropdown in `role="menu"` with `role="menuitem"` children. Add a keydown handler for Escape and arrow-key navigation. Consider adopting Radix `DropdownMenu` to get all of this for free.

### 1.2 Dialog focus trap
- **Current plan:** Task 10 adds Esc to close but does not trap Tab focus inside the dialog. Tab can escape to the page behind the backdrop.
- **Follow-up:** Either adopt Radix `Dialog` primitives or implement a small focus-trap hook. Also set `aria-describedby` on dialogs that have descriptive body text.

### 1.3 `aria-current="page"` on active nav items
- **Current plan:** Active nav items are styled with cyan tint but carry no `aria-current` attribute.
- **Follow-up:** Add `aria-current={active ? 'page' : undefined}` to every nav link in `AppShellPresentation` and `VehiclesLayout`.

### 1.4 Focus-visible rings on nav links and icon-only buttons
- **Current plan:** `--ring: rgba(0,229,255,0.25)` is defined but `focus-visible:ring` is only wired on Button. Nav links, the `⋮` button, and bare `<Link>` elements have no visible focus state — keyboard users cannot see where they are.
- **Follow-up:** Add `focus-visible:ring-2 focus-visible:ring-[#00e5ff40] focus-visible:outline-none` to all interactive elements that don't go through the `Button` component.

---

## 2. Mobile / Responsive Concerns

### 2.1 iOS safe-area insets
- **Current plan:** The 48px bottom tab bar on mobile (`fixed bottom-0 inset-x-0 h-12`) ignores the iOS home indicator / notch. On iPhone models with a home indicator, the last row of content sits under the bar, and the tab bar icons sit too close to the system gesture area.
- **Follow-up:**
  - Add `pb-[env(safe-area-inset-bottom)]` to the bottom tab bar.
  - Add `pb-[calc(3rem+env(safe-area-inset-bottom))]` to the page content wrapper.
  - Optionally add `pt-[env(safe-area-inset-top)]` on top headers if the app ever goes into PWA/standalone mode.
  - Requires `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` in the root layout — verify it is present.

### 2.2 Pointer-only hover states
- **Current plan:** `hover:bg-[#111d2b]` on vehicle cards and (after the blocker fix) maintenance card rows will render as sticky-after-tap on mobile Safari / touch devices.
- **Follow-up:** Wrap hover rules in `@media (hover: hover)` or use Tailwind's `hover:` modifier with a `@media` layer override. Example: add a utility `hover-pointer:bg-[#111d2b]` backed by `@media (hover: hover) and (pointer: fine)`.

### 2.3 Progress bar width on very small screens
- **Current plan:** Progress bar is `h-[3px] w-full`. On ultra-narrow screens (<320px), the km-remaining label and the `⋮` button may overflow.
- **Follow-up:** Add a smoke test at 320px width, or apply `min-w-0` to the label wrapper and `truncate` where applicable.

### 2.4 Dialog bottom-sheet behavior
- **Current plan:** Task 10 introduces `items-end sm:items-center` positioning (bottom sheet on mobile, centered on desktop) — **this is not in the spec**. It is a reasonable UX choice but should be confirmed by the designer. Also, bottom sheets typically need:
  - A drag handle or visible "grabber" at the top.
  - Swipe-to-dismiss gesture.
  - Rounded corners only on the top (`rounded-t-2xl rounded-b-none` on mobile).
- **Follow-up:** Decide with the designer whether the bottom sheet is intentional. If yes, add the above polish in a second pass.

---

## 3. Authentication & Routing

### 3.1 History tab has no route
- **Current plan:** `NAV_ITEMS` declares `href: '/history'` but no page exists. Clicking will 404.
- **Spec says:** "History tab and Profile tab in nav are visual placeholders only — no routing needed yet."
- **Follow-up:** Decide:
  - Option A — disable the links (pointer-events-none, opacity-50, `aria-disabled`).
  - Option B — create empty placeholder pages that render "Coming soon".
  - Option C — design the History and Profile features for a follow-up sprint.
- Recommendation: Option B for the first ship (avoids 404s, sets the shell up for real content), then plan the feature in a separate spec.

### 3.2 Profile tab `href="#"`
- **Current plan (before blocker fix):** Profile tab in the mobile bottom bar uses `href="#"`, which scrolls to top and puts `#` in the URL.
- **Follow-up:** After unifying NAV_ITEMS (blocker fix B6), decide on the same Option A/B/C as above.

### 3.3 AppShell loading flicker
- **Current plan:** `showNav = !loading && !!user && pathname !== '/login'`. During `loading=true` (e.g. on refresh), authenticated users briefly see pages rendered without any nav, then the nav appears. Visual flash.
- **Follow-up:** Render a skeleton shell during loading (empty nav rails at correct width) so the page layout does not shift. Or use `suppressHydrationWarning` + server-side auth resolution once NextAuth (or equivalent) is wired.

### 3.4 `pathname.startsWith(href)` matcher
- **Current plan:** `active = pathname === href || (href !== '/' && pathname.startsWith(href))`. This means `/history-of-anything` would mark History active.
- **Follow-up:** Use segment-boundary match: `pathname === href || pathname.startsWith(`${href}/`)`. Minor, no impact today because there are no `/history/xxx` routes, but fix before adding nested History pages.

---

## 4. Design System Extensions

### 4.1 Reusable Progress Bar component
- **Current plan:** Task 9 inlines the entire progress bar (track + fill + fill calculation logic) inside `maintenance-card-row.tsx`.
- **Why follow up:** If progress bars appear elsewhere (e.g. vehicle-level health summary, fleet overview), the formula `getProgressFill` will be duplicated.
- **Follow-up:** After Task 9 lands, extract to `components/ui/progress-bar.tsx` with props `{ status, value, max }`. Move `getProgressFill` into the same module. Maintenance card row becomes a consumer.

### 4.2 Status chip component
- **Current plan:** The "ALL GOOD" / "N OVERDUE" chip is inlined in `VehicleCard`. After blocker fix I1, a second copy will land in `VehicleListItem`.
- **Follow-up:** Extract to `components/vehicles/vehicle-status-chip.tsx` once, consume from both. Already flagged as a blocker (I1) but worth calling out here because the same pattern likely applies to the mileage prompt's "UPDATE ODOMETER" eyebrow, the fleet overview eyebrow, and any future badges.

### 4.3 Eyebrow label component
- **Current plan:** `"FLEET OVERVIEW"`, `"UPDATE ODOMETER"`, `"← FLEET"`, `"MAINTENANCE"`, `"YOUR VEHICLES"`, `"MTRACK"` are all inlined with the same `text-[0.6rem] font-mono tracking-[0.15em|0.2em|0.3em]` pattern across 6+ components.
- **Follow-up:** After typography utility classes land (blocker C4), no component should inline these. Audit and replace.

### 4.4 Healthy label `#00E5FF / #555` ambiguity
- **Spec says:** Healthy label color is `#00E5FF` **or** `#555` — implying a muted variant for cards that are "far from due".
- **Current plan:** Always uses cyan.
- **Follow-up:** Decide the threshold for switching to muted (`#555`). Likely: if `remaining > 2 × thresholdNative`, use muted; within the ramp toward warning, use cyan. Get sign-off from the designer before implementing.

### 4.5 Animations and transitions
- **Spec out-of-scope:** "No animation/transition system (can be added in a follow-up)."
- **Follow-up:** Design the transition system in a separate spec. Minimum scope:
  - Page transitions (fade or slide on navigation).
  - Dialog enter/exit.
  - Dropdown open/close.
  - Progress bar animate to new value when mileage updates.
  - Card status color-change animation when a maintenance item becomes overdue.

---

## 5. Data Presentation Decisions

### 5.1 `getProgressFill` formula choice
- **Current plan:** Task 9 introduces a formula for healthy-zone fill (`Math.max(3, (1 - Math.min(remaining, lookahead) / lookahead) * 59)` with `lookahead = threshold * 10`). This was not in the spec — the spec only specifies the three status colors and that overdue fills 100%.
- **Follow-up:** Validate the formula with the designer:
  - Does "3% minimum fill for any healthy card" feel right, or should it be 0%?
  - Is `threshold × 10` the correct lookahead? (I.e. if warning threshold is 500km, the bar starts filling visibly at 5,000km remaining. Does that match intuition?)
  - Should the warning zone map linearly from 60% to 99%, or use an ease-in curve?
- Document the final formula in the spec so future redesigns inherit it.

### 5.2 Card subtitle text
- **Current plan:** Renders "Within warning threshold" / "On track" below the progress bar for non-overdue cards, and "N km past due" for overdue cards.
- **Spec says:** "Sub-label: km remaining or status text below bar" — ambiguous.
- **Follow-up:** Designer should specify exact copy and when to switch between km-remaining and status-text. Currently two different labels render simultaneously (one above the bar, one below), which is redundant.

### 5.3 Alert pill pluralization
- **Current plan:** `{count === 1 ? 'ITEM' : 'ITEMS'} NEED ATTENTION` — mixed singular/plural (`NEED` should be `NEEDS` for singular). Plan text doesn't handle the verb form.
- **Follow-up:** Either accept the plural-everywhere form `"N ITEMS NEED ATTENTION"` (matches spec exactly), or fully pluralize: `N ITEM NEEDS ATTENTION` vs `N ITEMS NEED ATTENTION`. Pick one and update tests.

### 5.4 Overdue progress bar "100%+"
- **Spec says:** Overdue status shows bar at "100%+", suggesting it should visually indicate overage amount (e.g. a red segment spilling past the bar edge).
- **Current plan:** Bar is clamped at 100%.
- **Follow-up:** Consider a visual treatment for severe overages — a small triangle marker past the bar edge, or a secondary fill segment indicating "over by X%". Design decision.

---

## 6. Out-of-Scope Items Worth Tracking

### 6.1 Dark-only theme cleanup
- **Spec says:** "Dark mode class (`.dark`) is no longer needed."
- **Current plan:** Removes the `.dark` block from `globals.css` but does not:
  - Remove `dark:` prefixes from other components (if any remain after Task 2's Button cleanup).
  - Set `color-scheme: dark` on `<html>` so browser UI (scrollbars, autofill, form controls) matches.
- **Follow-up:** Grep for remaining `dark:` usages and delete. Add `<html className="dark" style={{ colorScheme: 'dark' }}>` or equivalent.

### 6.2 Avatar with real user photo
- **Current plan:** Every avatar is a `<User size={14}>` icon inside a dark circle. Google sign-in provides a profile photo URL.
- **Follow-up:** Render the user's Google profile photo in the sidebar avatar and home header. Fallback to the icon if no photo. Requires surfacing `user.photoUrl` through `useAuthContext()`.

### 6.3 Preference persistence
- **Observation:** The sort toggle (Urgency / Name) on the vehicle dashboard resets to default on every page load.
- **Follow-up:** Persist the user's preferred sort to `localStorage` or a user preference API. Out of scope for the redesign but cheap to add.

### 6.4 Empty states
- **Current plan:** Shows plain-text "No maintenance cards yet." and "Loading cards…".
- **Follow-up:** Design proper empty states (illustration, eyebrow label, CTA) for:
  - No vehicles on fleet page.
  - No maintenance cards on vehicle page.
  - No search results (if search is ever added).
  - Loading states (skeleton cards instead of text).

---

## Prioritization Hints for Next Iteration

**High priority (next sprint):**
- Accessibility items 1.1, 1.2, 1.3 (screen reader + keyboard support).
- Safe-area insets 2.1 (real device blocker).
- History/Profile routes 3.1, 3.2 (404 prevention).

**Medium priority (follow-up spec):**
- Animation system 4.5.
- Progress bar component extraction 4.1.
- `getProgressFill` formula validation 5.1.

**Low priority (quality-of-life):**
- Empty states 6.4.
- Avatar photos 6.2.
- Sort preference persistence 6.3.
- Progress bar `100%+` visual 5.4.
