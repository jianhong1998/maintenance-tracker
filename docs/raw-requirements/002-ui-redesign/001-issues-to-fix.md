# UI Redesign Plan — Blocker Issues to Fix

**Source:** Gap analysis between `docs/superpowers/specs/2026-04-14-ui-redesign-design.md` and `docs/superpowers/plans/2026-04-14-ui-redesign.md` (2026-04-14).

**Purpose:** These are the blocker issues that must be resolved in the implementation plan **before execution**. Each entry names the affected plan task, the current (wrong) state, the spec requirement, and the fix direction. A downstream agent should rewrite the plan tasks to address every item.

---

## Category A — Functional Regressions (must-fix, breaks existing UX)

### A1. Back navigation on Vehicle Dashboard is non-functional

- **Task:** Task 8 (Vehicle Dashboard Page)
- **Current:** `"← FLEET"` is rendered as a plain `<p>` (plan line ~906). Not a `Link`, not a `button`.
- **Impact:** User clicks the arrow and nothing happens. Regresses existing working navigation.
- **Fix:** Wrap in `<Link href="/">` (or `router.back()`). On desktop (`xl:`), hide this block — the vehicle list panel from Task 11 replaces it.

### A2. Vehicle detail header drops the plate number and duplicates colour

- **Task:** Task 8 (Vehicle Dashboard Page)
- **Current:** Plan renders `{secondary}` (which is `brand/model` from `getVehicleDisplayLabels`) on one line, then `{colour} · {mileage} {unit}` on another line. Plate number is never rendered.
- **Spec requires:** Single-line meta: `"Colour · Mileage km · Plate: XXX"` in `--text-muted`.
- **Fix:** Add a new helper `getVehicleMetaLine(vehicle)` in `frontend/src/lib/vehicle-display.ts` returning `"Red · 45,230 km · Plate: ABC123"`. Replace the two `<p>` blocks with a single line using this helper. Do not reuse `getVehicleDisplayLabels` — it is designed for card-list brevity, not detail headers.

---

## Category B — Breakpoint & Responsive Layout Defects

### B1. `lg:` vs `xl:` breakpoint mismatch

- **Tasks:** Task 3 (AppShell), Task 11 (Vehicles Layout), implicitly Task 7 (Home Page grid)
- **Current:** Plan uses Tailwind's default `lg:` (1024px) for the full desktop sidebar and split pane.
- **Spec requires:** Mobile `< 768px`, Tablet `768–1279px`, Desktop `≥ 1280px`. Full sidebar and split pane must activate at **1280px**, not 1024px.
- **Fix:** Replace every `lg:` that gates "desktop-only" behavior with `xl:`. Affected places:
  - `app-shell-presentation.tsx`: `w-[52px] lg:w-[140px]` → `w-[52px] xl:w-[140px]`; `hidden lg:block` label spans → `hidden xl:block`; `md:ml-[52px] lg:ml-[140px]` → `md:ml-[52px] xl:ml-[140px]`.
  - `vehicles-layout.tsx`: `hidden lg:flex` → `hidden xl:flex`.
  - `home-page.tsx`: grid `sm:grid-cols-2 lg:grid-cols-3` — confirm 3-col target breakpoint against spec (spec says 3-col on desktop `≥ 1280`, so use `xl:grid-cols-3`).
- Alternative: redefine the Tailwind v4 theme breakpoints in `globals.css` if the team prefers `lg: 1280px` semantics globally. Pick one approach and apply consistently.

### B2. Dashboard has no desktop variant

- **Task:** Task 8
- **Current:** Header (with back nav + mobile layout) is rendered unconditionally. Desktop should be served by the `VehiclesLayout` split pane (Task 11).
- **Fix:** After A1, hide the back-nav block on `xl:` (`xl:hidden`) so the left list panel owns fleet navigation. Consider adjusting header padding at `xl:` to sit flush with the split pane.

### B3. Tablet sidebar hides labels it should show

- **Task:** Task 3 (AppShell)
- **Current:** Labels are `<span className="hidden lg:block">`, so at tablet (52px sidebar) they are hidden entirely.
- **Spec requires:** Tablet nav = "icon + small label **below**, vertical stack".
- **Fix:** Change nav item layout at tablet to `flex-col items-center gap-0.5` with a small label `md:block xl:hidden`. At `xl:` switch to the horizontal `flex items-center gap-2` with side-by-side text. Remove the invented absolutely-positioned active edge bar (see B4).

### B4. Tablet active indicator is broken (positioning + overcomplicated)

- **Task:** Task 3
- **Current:** `<span className="hidden md:block lg:hidden absolute left-0 w-0.5 h-5 ...">` — parent has no `relative` class, so absolute positioning is undefined. Spec never asked for an edge bar.
- **Spec requires:** Active nav item = `background: #00E5FF12`, `border-radius: 6px`, cyan icon/label.
- **Fix:** Delete the edge bar. Rely on the background tint alone (which the plan already applies). Keep the styling identical at tablet and desktop.

### B5. Mobile bottom tab bar border color is wrong

- **Task:** Task 3
- **Current:** `border-t border-white/5`.
- **Spec requires:** `border-top: 1px solid #00E5FF15`.
- **Fix:** `border-t border-[#00e5ff15]`. Same correction for the sidebar's `border-r` (spec `#00E5FF12`).

### B6. Profile tab lives outside `NAV_ITEMS`

- **Task:** Task 3
- **Current:** `NAV_ITEMS` contains Fleet + History only. Profile is hardcoded as a separate `<Link href="#">` after the `.map()`.
- **Spec requires:** Three tabs as peers. Profile should get the same active/inactive treatment (cyan dot, label color).
- **Fix:** Add Profile to `NAV_ITEMS` as `{ href: '/profile', label: 'Profile', icon: User }`. Route does not need to exist yet — note below in the "visual placeholder" follow-up. Use a `type="button"` with disabled styling if there is no route, **not** `href="#"` (leaves `#` in URL). Preferred: `href="/profile"` and let the route 404 quietly until implemented.

---

## Category C — Design Token System (foundation, blocks cascade)

### C1. Missing semantic tokens

- **Task:** Task 1 (CSS Design Tokens)
- **Current:** Only shadcn aliases declared (`--primary`, `--card`, `--border`, etc.). Every spec token not backed by a shadcn name is silently dropped.
- **Spec requires:** 17 semantic tokens. Missing from plan: `--bg-card-hover` (`#111D2B`), `--accent-dim` (`#00E5FF20`), `--accent-border` (`#00E5FF30`), `--danger-dim` (`#FF44440D`), `--warning` (`#F59E0B`), `--warning-dim` (`#F59E0B0D`), `--text-muted` (`#444444`), `--border-accent` (`#00E5FF15`).
- **Fix:** Add all missing tokens to `:root` in `globals.css`. Also add Tailwind v4 `@theme inline` bindings so Tailwind utilities (`bg-warning`, `border-accent`, etc.) resolve. Downstream tasks must stop hardcoding hex like `bg-[#0f1923]` where a token exists.

### C2. `--accent` semantic collision

- **Task:** Task 1
- **Current:** `--accent: #0f1923` (shadcn's "hover surface" semantics).
- **Spec requires:** `--accent: #00E5FF` (cyan primary).
- **Impact:** Anyone using Tailwind `bg-accent` expecting cyan gets dark surface. Silent, long-lived drift.
- **Fix:** Option 1 — Rename the spec's accent to use `--primary` semantics (the plan already has `--primary: #00e5ff`) and document that `bg-accent` is reserved for hover surfaces. Option 2 — Redirect `--accent` to `#00e5ff` and rename the hover surface to `--surface-hover`. **Pick Option 1** (lower blast radius) and add a comment in `globals.css` explaining the naming.

### C3. Global monospace font is not applied

- **Task:** Task 1
- **Current:** `@layer base body { @apply bg-background text-foreground; }` — no font-family set. `--font-mono` is registered but unused.
- **Spec requires:** `font-family: monospace` applied globally (or Geist Mono for eyebrow/label tier).
- **Fix:** Add `font-family: var(--font-mono);` on `body` (or `@apply font-mono`). Remove the ad-hoc `font-mono` class sprinkled through every component in downstream tasks — they become redundant.

### C4. No design tokens for typography roles

- **Task:** Task 1
- **Current:** Five type roles in the spec (Page title, Eyebrow, Card title, Body/meta, Status chip) are implemented via hardcoded `text-[0.6rem]` and `tracking-[0.15em]` in every component.
- **Spec requires:** Uniform typography system.
- **Fix:** Add utility classes in `globals.css`:
  ```css
  @layer components {
    .text-page-title {
      @apply text-xl font-extrabold text-white;
    }
    .text-eyebrow {
      font-size: 0.6rem;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--text-secondary);
    }
    .text-card-title {
      font-size: 0.6875rem;
      font-weight: 700;
      color: white;
    }
    .text-status-chip {
      font-size: 0.5rem;
      font-weight: 700;
      text-transform: uppercase;
    }
  }
  ```
  Update downstream tasks (5, 6, 7, 8, 9, 11) to use these classes instead of inlined sizes.

---

## Category D — Button Component Variants

### D1. Primary button weight and radius wrong

- **Task:** Task 2 (Button Component)
- **Current:** `font-bold` (700), `rounded-md` (≈8px).
- **Spec requires:** `font-weight: 800`, `border-radius: 10px`.
- **Fix:** `font-extrabold` (800) and `rounded-[10px]` (or `rounded-lg` if `--radius-lg` is re-tuned). Apply on the `default` variant.

### D2. Secondary button border wrong

- **Task:** Task 2
- **Current:** `border border-white/10`.
- **Spec requires:** `border: 1px solid #333`.
- **Fix:** `border border-[#333]`.

### D3. Dashed ghost (add) button variant is missing

- **Task:** Task 2
- **Current:** `ghost` variant = `hover:bg-accent hover:text-accent-foreground`. No dashed border, no cyan text. Downstream tasks (Home, Vehicle Dashboard, maintenance list) each reimplement the dashed-border pattern inline.
- **Spec requires:** `border: 1px dashed #00E5FF20`, `color: #00E5FF`, transparent background. Used by "+ ADD VEHICLE" and "+ ADD MAINTENANCE CARD".
- **Fix:** Add a new variant `dashed-ghost` (or rename `ghost` if safe) with `border border-dashed border-[#00e5ff20] bg-transparent text-[#00e5ff] hover:bg-[#00e5ff08]`. Replace the inline `<button>` implementations in Tasks 7 and 8 with `<Button variant="dashed-ghost">`.

### D4. No `xs` size variant for 16×16 icon buttons

- **Task:** Task 2
- **Current:** Smallest size is `icon` (`size-9` = 36px). The `⋮` action button in maintenance rows needs 16×16.
- **Fix:** Add a new size variant: `'icon-xs': 'size-4 rounded-[4px]'`. Document usage: spec expects it for the `⋮` button.

### D5. Destructive-outline style for Delete button

- **Task:** Task 2, Task 8
- **Current:** Plan uses `secondary` variant + inline `text-destructive border-[#ff444330]` overrides on the Delete button in Task 8.
- **Spec requires:** Secondary button style with `color: #FF4444`, `border: 1px solid #FF444330`.
- **Fix:** Either accept the inline override (simplest) or add a named variant `secondary-destructive`. Prefer the latter so "Delete" styling is consistent wherever it appears.

---

## Category E — Login Page Visual Accuracy

### E1. Logo container size wrong

- **Task:** Task 5 (Login Page)
- **Current:** `w-14 h-14` (56px).
- **Spec requires:** `52×52px`.
- **Fix:** `w-[52px] h-[52px]`.

### E2. Logo border and background colors wrong

- **Task:** Task 5
- **Current:** `border-[#00e5ff30]`, `bg-[#00e5ff08]`.
- **Spec requires:** `border: 1px solid #00E5FF40`, `bg: #00E5FF12`.
- **Fix:** `border-[#00e5ff40]`, `bg-[#00e5ff12]`.

### E3. Inner gradient block size wrong

- **Task:** Task 5
- **Current:** `w-7 h-7` (28px).
- **Spec requires:** `24×24px`.
- **Fix:** `w-6 h-6`.

### E4. Ambient glow is blur, not radial gradient

- **Task:** Task 5
- **Current:** `w-32 h-32 rounded-full bg-[#00e5ff08] blur-2xl`.
- **Spec requires:** `radial-gradient(circle, #00E5FF12, transparent 70%)`.
- **Fix:** `<div className="absolute w-40 h-40 bg-[radial-gradient(circle,#00e5ff12,transparent_70%)]" />`. Keep it centered behind the logo.

### E5. Terms text size

- **Task:** Task 5
- **Current:** `text-[0.6rem]`.
- **Spec requires:** `font-size: 0.5rem`.
- **Fix:** `text-[0.5rem]`.

---

## Category F — Vehicle Card Layout

### F1. Meta line renders on three lines instead of one

- **Task:** Task 6 (Vehicle Card)
- **Current:** `primary`, `secondary`, and mileage render as three separate `<p>` elements.
- **Spec requires:** One meta line: `"Colour · Mileage km"` in `--text-secondary`.
- **Fix:** After F4 (title size) is correct, render a single `<p>` with `${vehicle.colour} · ${mileage.toLocaleString()} ${unit}`. Drop `secondary` from the card — brand/model belongs in the detail page, not the list card.

### F2. Healthy border uses wrong token

- **Task:** Task 6
- **Current:** `border-white/5` when no warnings.
- **Spec requires:** `1px solid #00E5FF15` (i.e. `--border-accent`).
- **Fix:** `border-[#00e5ff15]`. Once C1 lands, use `border-border-accent`.

### F3. Radius and padding off

- **Task:** Task 6
- **Current:** `rounded-xl` (12px), `p-3` (12px).
- **Spec requires:** `border-radius: 10px`, `padding: 11px`.
- **Fix:** `rounded-[10px]`, `p-[11px]`.

### F4. Card title too large

- **Task:** Task 6
- **Current:** `text-sm` (0.875rem = 14px).
- **Spec requires:** Card title token `0.6875rem` (11px), `font-weight: 700`.
- **Fix:** Use the `text-card-title` class from C4, or inline `text-[0.6875rem] font-bold`.

---

## Category G — Vehicle Dashboard Layout

### G1. Header padding wrong

- **Task:** Task 8
- **Current:** `px-4 pt-4 pb-5` (16/16/20).
- **Spec requires:** `padding: 10px 12px 8px`.
- **Fix:** `px-[12px] pt-[10px] pb-[8px]`. Review the whole header block for the 10px horizontal gutter pattern.

### G2. Mileage prompt container wrong size/spacing

- **Task:** Task 8 (Mileage Prompt Presentation)
- **Current:** `rounded-xl` (12px), `p-3` (12px), no margin.
- **Spec requires:** `border-radius: 8px`, `padding: 8px`, `margin: 0 10px 6px`.
- **Fix:** `rounded-lg p-2 mx-[10px] mb-[6px]`.

### G3. Input focus ring wrong

- **Task:** Task 8
- **Current:** `focus:ring-[#00e5ff30]`.
- **Spec requires:** Focus ring `#00E5FF40`.
- **Fix:** `focus:ring-[#00e5ff40]`.

### G4. Maintenance card list gap wrong

- **Task:** Task 8
- **Current:** `flex flex-col gap-2` (8px) wrapping cards, list wrapper `px-4 py-4 gap-4`.
- **Spec requires:** Card list `padding: 0 10px`, `gap: 5px`.
- **Fix:** `px-[10px] gap-[5px]`.

---

## Category H — Maintenance Card Row

### H1. `⋮` action button is 75% oversized

- **Task:** Task 9 (Maintenance Card Row)
- **Current:** `h-7 w-7` (28×28px), `bg-[#0d1117]`, `border-white/10`, `rounded-md`.
- **Spec requires:** `16×16px`, `background: #0F1923`, `border: 1px solid #333`, `border-radius: 4px`, `color: #555`.
- **Fix:** After D4 (Button `icon-xs` size variant), replace with `<Button variant="secondary" size="icon-xs">⋮</Button>` styled with the correct bg/border/radius. Or inline: `h-4 w-4 rounded-[4px] bg-[#0f1923] border border-[#333] text-[#555]`.

### H2. Type badge is ~2.3× too big and uses wrong colors

- **Task:** Task 9
- **Current:** `bg-[#0d1117]`, `border-white/10`, `text-[0.55rem]` (~8.8px), `px-1.5 py-0.5`.
- **Spec requires:** `background: #0F1923`, `border: 1px solid #333`, `color: #555`, `font-size: 6px` (≈0.375rem), `padding: 1px 4px`.
- **Fix:** `bg-[#0f1923] border border-[#333] text-[#555] text-[0.375rem] px-[4px] py-[1px]`.

### H3. Missing hover state on card row

- **Task:** Task 9
- **Current:** Card wrapper has no `hover:` class.
- **Spec requires:** `--bg-card-hover: #111D2B` applies to maintenance card rows on pointer devices.
- **Fix:** Add `hover:bg-[#111d2b]` on the card wrapper. Wrap in `@media (hover: hover)` guard (see follow-up file for the mobile sticky-hover concern — only the presence of the rule is a blocker here).

### H4. Card radius and padding off

- **Task:** Task 9
- **Current:** `rounded-xl` (12px), `p-3` (12px).
- **Spec requires:** `border-radius: 8px`, `padding: 9px`.
- **Fix:** `rounded-lg p-[9px]`.

### H5. Progress bar margin not encoded

- **Task:** Task 9
- **Current:** Bar wrapped in a bare `<div>` with no vertical margin control.
- **Spec requires:** `margin: 5px 0 2px` around the track.
- **Fix:** `<div className="mt-[5px] mb-[2px]">`.

---

## Category I — Desktop Split Pane

### I1. Vehicle list panel uses text, not a status chip

- **Task:** Task 11 (Vehicles Layout)
- **Current:** Renders `N overdue` as plain red text.
- **Spec requires:** "name, mileage, **status chip**".
- **Fix:** Extract the fleet-home status chip into a reusable component (e.g. `components/vehicles/vehicle-status-chip.tsx`) and use it in both `VehicleCard` and `VehicleListItem`.

### I2. Sidebar user label is hardcoded "Profile"

- **Task:** Task 3 (AppShell)
- **Current:** `<span className="hidden lg:block text-[#444] text-xs">Profile</span>`.
- **Spec requires:** User avatar + **name** at bottom.
- **Fix:** Pull `user.displayName` (or equivalent) from `useAuthContext()` in the `AppShell` client component and pass it to `AppShellPresentation` as a prop. Render it in the sidebar avatar block and in the home page header avatar.

---

## Category J — Scope Gap

### J1. Form dialogs are not restyled

- **Tasks:** Task 10 covers `dialog.tsx` only. No task covers `VehicleFormDialog`, `MaintenanceCardFormDialog`, `MarkDoneDialog`, `VehicleDeleteConfirmDialog`, `DeleteConfirmDialog`.
- **Spec scope item 9:** "Restyle all dialogs (`dialog.tsx`, form dialogs) — dark surface, cyan primary buttons."
- **Impact:** After Task 10 lands, the dialog shell is dark but form inputs, labels, validation errors, and submit/cancel buttons inside the form dialogs still carry shadcn-white styling from before the redesign.
- **Fix:** Add a new task "Task 12: Form Dialog Content Restyle" that walks each form dialog component and:
  - Replaces inputs with `bg-[#07090f] border-[#00e5ff20]` style (matching mileage prompt input).
  - Maps labels to `text-eyebrow` utility.
  - Validation errors use `text-destructive` (already the case in most places — verify).
  - Submit buttons use `<Button variant="default">` (cyan primary). Cancel uses `<Button variant="secondary">`.
  - Includes test updates where existing tests check old class names.

---

## Execution Notes for the Plan Enhancer

1. **Fix Task 1 first.** Categories C and D cascade everywhere; landing tokens and Button variants up front removes hardcoded hex from every downstream task and shrinks the diff.
2. **Add a new helper task.** Before Task 6 (Vehicle Card), add a tiny task "Task 5.5: Vehicle meta/display helpers" that adds `getVehicleMetaLine` and extracts the status chip component (I1). Both Tasks 6 and 8 consume these.
3. **Re-order if needed.** Task 11 (Vehicles Layout) should land before Task 8's desktop variant work — or Task 8 should explicitly note "desktop layout delivered by Task 11".
4. **Tests.** Some existing specs assert on class names like `bg-destructive/10`. After the token rename and component restyle, update or delete those assertions before the new components land (Task 9 already does this — apply the same pattern wherever it bites).
5. **Linus taste rule.** For every fix above, if the plan currently implements it inline and it can become a single reusable primitive (status chip, dashed-ghost button, eyebrow class, card hover), prefer the primitive. Three inline duplicates is the trigger.
