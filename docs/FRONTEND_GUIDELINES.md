# FRONTEND_GUIDELINES.md

- Project: Formative CRM
- Style: Modern, Minimal, Professional
- Target Audience: Real estate agents and small teams managing inbound property leads

This design system keeps the CRM clean, calm, and focused. No visual noise. No flashy gradients. Everything exists to support clarity and speed.

## 1. Design Principles

1. Clarity First
   - Every screen must answer:
     - Who is this lead?
     - What is their intent?
     - What action should I take?
   - No decorative elements without purpose.
2. Calm Professionalism
   - Muted tones, structured spacing, and clear hierarchy.
3. Speed Over Decoration
   - Animations are subtle.
   - UI should feel fast.
4. Consistency Everywhere
   - Spacing, colors, states, and feedback behave identically across components.
5. Accessible by Default
   - WCAG AA minimum, no exceptions.

## 2. Design Tokens

### Color Palette

#### Primary Blue (Brand)

Used for primary actions and focus states.

- `50`  `#EFF6FF`
- `100` `#DBEAFE`
- `200` `#BFDBFE`
- `300` `#93C5FD`
- `400` `#60A5FA`
- `500` `#3B82F6`
- `600` `#2563EB`
- `700` `#1D4ED8`
- `800` `#1E40AF`
- `900` `#1E3A8A`

Usage:
- `600`: Primary buttons
- `700`: Hover
- `100`: Subtle background highlight
- `50`: Section background tint

#### Neutral Gray

Used for text, borders, and backgrounds.

- `50`  `#F9FAFB`
- `100` `#F3F4F6`
- `200` `#E5E7EB`
- `300` `#D1D5DB`
- `400` `#9CA3AF`
- `500` `#6B7280`
- `600` `#4B5563`
- `700` `#374151`
- `800` `#1F2937`
- `900` `#111827`

Usage:
- `900`: Headings
- `700`: Body text
- `400`: Placeholder
- `200`: Borders
- `50`: Page background

#### Semantic Colors

Success:
- Base: `#16A34A`
- Light: `#DCFCE7`

Warning:
- Base: `#F59E0B`
- Light: `#FEF3C7`

Error:
- Base: `#DC2626`
- Light: `#FEE2E2`

Info:
- Base: `#2563EB`
- Light: `#DBEAFE`

Usage:
- Use light background plus dark base text for alerts.
- Never use semantic colors for structural UI.

### Typography

#### Font Families

Primary:
- `Inter, ui-sans-serif, system-ui`

Monospace:
- `JetBrains Mono, monospace`

#### Font Sizes

- `xs`: `0.75rem` (12px)
- `sm`: `0.875rem` (14px)
- `base`: `1rem` (16px)
- `lg`: `1.125rem` (18px)
- `xl`: `1.25rem` (20px)
- `2xl`: `1.5rem` (24px)
- `3xl`: `1.875rem` (30px)
- `4xl`: `2.25rem` (36px)

Usage:
- `4xl`: Page titles
- `2xl`: Section headers
- `base`: Body
- `sm`: Labels
- `xs`: Helper text

#### Font Weights

- `400`: Regular
- `500`: Medium
- `600`: Semibold
- `700`: Bold

#### Line Heights

- `tight`: `1.25`
- `normal`: `1.5`
- `relaxed`: `1.75`

### Spacing Scale

- `0`: `0px`
- `1`: `4px`
- `2`: `8px`
- `3`: `12px`
- `4`: `16px`
- `5`: `20px`
- `6`: `24px`
- `8`: `32px`
- `10`: `40px`
- `12`: `48px`
- `16`: `64px`

Rules:
- Card padding: `6`
- Section spacing: `12`
- Input vertical spacing: `4`
- Button vertical padding: `2` or `3`

### Border Radius

- `none`: `0`
- `sm`: `0.125rem`
- `base`: `0.25rem`
- `md`: `0.375rem`
- `lg`: `0.5rem`
- `xl`: `0.75rem`
- `full`: `9999px`

Use `lg` for cards and buttons.

### Shadows

- `sm`: `0 1px 2px rgba(0,0,0,0.05)`
- `base`: `0 1px 3px rgba(0,0,0,0.1)`
- `md`: `0 4px 6px rgba(0,0,0,0.1)`
- `lg`: `0 10px 15px rgba(0,0,0,0.15)`
- `xl`: `0 20px 25px rgba(0,0,0,0.2)`

## 3. Layout System

### Grid System

- Max width: `1280px`
- Columns: `12`
- Gutter: `24px`

Container:

```tsx
<div className="max-w-screen-xl mx-auto px-6">
```

### Breakpoints

- `sm`: `640px`
- `md`: `768px`
- `lg`: `1024px`
- `xl`: `1280px`

Mobile-first always.

### Common Layouts

#### Centered Content

```tsx
<div className="min-h-screen flex items-center justify-center bg-gray-50">
  <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
    Content
  </div>
</div>
```

#### Sidebar Layout

```tsx
<div className="flex min-h-screen">
  <aside className="w-64 bg-gray-900 text-white p-6">
    Sidebar
  </aside>
  <main className="flex-1 p-8 bg-gray-50">
    Content
  </main>
</div>
```

## 4. Component Library

### Buttons

Variants:

Primary:

```tsx
<button className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
  Save
</button>
```

Secondary:

```tsx
<button className="px-4 py-2 text-sm font-medium text-gray-900 bg-gray-200 rounded-lg hover:bg-gray-300 focus:ring-2 focus:ring-blue-500">
  Cancel
</button>
```

Danger:

```tsx
<button className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500">
  Delete
</button>
```

States:
- Hover darkens.
- Focus shows 2px ring.
- Disabled reduces opacity.

### Input Fields

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">Email</label>
  <input
    type="email"
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
    placeholder="john@example.com"
  />
  <p className="text-xs text-gray-500">We'll never share your email.</p>
</div>
```

Error state:

```tsx
<input className="border-red-500 focus:ring-red-500" />
<p className="text-xs text-red-600">Invalid email address</p>
```

### Cards

```tsx
<div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
  <h3 className="text-lg font-semibold text-gray-900">Lead Name</h3>
  <p className="text-sm text-gray-600">Warm Lead</p>
</div>
```

### Modal

```tsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
  <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
    Modal Content
  </div>
</div>
```

Requirements:
- Focus trap required.
- Escape key closes modal.

### Alerts

Success:

```tsx
<div className="p-4 bg-green-100 text-green-800 rounded-lg">
  Email sent successfully.
</div>
```

Error:

```tsx
<div className="p-4 bg-red-100 text-red-800 rounded-lg">
  Something went wrong.
</div>
```

### Navigation

Active link:

```tsx
<a className="text-blue-600 font-medium border-b-2 border-blue-600">
```

Inactive link:

```tsx
<a className="text-gray-600 hover:text-gray-900">
```

### Loading States

Spinner:

```tsx
<div className="animate-spin rounded-full h-6 w-6 border-4 border-blue-600 border-t-transparent"></div>
```

Skeleton:

```tsx
<div className="animate-pulse bg-gray-200 h-4 rounded w-3/4"></div>
```

### Empty State

```tsx
<div className="text-center py-16">
  <p className="text-gray-600">No leads yet</p>
  <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
    Refresh
  </button>
</div>
```

## 5. Accessibility

- WCAG AA target.
- Minimum `4.5:1` contrast.
- All inputs must have labels.
- Buttons must be keyboard-focusable.
- Visible 2px focus ring.
- `aria-live` for alerts.

## 6. Animation Guidelines

- Default duration: `200ms`
- Easing: `ease-in-out`
- Animate `opacity` and `transform` only.
- Respect `prefers-reduced-motion`.

## 7. Icon System

- Library: Lucide React
- Sizes:
  - `16px` inline
  - `20px` in buttons
  - `24px` in headers
- Stroke width: `2`

Example:

```tsx
import { Mail } from "lucide-react";

<Mail className="w-5 h-5 text-gray-600" />;
```

## 8. Responsive Rules

- Mobile-first.
- Touch targets minimum `44x44px`.
- Typography scales at `md` breakpoint.
- Sidebar collapses below `lg`.

## 9. Performance

- Use Next.js `Image` component.
- Dynamic import heavy pages.
- Lazy load modals.
- Avoid unnecessary re-renders.

## 10. Browser Support

- Last 2 versions of Chrome
- Last 2 versions of Safari
- Last 2 versions of Edge
- Latest Firefox

Graceful degradation required if animations are unsupported.
