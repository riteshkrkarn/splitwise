# Design System

## Visual Theme

Quiet ledger desk — precise ink on pure white, a rose seal for primary actions, cool slate for secondary state. Restrained product strategy: surfaces stay neutral; trust comes from typography, spacing, and accurate money presentation.

## Color

All tokens in OKLCH. Light default; dark via `.dark`.

| Role | Light | Dark | Use |
|---|---|---|---|
| bg | `oklch(1 0 0)` | `oklch(0.12 0 0)` | App canvas |
| surface | `oklch(0.985 0.004 357)` | `oklch(0.18 0.01 357)` | Panels, sheets |
| ink | `oklch(0.22 0.02 357)` | `oklch(0.95 0.01 357)` | Body / titles |
| muted | `oklch(0.48 0.015 357)` | `oklch(0.68 0.01 357)` | Secondary text |
| primary | `oklch(0.48 0.17 357)` | `oklch(0.68 0.15 357)` | CTAs, focus, brand mark |
| accent | `oklch(0.42 0.09 230)` | `oklch(0.72 0.08 230)` | Links, info, owed-you |
| danger | `oklch(0.50 0.18 25)` | `oklch(0.68 0.16 25)` | You owe / destructive |
| border | `oklch(0.90 0.01 357)` | `oklch(0.28 0.01 357)` | Hairlines |
| ring | primary | primary | Focus |

Text on primary / danger fills: near-white.

Semantic money:
- **owed to you** → accent
- **you owe** → danger  
- **settled** → muted

## Typography

Single family: **DM Sans** (product register — one well-tuned sans).

Scale (rem, ~1.2 ratio):
- xs 0.75 / sm 0.875 / base 1 / lg 1.125 / xl 1.25 / 2xl 1.5 / 3xl 1.875

Money amounts: `font-variant-numeric: tabular-nums`, semibold.

## Components

- Radius: controls `0.75rem`, panels `1rem`
- Buttons: solid primary, quiet secondary, ghost icon tools
- Forms: 44px min height, visible focus ring
- Lists over card grids when possible; cards only for group tiles / interactive containers
- Empty states teach the next action

## Layout

- Max content width: 64rem
- Page padding: 1rem → 1.5rem
- Section gap: 1.5–2rem
- Sticky top nav; no decorative gradients behind the product chrome

## Motion

- 150–200ms ease-out for hover/focus/open
- `prefers-reduced-motion: reduce` → instant or opacity-only
- No page-load choreography
