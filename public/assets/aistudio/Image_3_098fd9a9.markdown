---
name: Emergent Dark B2B
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#adc6ff'
  on-tertiary: '#002e6a'
  tertiary-container: '#4d8eff'
  on-tertiary-container: '#00285d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes a refined, high-performance aesthetic tailored for enterprise-grade B2B SaaS CRM environments. The visual language bridges intense data density with calm authority, evoking precision, absolute reliability, and executive clarity. 

### Brand Personality & Target Audience
- **Audience:** Enterprise sales teams, operations executives, and revenue leaders who spend hours inside data-heavy workspaces.
- **Personality:** Analytical, dependable, sleek, and uncompromisingly modern.
- **Emotional Response:** Control, confidence, and effortless oversight. Users should feel empowered to navigate complex pipelines without visual fatigue.

### Design Style: Dark Modern Corporate
The system utilizes a specialized variant of modern minimalism optimized for deep-focus environments. It relies on deep slate-navy surfaces, crisp high-legibility typography, subtle luminous borders, and intentional accents of vibrant indigo and emerald to draw immediate focus to key metrics and vital pipeline statuses.

## Colors

The palette is engineered specifically for dark-mode data consumption, minimizing eye strain during extended operational sessions while maximizing contrast for rapid visual scanning.

### Palette Architecture
- **Primary (`#6366F1`):** Vibrant indigo used for primary interactive states, active navigation items, and focal conversion actions.
- **Secondary (`#10B981`):** Emerald green dedicated to positive performance metrics, closed-won deal badges, and active operational states.
- **Tertiary (`#3B82F6`):** Electric blue deployed for secondary actions, informational tooltips, and contextual data highlights.
- **Neutrals (`#0F172A` to `#F8FAFC`):** A sophisticated stepped ramp of slate and cool grays forming the foundation for deep backgrounds, elevated surface containers, and razor-sharp typographic hierarchies.

## Typography

The typographic hierarchy relies on the utilitarian precision of Inter to deliver exceptional legibility across dense data tables, metric dashboards, and compact form controls.

### Hierarchy & Scaling
- Headings use tighter tracking (`-0.01em` to `-0.02em`) to maintain an authoritative, compact stance on desktop viewports.
- Body sizes are locked at 14px for standard data density, stepping down to 13px for secondary table metadata and tooltips.
- Labels enforce strict capitalization rules for metadata tags (`label-sm`), utilizing widened letter spacing to ensure scannability at small sizes.

## Layout & Spacing

The layout model uses a 12-column fluid grid paired with a consistent 8pt geometric spacing rhythm, optimized for split-pane CRM layouts and expansive dashboard canvases.

### Layout Rules
- **Desktop:** Fixed sidebar navigation paired with a fluid main workspace. Outer canvas margins default to `2rem` with a standard `1.5rem` gutter between CRM card modules.
- **Tablet & Mobile:** Automatically collapse sidebar navigation into an off-canvas drawer. Stack multi-column data views into single-column vertical streams while preserving component padding (`space-md`).

## Elevation & Depth

Depth is established through low-contrast outlines and tonal surface layering rather than heavy drop shadows, preserving the crisp, professional character of the dark theme.

### Surface Tiers
- **Base Canvas (`#0F172A`):** The deepest background layer for the application window.
- **Surface Containers (`#1E293B`):** Elevated cards, modals, and navigation bars sit one tier above the base.
- **Ghost Borders:** Elements are separated by ultra-subtle 1px borders (`#334155` at 40% opacity) to delineate interactive boundaries cleanly without introducing visual noise.

## Shapes

The shape language uses a soft, contained geometry (`roundedness` level 1) to balance modern software ergonomics with professional software restraint.

### Implementation Guidelines
- Base elements (inputs, standard buttons, small tags) feature a `0.25rem` radius.
- Cards, modals, and container panels utilize `0.5rem` (`rounded-lg`) to soften large architectural boundaries.
- Pill shapes are strictly reserved for status indicators, counter badges, and avatar frames.

## Components

Components are designed for high-frequency data entry and rapid scanning. Every interactive element provides immediate, high-contrast feedback states.

### Buttons
- **Primary:** Filled with vibrant indigo (`#6366F1`), crisp white text, and a subtle upward shadow or border glow on hover.
- **Secondary:** Surface container background with a 1px ghost border, shifting to a lighter slate background on hover.
- **Destructive:** Deep slate base paired with a high-visibility crimson text/border combination for critical actions like deleting records.

### Chips & Status Badges
- Utilize pill shapes with low-opacity background tints matching their semantic color (e.g., emerald tint for "Closed Won", indigo tint for "In Progress"). Text uses `label-sm` tracking.

### Input Fields
- Rendered with a solid dark slate background (`#1E293B`), a subtle 1px border, and clear floating or top-aligned labels. Focus states instantly swap the border to primary indigo with a soft glow ring.

### Cards & Metrics Modules
- Constructed on surface container tiers with thin ghost borders. Metric cards prominently feature large `headline-lg` figures paired with tiny positive/negative emerald or coral trend indicators in the top right corner.

### Additional CRM Essentials
- **Data Tables:** Dense row spacing with alternating subtle row shading, fixed header columns, and inline action menus.
- **Pipeline Kanban Boards:** Vertical column containers holding draggable deal cards with persistent value summaries in the column headers.