# Design System — Tenol

Source of truth for the Tenol design language. All color values, spacing conventions, component APIs, and visual effects are documented here. When in doubt, this file wins.

---

## Brand

- **Name:** 테놀 (Tenol)
- **Tagline:** 테니스 치며 놀자
- **Aesthetic:** Premium dark, sports-tech, neon green on black
- **Language:** Korean (lang="ko"), word-break: keep-all
- **Theme color:** `#0A0A0A` (used in PWA manifest and viewport meta)

---

## Color Tokens

### Primary Palette

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#00E676` | Brand green. Buttons, active indicators, accent borders, links |
| `--color-primary-light` | `#69F0AE` | Hover state for primary buttons, gradient endpoint |
| `--color-primary-dark` | `#00C853` | Active/pressed state for primary buttons |
| `--color-primary-dim` | `rgba(0, 230, 118, 0.12)` | Subtle green tint for hover backgrounds (outline button hover) |
| `--color-accent` | `#00E676` | Alias for primary, used interchangeably |

### Surfaces

| Token | Value | Usage |
|---|---|---|
| `--color-background` | `#0A0A0A` | Page background, html/body |
| `--color-foreground` | `#F5F5F5` | Primary text color |
| `--color-surface` | `#141414` | Card backgrounds, elevated sections |
| `--color-surface-elevated` | `#1C1C1C` | Ghost button hover, avatar fallback bg, skeleton base |
| `--color-surface-hover` | `#222222` | Secondary button hover state |

### Text

| Token | Value | Usage |
|---|---|---|
| `--color-muted` | `#1A1A1A` | Input background, default badge background |
| `--color-muted-foreground` | `#8A8A8A` | Secondary text, labels, placeholders for labels |
| `--color-subtle` | `#5A5A5A` | Input placeholder text |

### Borders

| Token | Value | Usage |
|---|---|---|
| `--color-border` | `#2A2A2A` | Default borders on cards, inputs, dividers |
| `--color-border-light` | `#1F1F1F` | Lighter border variant |

### Cards

| Token | Value | Usage |
|---|---|---|
| `--color-card` | `#141414` | Card background (matches surface) |
| `--color-card-foreground` | `#F5F5F5` | Card text (matches foreground) |

### Semantic Colors

| Token | Value | Usage |
|---|---|---|
| `--color-destructive` | `#FF5252` | Error states, destructive actions, delete buttons |
| `--color-success` | `#00E676` | Success toasts, success badges (same as primary) |
| `--color-warning` | `#FFD740` | Warning toasts, warning badges |
| `--color-info` | `#40C4FF` | Info toasts, informational badges |

### Selection

- `::selection` background: `rgba(0, 230, 118, 0.3)` with white text

---

## Typography

### Font Family

- **Primary:** Pretendard Variable (loaded via CDN, dynamic subset)
- **Fallback stack:** Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif
- **CSS tokens:** `--font-sans` and `--font-display` (identical stack)
- **CDN:** `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css`

### Font Rendering

- `-webkit-font-smoothing: antialiased`
- `-moz-osx-font-smoothing: grayscale`

### Weights

| Weight | Tailwind class | Usage |
|---|---|---|
| 400 (regular) | default | Body text |
| 500 (medium) | `font-medium` | Tabs, badges, labels, input labels, toast messages |
| 600 (semibold) | `font-semibold` | Primary button text, card titles, modal titles, avatar fallback |

### Sizes

| Tailwind class | Approximate px | Usage |
|---|---|---|
| `text-xs` | 12px | Badge text, sm avatar fallback |
| `text-sm` | 14px | Small button, input labels, card descriptions, tab labels, error text, toast text |
| `text-base` | 16px | Medium button text, lg avatar fallback |
| `text-lg` | 18px | Large button text, card titles (`CardTitle`), modal titles, xl avatar fallback |

---

## Spacing

Based on Tailwind's 4px grid.

### Common Patterns

| Pattern | Value | Where used |
|---|---|---|
| `px-4` | 16px | Input horizontal padding, toast padding |
| `px-5` | 20px | Medium button padding, modal header/content padding |
| `px-6` | 24px | Large button padding, large card padding |
| `px-3.5` | 14px | Small button padding |
| `px-2.5` | 10px | Badge horizontal padding |
| `py-0.5` | 2px | Badge vertical padding |
| `py-3` | 12px | Tab button padding, small card padding |
| `py-4` | 16px | Modal header vertical padding |
| `p-3` | 12px | Card padding (sm) |
| `p-4` | 16px | Card padding (md, default) |
| `p-5` | 20px | Modal content padding |
| `p-6` | 24px | Card padding (lg) |
| `gap-1.5` | 6px | Small button content gap |
| `gap-2` | 8px | Medium button content gap, button children gap |
| `gap-2.5` | 10px | Large button content gap |
| `gap-3` | 12px | Toast icon-to-text gap |
| `mb-1.5` | 6px | Input label bottom margin |
| `mb-3` | 12px | Card header bottom margin |
| `mt-1.5` | 6px | Input error message top margin |
| `mt-4` | 16px | Tab content top margin |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `8px` | General small rounding |
| `--radius-md` | `12px` | General medium rounding |
| `--radius-lg` | `16px` | General large rounding |
| `--radius-xl` | `20px` | General extra-large rounding |
| `--radius-full` | `9999px` | Pill shapes, badges, avatar, tab indicator |

### Component-Specific Radius

| Tailwind class | Value | Component |
|---|---|---|
| `rounded-xl` | 12px | Buttons, inputs, toasts, skeletons |
| `rounded-2xl` | 16px | Cards, modal panel |
| `rounded-t-2xl` | 16px (top only) | Modal bottom-sheet on mobile |
| `rounded-full` | 9999px | Badges, avatar, modal close button, tab sliding indicator |
| Scrollbar thumb | 4px | Custom scrollbar |

---

## Components

### Button

**File:** `src/components/ui/button.tsx`

| Prop | Type | Default |
|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'destructive'` | `'primary'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` |
| `fullWidth` | `boolean` | `false` |
| `loading` | `boolean` | `false` |

**Variants:**

| Variant | Background | Text | Border | Hover | Active |
|---|---|---|---|---|---|
| `primary` | `bg-primary` (#00E676) | Black | None | `bg-primary-light` + glow shadow | `bg-primary-dark` |
| `secondary` | `bg-surface-elevated` (#1C1C1C) | Foreground | `border-border` | `bg-surface-hover` + green border hint | -- |
| `outline` | Transparent | Foreground | `border-border` | Green border + `bg-primary-dim` | -- |
| `ghost` | Transparent | Muted foreground | None | `bg-surface-elevated` + foreground text | -- |
| `destructive` | `bg-destructive/10` | Destructive red | `border-destructive/20` | `bg-destructive/20` + stronger border | -- |

**Sizes:**

| Size | Height | Horizontal padding | Font size | Gap |
|---|---|---|---|---|
| `sm` | 36px (`h-9`) | 14px (`px-3.5`) | 14px (`text-sm`) | 6px |
| `md` | 44px (`h-11`) | 20px (`px-5`) | 16px (`text-base`) | 8px |
| `lg` | 52px (`h-13`) | 24px (`px-6`) | 18px (`text-lg`) | 10px |

**States:**
- Focus: `ring-2 ring-primary/50 ring-offset-2 ring-offset-background`
- Disabled: `opacity-40`, pointer-events-none
- Active: `scale-[0.97]` press effect
- Loading: Loader2 spinner (lucide-react), children become invisible

### Card

**File:** `src/components/ui/card.tsx`

| Prop | Type | Default |
|---|---|---|
| `variant` | `'default' \| 'glass' \| 'glow'` | `'default'` |
| `padding` | `'sm' \| 'md' \| 'lg'` | `'md'` |

**Variants:**

| Variant | Background | Border | Hover |
|---|---|---|---|
| `default` | `bg-card` (#141414) | `border-border` (#2A2A2A) | Border shifts to `border-primary/15` |
| `glass` | `.glass` class (rgba(20,20,20,0.8) + blur) | `border-white/[0.06]` | -- |
| `glow` | `bg-card` (#141414) | `border-primary/15` + `glow-primary-sm` | Border to `border-primary/30` + stronger glow |

**Padding:**

| Size | Value |
|---|---|
| `sm` | 12px (`p-3`) |
| `md` | 16px (`p-4`) |
| `lg` | 24px (`p-6`) |

**Sub-components:** `CardHeader` (mb-3), `CardTitle` (text-lg font-semibold), `CardDescription` (text-sm text-muted-foreground)

### Badge

**File:** `src/components/ui/badge.tsx`

Base: `rounded-full px-2.5 py-0.5 text-xs font-medium border`

| Variant | Background | Text | Border |
|---|---|---|---|
| `default` | `bg-muted` (#1A1A1A) | `text-muted-foreground` (#8A8A8A) | `border-border` |
| `primary` | `bg-primary/10` | `text-primary` (#00E676) | `border-primary/20` |
| `success` | `bg-success/10` | `text-success` (#00E676) | `border-success/20` |
| `warning` | `bg-warning/10` | `text-warning` (#FFD740) | `border-warning/20` |
| `destructive` | `bg-destructive/10` | `text-destructive` (#FF5252) | `border-destructive/20` |
| `outline` | Transparent | `text-foreground` (#F5F5F5) | `border-border` |

### Avatar

**File:** `src/components/ui/avatar.tsx`

| Prop | Type | Default |
|---|---|---|
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` |
| `active` | `boolean` | `false` |
| `fallback` | `string` | -- |

**Sizes:**

| Size | Dimensions | Font size |
|---|---|---|
| `sm` | 32px (`w-8 h-8`) | 12px (`text-xs`) |
| `md` | 40px (`w-10 h-10`) | 14px (`text-sm`) |
| `lg` | 56px (`w-14 h-14`) | 16px (`text-base`) |
| `xl` | 80px (`w-20 h-20`) | 18px (`text-lg`) |

**Active state:** Green ring (`ring-primary ring-offset-background`) with size-dependent thickness (2px for sm/md, 3px for lg/xl).

**Fallback:** Gradient background `from-primary/15 to-primary-dark/25`, green text, first character of fallback or alt.

### Input

**File:** `src/components/ui/input.tsx`

| Prop | Type |
|---|---|
| `label` | `string` (optional) |
| `error` | `string` (optional) |

**States:**

| State | Styles |
|---|---|
| Default | `bg-muted` (#1A1A1A), `border-border` (#2A2A2A), height 44px (`h-11`), `rounded-xl` |
| Placeholder | `text-subtle` (#5A5A5A) |
| Hover | `border-border/80` |
| Focus | `ring-2 ring-primary/30 border-primary/50` |
| Error | `border-destructive/50`, focus ring `ring-destructive/30 border-destructive/60` |

**Label:** `text-sm font-medium text-muted-foreground`, 6px gap below (`mb-1.5`)
**Error message:** `text-sm text-destructive`, 6px gap above (`mt-1.5`)

### Modal

**File:** `src/components/ui/modal.tsx`

- **Backdrop:** `bg-black/60 backdrop-blur-sm`, 300ms opacity transition
- **Panel:** `.glass` + `border-white/[0.06]`, max-height 95vh (mobile) / 85vh (desktop)
- **Mobile:** Bottom-sheet style, `rounded-t-2xl`, slides up from bottom (`translate-y-8`)
- **Desktop (sm+):** Centered, `rounded-2xl`, max-width `28rem` (448px / `sm:max-w-md`), slides up from `translate-y-4`
- **Animation:** 300ms ease-out, opacity + translateY
- **Header:** `px-5 py-4 border-b border-border`, title as `text-lg font-semibold`
- **Close button:** `X` icon (lucide-react) at 20px, `rounded-full` with hover bg
- **Content:** `p-5`, overflow-y-auto with overscroll-contain
- **Body scroll lock:** Sets `body.style.overflow = 'hidden'` when open

### Tabs

**File:** `src/components/ui/tabs.tsx`

- **Tab buttons:** `flex-1 py-3 text-sm font-medium`, equal width distribution
- **Active tab:** `text-primary` (#00E676)
- **Inactive tab:** `text-muted-foreground`, hover `text-foreground`
- **Sliding indicator:** `h-0.5 bg-primary rounded-full` at bottom, 300ms ease-out transition on left/width
- **Content transition:** `animate-fade-in` on tab change (key-based remount)
- **Separator:** `border-b border-border` beneath tab row

### Toast

**File:** `src/components/ui/toast.tsx`

Base: `.glass border border-white/[0.06] rounded-xl`, left accent border 3px, shadow `0_8px_32px_rgba(0,0,0,0.4)`

| Variant | Left border | Icon | Icon color |
|---|---|---|---|
| `success` | `border-l-success` (#00E676) | `CheckCircle` | `text-success` |
| `error` | `border-l-destructive` (#FF5252) | `XCircle` | `text-destructive` |
| `warning` | `border-l-warning` (#FFD740) | `AlertTriangle` | `text-warning` |
| `info` | `border-l-primary` (#00E676) | `Info` | `text-primary` |

- **Size:** min-width 280px, max-width `calc(100vw - 2rem)`
- **Icon size:** 20px (`w-5 h-5`)
- **Default duration:** 3000ms
- **Animation:** 300ms ease-out, opacity + translateY(12px) + scale(0.95)
- **Dismiss:** X icon at 16px, manual or auto-dismiss

### Skeleton

**File:** `src/components/ui/skeleton.tsx`

- Base: `rounded-xl bg-surface-elevated` (#1C1C1C)
- Shimmer: linear-gradient overlay `rgba(255,255,255,0.04)` at 50%, 1.8s ease-in-out infinite
- Uses `shimmer` keyframe from globals.css

---

## Effects

### Glass Morphism

```css
.glass {
  background: rgba(20, 20, 20, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
```

Used on: modals, toasts, glass card variant, bottom navigation, top bar.

### Glow Effects

```css
.glow-primary {
  box-shadow: 0 0 20px rgba(0, 230, 118, 0.15),
              0 0 60px rgba(0, 230, 118, 0.05);
}

.glow-primary-sm {
  box-shadow: 0 0 10px rgba(0, 230, 118, 0.1);
}
```

`glow-primary` for prominent elements, `glow-primary-sm` for the glow card variant.

### Gradient Text

```css
.text-gradient {
  background: linear-gradient(135deg, #00E676 0%, #69F0AE 50%, #00E676 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

Animates green-to-light-green-to-green at 135 degrees. Used for hero headings and emphasis text.

---

## Animations

### Keyframes

| Name | From | To | Duration |
|---|---|---|---|
| `fadeIn` | opacity: 0, translateY(8px) | opacity: 1, translateY(0) | 0.4s ease-out |
| `slideUp` | opacity: 0, translateY(100%) | opacity: 1, translateY(0) | 0.3s ease-out |
| `pulse-glow` | box-shadow 8px/0.2 alpha | box-shadow 20px/0.4 alpha | loops, ease |
| `shimmer` | background-position: -200% 0 | background-position: 200% 0 | 1.8s ease-in-out infinite |

### Utility Classes

| Class | Animation | Usage |
|---|---|---|
| `.animate-fade-in` | fadeIn 0.4s ease-out forwards | General entrance, tab content transitions |
| `.animate-slide-up` | slideUp 0.3s ease-out forwards | Bottom-sheet modals, popups |

### Stagger

```css
.stagger > * {
  opacity: 0;
  animation: fadeIn 0.4s ease-out forwards;
}
.stagger > *:nth-child(1) { animation-delay: 0.05s; }
.stagger > *:nth-child(2) { animation-delay: 0.1s; }
/* ... up to 8th child at 0.4s */
```

Each child fades in with a 50ms stagger. Supports up to 8 children. Apply `.stagger` to a parent container.

### Component-Level Animations

- **Button press:** `active:scale-[0.97]`, 200ms ease-out transition
- **Modal enter/exit:** 300ms ease-out, opacity + translateY
- **Toast enter/exit:** 300ms ease-out, opacity + translateY(12px) + scale(0.95 to 1)
- **Tabs indicator:** 300ms ease-out transition on `left` and `width` properties
- **Avatar image load:** 300ms opacity transition

---

## Layout Patterns

### Mobile-First Container

- Viewport: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=false, viewport-fit=cover`
- html: `h-full bg-background`, lang="ko"
- body: `min-h-full flex flex-col bg-background text-foreground font-sans antialiased`

### Safe Areas

```css
.safe-bottom {
  padding-bottom: max(env(safe-area-inset-bottom), 16px);
}
.safe-top {
  padding-top: max(env(safe-area-inset-top), 0px);
}
```

Applied to bottom navigation and top bar for notch/home-indicator devices.

### Floating Glass Bottom Navigation

- Position: fixed bottom
- Style: `.glass` + `border-t border-white/[0.06]`
- Safe area: `.safe-bottom`

### Glass Top Bar

- Backdrop blur via `.glass`
- Safe area: `.safe-top`

### Scrollbar

- Width: 4px
- Track: transparent
- Thumb: `var(--color-border)` (#2A2A2A), border-radius 4px
- `.scrollbar-hide` utility: hides scrollbar completely (webkit + Firefox)

### PWA

- Apple web app capable, status bar style: black-translucent
- Manifest at `/manifest.json`
- Service worker registration
- Install prompt component

---

## Icons

- **Library:** lucide-react
- **UI icons:** 16-20px (`w-4 h-4` to `w-5 h-5`)
- **Toast icons:** 20px (`w-5 h-5`)
- **Modal close:** 20px (`w-5 h-5`), X icon
- **Button loading:** 16px (`w-4 h-4`), Loader2 with `animate-spin`
- **Accent color:** Icons in feature contexts use `text-primary` (#00E676)
- **Muted icons:** `text-muted-foreground` (#8A8A8A) for secondary actions

---

## Interaction Conventions

- `-webkit-tap-highlight-color: transparent` globally (no blue flash on mobile tap)
- All interactive elements use `cursor-pointer`
- Transitions default to 200ms for micro-interactions, 300ms for layout/modal transitions
- Focus rings use primary green at 50% opacity with background-colored offset
- Disabled state: 40% opacity, no pointer events
