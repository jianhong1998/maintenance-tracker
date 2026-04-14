# UI Redesign — Design Spec

**Date:** 2026-04-14
**Status:** Approved (revised 2026-04-14 after gap analysis)

## Overview

Full visual redesign of the Maintenance Tracker frontend. The current UI is stock shadcn/ui on a white background with no visual identity. This spec defines a Dark Terminal aesthetic — inspired by crypto trading dashboards and AI developer tools — with a fully responsive, mobile-first layout strategy.

No backend changes. No new data. Pure frontend: CSS tokens, layout structure, and component styling.

---

## Design System

### Color Palette

All tokens are declared in `globals.css` on `:root` and exposed to Tailwind via `@theme inline` bindings. Downstream code should reference tokens (`bg-background`, `border-border-accent`, etc.) and stop hardcoding hex literals wherever a token exists.

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#07090F` | Page background |
| `--bg-surface` | `#0D1117` | Navigation surfaces (sidebar, bottom tab bar, popover) |
| `--bg-card` | `#0F1923` | Card, input, and secondary button backgrounds |
| `--bg-card-hover` | `#111D2B` | Card hover (vehicle cards + maintenance card rows, pointer devices only) |
| `--accent` | `#0F1923` | **Reserved**: hover surface in shadcn semantics (same value as `--bg-card`). The cyan primary color is exposed via `--primary`, not `--accent`. See C2 note below. |
| `--primary` | `#00E5FF` | Primary interactive — buttons, active nav, links, focus rings |
| `--primary-dim` | `#00E5FF20` | Subtle cyan tints (dashed-ghost borders, mileage prompt border) |
| `--primary-border` | `#00E5FF30` | Accent borders (dividers, decorative) |
| `--border-accent` | `#00E5FF15` | Healthy card borders, sidebar rails |
| `--ring` | `#00E5FF40` | Focus ring on inputs and buttons |
| `--danger` | `#FF4444` | Overdue status, destructive actions, alert pill |
| `--danger-dim` | `#FF44440D` | Overdue card background tint, alert pill background |
| `--danger-border` | `#FF444328` | Overdue card border |
| `--warning` | `#F59E0B` | Warning threshold status |
| `--warning-dim` | `#F59E0B0D` | Warning card background tint |
| `--warning-border` | `#F59E0B28` | Warning card border |
| `--text-primary` | `#FFFFFF` | Headings, card titles |
| `--text-secondary` | `#888888` | Labels, subtitles, eyebrow text |
| `--text-muted` | `#444444` | Inactive nav items, placeholder, card meta |
| `--text-disabled` | `#555555` | Type badge text, far-from-due healthy labels |
| `--border` | `#FFFFFF10` | Default card borders, default chrome |

**C2 note on `--accent` collision.** shadcn's Tailwind conventions treat `bg-accent` as a *hover surface* color, not an interactive tint. To avoid silent drift, this spec keeps `--accent` aligned with shadcn semantics (`#0F1923` — a dark surface) and uses `--primary` for the cyan interactive color. Reference `bg-primary` / `text-primary` / `border-primary` for cyan; reference `bg-accent` only for hover surfaces.

### Typography

Global `font-family` is **monospace** (`Geist Mono` via the `--font-mono` variable). Apply on `body` in `@layer base`. No component should need an ad-hoc `font-mono` class.

| Role | Utility class | Style |
|---|---|---|
| Page title | `.text-page-title` | `font-size: 1.25rem`, `font-weight: 800`, color `--text-primary` |
| Eyebrow / label | `.text-eyebrow` | `font-size: 0.6rem`, `letter-spacing: 0.15em`, uppercase, color `--text-secondary` |
| Card title | `.text-card-title` | `font-size: 0.6875rem`, `font-weight: 700`, color `--text-primary` |
| Body / meta | `.text-meta` | `font-size: 0.625rem`, color `--text-secondary` |
| Status chip | `.text-status-chip` | `font-size: 0.5rem`, `font-weight: 700`, uppercase |

These roles MUST be encoded as utility classes in `@layer components` of `globals.css`. Downstream code should not inline `text-[0.6rem] tracking-[0.15em]` repeatedly.

### Component Tokens

**Primary button** (`variant: default`):
- `background: var(--primary)` / `#00E5FF`
- `color: var(--primary-foreground)` / `#07090F`
- `font-weight: 800`, `border-radius: 10px`
- Tailwind: `rounded-[10px] font-extrabold`

**Secondary button** (`variant: secondary`):
- `background: var(--bg-card)` / `#0F1923`
- `border: 1px solid #333`
- `color: #AAAAAA`

**Destructive-outline button** (`variant: secondary-destructive`): secondary button with `color: var(--danger)`, `border: 1px solid #FF444330`. Used for the Delete button on Vehicle Detail.

**Dashed-ghost / add button** (`variant: dashed-ghost`):
- `background: transparent`
- `border: 1px dashed var(--primary-dim)` / `#00E5FF20`
- `color: var(--primary)` / `#00E5FF`
- Hover: `background: #00E5FF08`
- Used by "+ ADD VEHICLE" and "+ ADD MAINTENANCE CARD"; there MUST be no inline duplication.

**`icon-xs` button size**: `16×16px`, `border-radius: 4px`. Used by the `⋮` action button on maintenance cards.

**Input field:** `background: var(--bg-base)` / `#07090F`, `border: 1px solid var(--primary-dim)` / `#00E5FF20`, focus ring `var(--ring)` / `#00E5FF40`.

**Progress bar track:** `background: #1A1A2E`, `height: 3px`, `border-radius: 2px`.

**Progress bar fill — overdue:** solid `--danger` / `#FF4444`, width clamped at `100%` (see Q4 decision below).

**Progress bar fill — warning:** gradient `#F59E0B60 → #F59E0B`, linear from `60%` to `99%` across the warning zone.

**Progress bar fill — healthy:** gradient `#00E5FF40 → #00E5FF`, linear from `0%` to `59%` across the healthy lookahead zone (see formula below).

### Progress Bar Formula

Let `threshold` be the warning-threshold km (or miles native), `remaining` be `nextDueMileage - currentMileage` in native units.

- **Overdue** (`remaining ≤ 0`): fill = `100%`, bar color solid red. Clamped — magnitude communicated via text label only.
- **Warning** (`0 < remaining ≤ threshold`): fill = `60 + ((threshold - remaining) / threshold) × 39`. Starts at `60%` when `remaining == threshold`, reaches `99%` as `remaining → 0`. Linear.
- **Healthy** (`remaining > threshold`): `lookahead = 5 × threshold`. Fill = `(1 - min(remaining, lookahead) / lookahead) × 59`. Starts at `0%` when `remaining ≥ lookahead`, grows to `59%` when `remaining → threshold`. Linear. No minimum floor.

### Healthy Label Color Rule

Healthy cards MUST pick the label color based on proximity to the warning zone:

- `remaining > 3 × threshold`: label color = `--text-disabled` / `#555555` (muted — "not yet noteworthy")
- `threshold < remaining ≤ 3 × threshold`: label color = `--primary` / `#00E5FF` (cyan — "leaning in, still healthy")

This is the single source of truth for the earlier spec's ambiguous "`#00E5FF` / `#555`" wording.

### Sub-label Rule (Maintenance Cards)

Every maintenance card with a `nextDueMileage` renders exactly ONE text label for remaining-mileage state:

- Placement: **above** the progress bar, in the top-right of the card's header row (next to the `⋮` button).
- Content:
  - Overdue: `"{N} {unit} past due"` (e.g. `"120 km past due"`), color `--danger`.
  - Warning: `"{N} {unit} left"`, color `--warning`.
  - Healthy: `"{N} {unit} left"`, color per the Healthy Label Color Rule above.

There is NO status-text label below the progress bar. The bar's color + the single number label are the complete status encoding. Redundant "On track" / "Within warning threshold" text is removed.

### Alert Pill Pluralization

The Fleet Home alert pill uses full English pluralization. Exact copy:

- `count === 1`: `"1 ITEM NEEDS ATTENTION"`
- `count > 1`: `"{count} ITEMS NEED ATTENTION"`

---

## Responsive Layout Strategy

### Breakpoints

| Name | Range | Tailwind prefix |
|---|---|---|
| Mobile | `< 768px` | (default, no prefix) |
| Tablet | `768px – 1279px` | `md:` |
| Desktop | `≥ 1280px` | `xl:` |

**Note:** This spec uses Tailwind's `xl:` (1280px) for desktop, NOT the default `lg:` (1024px). Any place that needs "desktop-only" behavior (full sidebar with labels, split-pane vehicle detail, 3-column fleet grid) MUST gate on `xl:`. Tablet behavior (icon-only sidebar) gates on `md:` up to `xl:`.

### Mobile (`< 768px`) — Primary target

- **Navigation:** Fixed bottom tab bar.
  - `height: 48px`, `background: var(--bg-surface)`, `border-top: 1px solid var(--border-accent)` (`#00E5FF15`).
  - Three tabs as peers: Fleet (icon + label), History (icon + label), Profile (icon + label). Profile is NOT a special case — it lives in the same `NAV_ITEMS` array as Fleet and History and receives identical active/inactive treatment.
  - Active tab: cyan dot indicator above icon, plus cyan icon + label.
  - Inactive tab: muted icon (`--text-muted`), label color `--text-muted`.
  - `aria-current="page"` on the active link.
  - Safe-area insets: bottom tab bar MUST include `padding-bottom: env(safe-area-inset-bottom)`; content wrapper bottom padding MUST include `calc(3rem + env(safe-area-inset-bottom))`. The root layout's viewport meta MUST include `viewport-fit=cover`.
- **Fleet Home:** Single-column vehicle card list, full-width.
- **Vehicle Detail:** Full-screen page, back arrow (`← FLEET`) at top-left as a functional `<Link href="/">`, inline Edit/Delete buttons top-right.
- **Page transitions:** Standard push navigation (back arrow returns to fleet).

### Tablet (`768px – 1279px`)

- **Navigation:** Icon sidebar.
  - `width: 52px`, `background: var(--bg-surface)`, `border-right: 1px solid #00E5FF12`.
  - Each item is a vertical stack: `flex-col items-center gap-0.5` with icon on top and small label below (label visible at tablet, visible with different layout at desktop).
  - Active item: `background: #00E5FF12`, `border-radius: 6px`, cyan icon + label. No absolute-positioned edge bar — the background tint alone signals active.
  - Bottom tab bar hidden at this breakpoint.
- **Fleet Home:** 2-column vehicle card grid (`md:grid-cols-2`).
- **Vehicle Detail:** Single content panel (same structure as mobile, wider cards). Back arrow still visible.

### Desktop (`≥ 1280px`)

- **Navigation:** Full sidebar.
  - `width: 140px`, `background: var(--bg-surface)`.
  - Logo mark + `"MTRACK"` eyebrow text at top.
  - Nav items: icon + text label side by side (`flex items-center gap-2`), full-width rows.
  - Active item: `background: #00E5FF12`, `border-radius: 6px`, cyan text.
  - User avatar + **real user display name** at bottom (sourced from `useAuthContext().user.displayName`, fallback to `"Profile"`).
- **Fleet Home:** 3-column vehicle card grid (`xl:grid-cols-3`).
- **Vehicle Detail:** Split-pane layout (`/vehicles/*` segment layout).
  - Left panel (`width: 220px`): scrollable vehicle list — all vehicles with name, mileage, and a vehicle status chip (reusing the same chip component as Fleet Home — NO text-only status).
  - Right panel (flex: 1): selected vehicle's full detail — header + mileage prompt + sort toggle + maintenance card list.
  - Selected vehicle highlighted in left panel with accent border.
  - Back-navigation block (`← FLEET`) MUST be hidden (`xl:hidden`) on the detail page — the left panel replaces it.

---

## Screen Designs

### Login Page

- Full-screen dark canvas (`var(--bg-base)` / `#07090F`).
- Vertically and horizontally centered content column.
- Logo mark: `52×52px` container with `1px solid #00E5FF40` border, `border-radius: 16px`, subtle `#00E5FF12` background. Inner `24×24px` gradient block (`#00E5FF → #0066FF`).
- Ambient glow: a sibling element positioned behind the logo with `background: radial-gradient(circle, #00E5FF12, transparent 70%)` (NOT `blur-2xl`), sized to `~160×160px` and centered.
- Eyebrow: `"MAINTENANCE"` in cyan, `letter-spacing: 3px`.
- Title: `"TRACKER"` in white, `font-size: 1.5rem`, `font-weight: 800`.
- Subtitle: `"Vehicle maintenance, under control."` in `--text-muted`.
- Decorative divider: `80px` wide, gradient `transparent → #00E5FF30 → transparent`.
- CTA: full-width Primary button `"SIGN IN WITH GOOGLE"`.
- Terms text: `#333`, `font-size: 0.5rem`.

### Fleet Home Page

**Header section** (`background: linear-gradient(180deg, #0D1117, #07090F)`, `padding: 10px 12px 8px`):
- Logo mark (left, mobile-only) + user avatar circle (right). On desktop, the logo lives in the sidebar — avatar aligns right.
- Eyebrow: `"FLEET OVERVIEW"` using `.text-eyebrow`.
- Page title: `"Your Vehicles"` using `.text-page-title`.
- Alert pill (when warnings exist): `background: var(--danger-dim)`, `border: 1px solid #FF444330`, `border-radius: 20px`, red dot + alert pluralization string (see Alert Pill Pluralization rule) in red. Hidden when all clear.

**Vehicle card list / grid** (below header, `padding: 0 10px`):
- Card: `background: var(--bg-card)`, `border-radius: 10px`, `padding: 11px`.
- Border: `1px solid #FF444328` when overdue cards present, else `1px solid var(--border-accent)` (`#00E5FF15`).
- Title row: vehicle name (`.text-card-title`) + single meta line `"{colour} · {mileage.toLocaleString()} {unit}"` in `--text-secondary`. Brand/model is NOT shown on the home card — it belongs in the detail page.
- Right side: `<VehicleStatusChip count={warningCount} />` + `ChevronRight size={14}` in `--text-muted`.
- Hover (pointer devices only, gated via `@media (hover: hover)` or Tailwind's `hover-pointer:` variant): `background: var(--bg-card-hover)` (`#111D2B`).
- Add vehicle: `<Button variant="dashed-ghost">+ ADD VEHICLE</Button>` full width.

**VehicleStatusChip** (reusable component, single source of truth):
- Props: `{ count: number }`.
- `count > 0`: `background: #FF444418`, `color: var(--danger)`, `border: 1px solid #FF444440`, text `"{count} OVERDUE"`.
- `count === 0`: `background: #00E5FF10`, `color: var(--primary)`, `border: 1px solid #00E5FF25`, text `"ALL GOOD"`.
- Used in `VehicleCard`, `VehicleListItem` (desktop split pane), and any future fleet-level surfaces.

### Vehicle Detail Page

**Header** (`background: linear-gradient(180deg, #0D1117, #07090F)`, `padding: 10px 12px 8px`):
- Back navigation block (`← FLEET`): rendered as a functional `<Link href="/">`, cyan arrow + `.text-eyebrow` label `"FLEET"`. Hidden on `xl:` where the vehicle list panel replaces it.
- Vehicle name: `.text-page-title`.
- **Meta line (single):** `"{colour} · {mileage.toLocaleString()} {unit} · Plate: {plateNumber}"` in `--text-muted`. Rendered via a new helper `getVehicleMetaLine(vehicle)` in `frontend/src/lib/vehicle-display.ts`. This helper is distinct from the existing `getVehicleDisplayLabels` (which is intentionally terse for card-list brevity).
- Edit button: `<Button variant="secondary">`.
- Delete button: `<Button variant="secondary-destructive">` (destructive-outline variant declared above).

**Mileage update prompt** (shown when due for update):
- Container: `background: var(--bg-card)`, `border: 1px solid var(--primary-dim)`, `border-radius: 8px`, `padding: 8px`, `margin: 0 10px 6px`.
- Eyebrow: `"UPDATE ODOMETER"` using `.text-eyebrow` (overridden to color `--primary`).
- Row: flex input field + cyan `"OK"` primary button. Input focus ring is `var(--ring)` (`#00E5FF40`).

**Sort toggle** (`margin: 0 10px 6px`):
- Two buttons side by side (Urgency / Name).
- Active: `variant: default` (primary); Inactive: `variant: secondary`.

**Add card button:** `<Button variant="dashed-ghost">+ ADD MAINTENANCE CARD</Button>` full width.

**Maintenance card list** (`padding: 0 10px`, `gap: 5px`):

Each card (`<MaintenanceCardRow>`):
- Container `background` + `border` vary by status (see below).
- `border-radius: 8px`, `padding: 9px`.
- Hover (pointer devices only): `background: var(--bg-card-hover)`.
- Top row: card name (`.text-card-title`) + type badge below name on the left; single status/remaining label + `⋮` action button on the right.
- Type badge: `background: var(--bg-card)`, `border: 1px solid #333`, `color: var(--text-disabled)`, `font-size: 6px` (~`0.375rem`), `padding: 1px 4px`.
- Progress bar: wrapped in `<div className="mt-[5px] mb-[2px]">`, height `3px`, track `#1A1A2E`.
- Sub-label (single): see "Sub-label Rule" above — this sits in the top-right of the header row, not below the bar.

Status variants:

| Status | Card bg | Card border | Bar fill | Label color |
|---|---|---|---|---|
| Overdue | `var(--danger-dim)` (`#FF44440D`) | `var(--danger-border)` (`#FF444328`) | `var(--danger)` (100%) | `var(--danger)` |
| Warning | `var(--bg-card)` (`#0F1923`) | `var(--warning-border)` (`#F59E0B28`) | `#F59E0B60→#F59E0B` (60→99%) | `var(--warning)` |
| Healthy (muted) | `var(--bg-card)` (`#0F1923`) | `var(--border-accent)` (`#00E5FF15`) | `#00E5FF40→#00E5FF` (0→59%) | `var(--text-disabled)` |
| Healthy (cyan) | `var(--bg-card)` (`#0F1923`) | `var(--border-accent)` (`#00E5FF15`) | `#00E5FF40→#00E5FF` (0→59%) | `var(--primary)` |

**`⋮` action button:** `<Button variant="secondary" size="icon-xs">⋮</Button>` with inline text color `var(--text-disabled)`. The underlying variant yields `16×16px`, `background: var(--bg-card)`, `border: 1px solid #333`, `border-radius: 4px`. Opens the existing dropdown (Mark Done / Edit / Delete) — semantics + keyboard navigation are a follow-up (see Section "Deferred Items").

---

## Dialog Pattern

All dialogs (`dialog.tsx` shell + every form dialog) are dark-surface with cyan primary CTAs.

**Desktop / Tablet (`sm:` and up):** Centered modal. `background: var(--bg-surface)`, `border: 1px solid var(--border)`, `border-radius: 16px`.

**Mobile (`< sm:`):** Bottom sheet. `items-end`, `rounded-t-2xl rounded-b-none`, full-width. A visible drag-handle "grabber" at the top of the sheet — 32×3px pill, `background: #ffffff20`, centered, margin-bottom 8px. The grabber is an affordance-only element; swipe-to-dismiss gesture is NOT implemented this sprint (see deferred items).

**Inputs** inside form dialogs: `background: var(--bg-base)`, `border: 1px solid var(--primary-dim)`, focus ring `var(--ring)`. Placeholder color `var(--text-muted)`. Labels use `.text-eyebrow`. Validation errors use `text-destructive`.

**Buttons** inside form dialogs: Submit = `<Button variant="default">`, Cancel = `<Button variant="secondary">`.

---

## Placeholder Routes (History, Profile)

The nav surface ships three tabs: Fleet, History, Profile. History and Profile are feature placeholders — no real functionality this sprint — but the routes MUST exist so clicks do not 404.

- `frontend/src/app/history/page.tsx`: empty `'use client'` page rendering a centered `.text-eyebrow` `"HISTORY"` + `"Coming soon."` in `--text-muted`. Wrapped in `<AuthGuard>` for consistency.
- `frontend/src/app/profile/page.tsx`: same pattern, eyebrow `"PROFILE"` + `"Coming soon."`.

`NAV_ITEMS` in `AppShellPresentation` MUST contain three peer entries: `{ href: '/', label: 'Fleet', icon: Car }`, `{ href: '/history', label: 'History', icon: Clock }`, `{ href: '/profile', label: 'Profile', icon: User }`. No separate hardcoded Profile link. No `href="#"`.

Active-match logic: `pathname === href || pathname.startsWith(`${href}/`)` — segment-boundary match, not prefix-startsWith (prevents `/history-of-anything` from matching `/history`).

---

## Implementation Scope

### In scope

1. `globals.css` — full dark palette token set, Tailwind `@theme inline` bindings, typography utility classes in `@layer components`, `font-family: var(--font-mono)` on `body`, remove the `.dark` block.
2. `Button` component — refactor variants: `default` (cyan primary, rounded-[10px], font-extrabold), `secondary`, `secondary-destructive` (new), `dashed-ghost` (new), plus `icon-xs` size (new). Remove all `dark:` prefixes.
3. Vehicle-display helpers — add `getVehicleMetaLine` and extract `VehicleStatusChip` component.
4. `AppShell` (new) + `AppShellPresentation` (new) — responsive shell, three-peer `NAV_ITEMS`, segment-boundary active match, `aria-current="page"`, safe-area insets on mobile, real user display name on desktop.
5. `LoginPage` — new centered layout, correct logo sizing (52px container, 24px inner gradient), radial-gradient glow, cyan CTA, `0.5rem` terms text.
6. `HomePage` — header gradient (`padding: 10px 12px 8px`), alert pill with plural rule, vehicle grid (`md:grid-cols-2 xl:grid-cols-3`), dashed-ghost add button.
7. `VehicleCard` — dark card (`rounded-[10px] p-[11px]`), single meta line using `getVehicleDisplayLabels` primary only + `"colour · mileage unit"`, VehicleStatusChip + chevron, pointer-only hover.
8. `VehicleDashboardPage` — correct padding (`px-[12px] pt-[10px] pb-[8px]`), functional back Link (hidden `xl:`), meta line via `getVehicleMetaLine`, secondary-destructive Delete button, dashed-ghost add card button, mileage prompt with correct sizing (`rounded-lg p-2 mx-[10px] mb-[6px]`, ring `#00e5ff40`), card list with `px-[10px] gap-[5px]`.
9. `MaintenanceCardRow` — progress bar with the formula above, single top-right sub-label, pointer-only hover, `icon-xs` secondary action button, correct type badge size (`text-[0.375rem] px-[4px] py-[1px]`), card geometry (`rounded-lg p-[9px]`), bar margin (`mt-[5px] mb-[2px]`).
10. `MileagePromptPresentation` — dark input (`bg-[#07090f] border-[#00e5ff20]`), cyan OK button, dismiss as ghost.
11. `Dialog` shell — dark surface, drag-handle grabber on mobile, `rounded-t-2xl rounded-b-none` on mobile, centered with border-radius 16px on `sm:` up, focus-trap TODO in deferred items.
12. **Form dialog content** — `VehicleFormDialog`, `MaintenanceCardFormDialog`, `MarkDoneDialog`, `VehicleDeleteConfirmDialog`, `DeleteConfirmDialog`: all inputs, labels, validation text, and buttons updated per the Dialog Pattern section. Existing tests that assert on old class names are updated.
13. `VehiclesLayout` (new) — desktop split pane; uses `VehicleStatusChip`, sources the user display name from auth context.
14. Placeholder routes `/history` and `/profile` with "Coming soon" pages.

### Out of scope (tracked in deferred items below)

- Accessibility: dropdown menu semantics, dialog focus trap, keyboard navigation.
- Animation / transition system.
- Google user photo rendering in avatars.
- Sort preference persistence to localStorage.
- Designed empty states with illustrations/CTAs.
- Swipe-to-dismiss gesture on bottom sheet dialogs.

---

## Tailwind v4 Token Declaration

Replace the existing shadcn OKLCH tokens in `globals.css`:

```css
:root {
  --radius: 0.625rem;

  /* Surfaces */
  --bg-base: #07090f;
  --bg-surface: #0d1117;
  --bg-card: #0f1923;
  --bg-card-hover: #111d2b;

  /* Interactive */
  --primary: #00e5ff;
  --primary-foreground: #07090f;
  --primary-dim: #00e5ff20;
  --primary-border: #00e5ff30;
  --border-accent: #00e5ff15;
  --ring: #00e5ff40;

  /* Accent (shadcn semantics — hover surface, NOT cyan) */
  --accent: #0f1923;
  --accent-foreground: #ffffff;

  /* Status */
  --danger: #ff4444;
  --danger-dim: #ff44440d;
  --danger-border: #ff444328;
  --warning: #f59e0b;
  --warning-dim: #f59e0b0d;
  --warning-border: #f59e0b28;

  /* Text */
  --text-primary: #ffffff;
  --text-secondary: #888888;
  --text-muted: #444444;
  --text-disabled: #555555;

  /* shadcn aliases pointing at the above */
  --background: var(--bg-base);
  --foreground: var(--text-primary);
  --card: var(--bg-card);
  --card-foreground: var(--text-primary);
  --popover: var(--bg-surface);
  --popover-foreground: var(--text-primary);
  --secondary: var(--bg-card);
  --secondary-foreground: #aaaaaa;
  --muted: var(--bg-surface);
  --muted-foreground: var(--text-secondary);
  --destructive: var(--danger);
  --destructive-foreground: var(--text-primary);
  --border: rgba(255, 255, 255, 0.06);
  --input: var(--bg-card);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-hover: var(--bg-card-hover);
  --color-surface: var(--bg-surface);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary-dim: var(--primary-dim);
  --color-primary-border: var(--primary-border);
  --color-border-accent: var(--border-accent);
  --color-ring: var(--ring);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-danger: var(--danger);
  --color-danger-dim: var(--danger-dim);
  --color-danger-border: var(--danger-border);
  --color-warning: var(--warning);
  --color-warning-dim: var(--warning-dim);
  --color-warning-border: var(--warning-border);
  --color-destructive: var(--destructive);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-muted: var(--text-muted);
  --color-text-disabled: var(--text-disabled);
  --color-border: var(--border);
  --color-input: var(--input);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    color-scheme: dark;
  }
  body {
    @apply bg-background text-foreground font-mono;
  }
}

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
    color: var(--text-primary);
  }
  .text-meta {
    font-size: 0.625rem;
    color: var(--text-secondary);
  }
  .text-status-chip {
    font-size: 0.5rem;
    font-weight: 700;
    text-transform: uppercase;
  }
}
```

Dark mode class (`.dark`) is no longer needed — the app is dark-only. Any stray `dark:` prefixes in components MUST be deleted. `color-scheme: dark` is set on `<html>` so browser-native controls (scrollbars, autofill) match.

---

## Deferred Items (Next Iteration)

The following are out of scope for this redesign and are tracked in `docs/raw-requirements/002-ui-redesign/002-follow-up-of-design.md`. Each requires either a design decision, a follow-up implementation task, or an explicit "won't fix".

**High priority (next sprint):**
1. Accessibility — `aria-expanded` / `aria-haspopup` / `role="menu"` + keyboard navigation on the `⋮` dropdown; dialog focus trap; `focus-visible:ring` on nav links and icon-only buttons. Consider adopting Radix `DropdownMenu` and Radix `Dialog`.
2. Pointer-only hover isolation — ensure hover rules on vehicle cards and maintenance rows are wrapped in `@media (hover: hover)` so mobile Safari does not leave a sticky hover state after tap. Tailwind utility layer: `@media (hover: hover) and (pointer: fine)`.
3. AppShell loading flicker — render a skeleton shell width during `loading === true` so the layout does not shift when auth resolves.
4. Swipe-to-dismiss gesture on bottom-sheet dialogs (drag handle is already shipped as affordance).

**Medium priority (follow-up spec):**
5. Animation/transition system — page transitions, dialog enter/exit, dropdown open/close, progress-bar value animation, card status-change color animation.
6. Reusable `ProgressBar` component — extract from `MaintenanceCardRow` once a second consumer appears.
7. Progress-fill formula revalidation after real-world usage (current: linear, lookahead `5 × threshold`, no floor).
8. History and Profile features — design specs for their eventual content.

**Low priority (quality of life):**
9. Render Google user profile photo in sidebar avatar and fleet header (fallback to the current `User` icon).
10. Persist sort preference (Urgency / Name) to `localStorage` or user-preferences API.
11. Designed empty states — illustration + eyebrow + CTA for "No vehicles", "No maintenance cards", loading skeletons.
12. Overdue bar "100%+" visual treatment — currently text-only; revisit if users report it feels understated.
13. 320px-width smoke test for maintenance card header row — the progress bar label + `⋮` button combo may overflow on ultra-narrow devices. Add a manual browser check (or Playwright snapshot) at 320px and apply `min-w-0` / `truncate` if needed.

---

## Source Gap Analysis

This spec was revised on 2026-04-14 after a gap analysis captured in `docs/raw-requirements/002-ui-redesign/001-issues-to-fix.md` (blockers) and `docs/raw-requirements/002-ui-redesign/002-follow-up-of-design.md` (follow-ups). All blockers are folded into the sections above. All design decisions from the follow-up file that could be made now have been made and locked into this spec; the rest are listed under "Deferred Items" with explicit owners and priorities.
