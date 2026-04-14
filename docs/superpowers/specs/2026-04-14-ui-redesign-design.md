# UI Redesign — Design Spec

**Date:** 2026-04-14
**Status:** Approved

## Overview

Full visual redesign of the Maintenance Tracker frontend. The current UI is stock shadcn/ui on a white background with no visual identity. This spec defines a Dark Terminal aesthetic — inspired by crypto trading dashboards and AI developer tools — with a fully responsive, mobile-first layout strategy.

No backend changes. No new data. Pure frontend: CSS tokens, layout structure, and component styling.

---

## Design System

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#07090F` | Page background |
| `--bg-surface` | `#0D1117` | Navigation surfaces (sidebar, top bar) |
| `--bg-card` | `#0F1923` | Card / input backgrounds |
| `--bg-card-hover` | `#111D2B` | Card hover state (applies to vehicle cards and maintenance card rows on pointer devices) |
| `--accent` | `#00E5FF` | Primary interactive — buttons, active nav, links, focus rings |
| `--accent-dim` | `#00E5FF20` | Accent backgrounds (subtle tints) |
| `--accent-border` | `#00E5FF30` | Accent borders |
| `--danger` | `#FF4444` | Overdue status, destructive actions |
| `--danger-dim` | `#FF44440D` | Overdue card backgrounds |
| `--warning` | `#F59E0B` | Warning threshold status |
| `--warning-dim` | `#F59E0B0D` | Warning card backgrounds |
| `--text-primary` | `#FFFFFF` | Headings, card titles |
| `--text-secondary` | `#888888` | Labels, subtitles, eyebrow text |
| `--text-muted` | `#444444` | Inactive nav items, placeholder |
| `--border` | `#FFFFFF10` | Default card borders |
| `--border-accent` | `#00E5FF15` | Accent-tinted borders |

### Typography

| Role | Style |
|---|---|
| Page title | `font-size: 1.25rem`, `font-weight: 800`, white |
| Eyebrow / label | `font-size: 0.6rem`, `letter-spacing: 0.15em`, uppercase, `--text-secondary` |
| Card title | `font-size: 0.6875rem`, `font-weight: 700`, white |
| Body / meta | `font-size: 0.5rem–0.6875rem`, `--text-secondary` |
| Status chip | `font-size: 0.5rem`, `font-weight: 700`, uppercase |

`font-family: monospace` applied globally (or Geist Mono for the eyebrow / label tier).

### Component Tokens

**Primary button:** `background: #00E5FF`, `color: #07090F`, `font-weight: 800`, `border-radius: 10px`

**Secondary button:** `background: #0F1923`, `border: 1px solid #333`, `color: #AAAAAA`

**Ghost / add button:** `border: 1px dashed #00E5FF20`, `color: #00E5FF`, transparent background

**Input field:** `background: #07090F`, `border: 1px solid #00E5FF20`, focus ring `#00E5FF40`

**Progress bar track:** `background: #1A1A2E`, `height: 3px`, `border-radius: 2px`

**Progress bar fill — overdue:** `#FF4444`, fills to 100% width (full bar, solid red — signals past-due regardless of km overage amount)

**Progress bar fill — warning:** gradient `#F59E0B60 → #F59E0B`

**Progress bar fill — healthy:** gradient `#00E5FF40 → #00E5FF`

---

## Responsive Layout Strategy

### Mobile (`< 768px`) — Primary target

- **Navigation:** Fixed bottom tab bar, `height: 48px`, `background: #0D1117`, `border-top: 1px solid #00E5FF15`
  - Three tabs: Fleet (icon + label), History (icon + label), Profile (avatar)
  - Active tab: cyan dot indicator above icon + cyan icon/label tint
  - Inactive tab: muted icon + `#444` label
- **Fleet Home:** Single-column vehicle card list, full-width
- **Vehicle Detail:** Full-screen page, back arrow (`←`) + "FLEET" label in top-left, inline Edit/Delete buttons top-right
- **Page transitions:** Standard push navigation (back arrow returns to fleet)

### Tablet (`768px – 1279px`)

- **Navigation:** Icon-only sidebar, `width: 52px`, `background: #0D1117`, `border-right: 1px solid #00E5FF12`
  - Each item: icon + small label below, vertical stack
  - Active item: `background: #00E5FF12`, `border-radius: 6px`, cyan icon/label
  - Bottom tab bar hidden at this breakpoint
- **Fleet Home:** 2-column vehicle card grid (`grid-template-columns: 1fr 1fr`)
- **Vehicle Detail:** Single content panel (same structure as mobile, wider cards)

### Desktop (`≥ 1280px`)

- **Navigation:** Full sidebar, `width: 140px`, `background: #0D1117`
  - Logo mark + "MTRACK" eyebrow text at top
  - Nav items: icon + text label side by side, full-width rows
  - Active: `background: #00E5FF12`, `border-radius: 6px`, cyan text
  - User avatar + name at bottom
- **Fleet Home:** 3-column vehicle card grid (`grid-template-columns: 1fr 1fr 1fr`)
- **Vehicle Detail:** Split pane layout
  - Left panel (`width: ~220px`): scrollable vehicle list — all vehicles with name, mileage, status chip
  - Right panel (flex: 1): selected vehicle's full detail — header + mileage prompt + sort toggle + maintenance card list
  - Selected vehicle highlighted in left panel with accent border

---

## Screen Designs

### Login Page

- Full-screen dark canvas (`#07090F`)
- Vertically and horizontally centered content column
- Logo mark: `52×52px` container with `1px solid #00E5FF40` border, `border-radius: 16px`, subtle `#00E5FF12` background; inner `24×24px` gradient block (`#00E5FF → #0066FF`)
- Ambient glow: `radial-gradient(circle, #00E5FF12, transparent 70%)` centered behind logo
- Eyebrow: `"MAINTENANCE"` in cyan, `letter-spacing: 3px`
- Title: `"TRACKER"` in white, `font-size: 1.5rem`, `font-weight: 800`
- Subtitle: `"Vehicle maintenance, under control."` in `#444`
- Decorative divider: `80px` wide, gradient `transparent → #00E5FF30 → transparent`
- CTA: full-width Primary button `"SIGN IN WITH GOOGLE"`
- Terms text: `#333`, `font-size: 0.5rem`

### Fleet Home Page

**Header section** (`background: linear-gradient(180deg, #0D1117, #07090F)`):
- Logo mark (left) + user avatar circle (right)
- Eyebrow: `"FLEET OVERVIEW"` in `--text-secondary`
- Page title: `"Your Vehicles"` in white, `font-weight: 800`
- Alert pill (when warnings exist): `background: #FF44440D`, `border: 1px solid #FF444330`, `border-radius: 20px`, red dot + `"N ITEMS NEED ATTENTION"` in red — hidden when all clear

**Vehicle card list / grid** (below header, padding `0 10px`):
- Card: `background: #0F1923`, `border-radius: 10px`, `padding: 11px`
- Border: `1px solid #FF444328` when overdue cards present, else `1px solid #00E5FF15`
- Left: vehicle name (`font-weight: 700`) + `"Colour · Mileage km"` in `--text-secondary`
- Right: status badge chip + `"→"` chevron
- Status chips: `background: #FF444418`, `color: #FF4444`, `border: 1px solid #FF444440` for overdue; `background: #00E5FF10`, `color: #00E5FF`, `border: 1px solid #00E5FF25` for all-good
- Add vehicle: dashed ghost button (`border: 1px dashed #00E5FF20`), full width

### Vehicle Detail Page

**Header** (`background: linear-gradient(180deg, #0D1117, #07090F)`, `padding: 10px 12px 8px`):
- Back navigation: `"← FLEET"` in cyan arrow + muted label (mobile/tablet), or vehicle list panel (desktop)
- Vehicle name: white, `font-weight: 800`
- Meta: `"Colour · Mileage km · Plate: XXX"` in `--text-muted`
- Edit button: secondary style; Delete button: secondary style with `color: #FF4444`, `border: 1px solid #FF444330`

**Mileage update prompt** (shown when due for update):
- Container: `background: #0F1923`, `border: 1px solid #00E5FF20`, `border-radius: 8px`, `padding: 8px`, `margin: 0 10px 6px`
- Eyebrow: `"UPDATE ODOMETER"` in cyan, `font-weight: 700`
- Row: flex input field + cyan "OK" primary button

**Sort toggle** (`margin: 0 10px 6px`):
- Two buttons side by side (Urgency / Name)
- Active: Primary button style; Inactive: Secondary button style

**Add card button:** Full-width ghost button `"+ ADD MAINTENANCE CARD"` with dashed cyan border

**Maintenance card list** (`padding: 0 10px`, `gap: 5px`):

Each card:
- Container background + border vary by status (see below)
- `border-radius: 8px`, `padding: 9px`
- Top row: card name (`font-weight: 700`, white) on left; status label + `⋮` action button on right
- Type badge below name: `background: #0F1923`, `border: 1px solid #333`, `color: #555`, `font-size: 6px`, `padding: 1px 4px`
- Progress bar: `height: 3px`, `margin: 5px 0 2px`, track `#1A1A2E`
- Sub-label: km remaining or status text below bar

Status variants:

| Status | Card bg | Card border | Bar fill | Label color |
|---|---|---|---|---|
| Overdue | `#FF44440A` | `#FF444328` | `#FF4444` (100%+) | `#FF4444` |
| Warning | `#0F1923` | `#F59E0B28` | `#F59E0B60→#F59E0B` (near 100%) | `#F59E0B` |
| Healthy | `#0F1923` | `#00E5FF15` | `#00E5FF40→#00E5FF` (proportional) | `#00E5FF` / `#555` |

**`⋮` action button:** `width: 16px`, `height: 16px`, `background: #0F1923`, `border: 1px solid #333`, `border-radius: 4px`, `color: #555` — opens existing dropdown (Mark Done / Edit / Delete)

---

## Implementation Scope

### In scope

1. Update `globals.css` — replace all shadcn default tokens with the new dark palette
2. Wrap app in a responsive shell component (`AppShell`) that renders:
   - Bottom tab bar on mobile
   - Icon sidebar on tablet
   - Full sidebar on desktop
3. Restyle `LoginPage` — new centered layout, logo mark, glow effect, cyan CTA
4. Restyle `HomePage` — header section with gradient, alert pill, vehicle grid
5. Restyle `VehicleCard` — dark card with status badge, chevron
6. Restyle `VehicleDashboardPage` — header, sort toggle, mileage prompt, card list
7. Restyle `MaintenanceCardRow` — add progress bar, restyle action button, status variants
8. Restyle `MileagePromptPresentation` — dark input, cyan OK button
9. Restyle all dialogs (`dialog.tsx`, form dialogs) — dark surface, cyan primary buttons
10. Restyle `Button` component — map variants to new tokens

### Out of scope

- No new pages or routes
- No new data fields or API changes
- No new features (History tab and Profile tab in nav are visual placeholders only — no routing needed yet)
- No animation/transition system (can be added in a follow-up)

---

## Tailwind / CSS Token Mapping

The current `globals.css` uses shadcn OKLCH tokens. Replace with the new palette:

```css
:root {
  --background: #07090F;
  --foreground: #FFFFFF;
  --card: #0F1923;
  --card-foreground: #FFFFFF;
  --primary: #00E5FF;
  --primary-foreground: #07090F;
  --secondary: #0F1923;
  --secondary-foreground: #AAAAAA;
  --muted: #0D1117;
  --muted-foreground: #888888;
  --border: rgba(255,255,255,0.06);
  --input: #0F1923;
  --ring: #00E5FF40;
  --destructive: #FF4444;
  --destructive-foreground: #FFFFFF;
  --radius: 0.625rem;
}
```

Dark mode class (`.dark`) is no longer needed — the app is dark-only.
