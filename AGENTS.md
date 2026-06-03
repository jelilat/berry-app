# Agent Context

This repo is for `app.berry.studio`, the product app for `berry.`.

## What Berry Is

Berry is an open-source AI agent for hardware development. It helps builders move from idea to working hardware with AI-guided wiring, code generation, debugging, and deployment support.

Think of Berry as an AI hardware workbench: it understands parts, circuits, firmware, logs, and deployment steps.

## Product Positioning

- Use the name as `berry.` with the trailing period.
- Primary tagline: `Open-source AI agent for hardware development.`
- Main description: `Go from idea to working hardware in minutes with AI-guided wiring, code, debugging, and deployment support.`
- Target users include hardware founders, makers, students, and engineers prototyping connected devices.
- Avoid generic SaaS framing. Berry should feel like a precise, helpful hardware bench with an AI collaborator.

## Brand System

- Primary berry: `#D6336C`
- Berry hover: `#C2255C`
- Berry deep: `#A61E4D`
- Berry soft: `#F05F8D`
- Leaf accent: `#0FA886`
- Leaf light: `#52D6C3`
- Warm light base: `#F5F3EF`
- Warm overlay: `#EBE7DF`
- Dark base: `#0C0C0F`
- Dark surface: `#111115`
- Dark elevated: `#17171D`

Use gradients sparingly:

```css
linear-gradient(135deg, #F05F8D 0%, #D6336C 50%, #A61E4D 100%)
```

## Source Files

- Brand constants live in `src/lib/brand.ts`.
- CSS variables live in `src/app/globals.css`.
- Tailwind palette lives in `tailwind.config.ts`.
- Logo and icon live in `public/berry-logo.svg` and `public/icon.svg`.

## UI Direction

- Prefer warm, tactile, hardware-bench visuals: circuit paths, component cards, trays, panels, subtle grid textures.
- Keep typography bold and highly legible.
- Use pink as the main action color and green only as a leaf/status accent.
- Keep copy practical and builder-focused.

## Build Plan

Implementation order and checklists live in **[BUILD_PLAN.md](./BUILD_PLAN.md)**. Prefer the current phase there before adding features from later phases. Update checkboxes and **Current phase** when a stage is done.

## Project format

Hardware projects use **3D-native JSON** (`position` and wire `points` are `{ x, y, z }`). 2D Studio edits **x/y only**; keep `z: 0` until 3D view ships. Schema: **[docs/project-schema.md](./docs/project-schema.md)**. Types: `src/lib/project/`.

## Code style

- Add a JSDoc comment to **every function** (purpose, params, throws when relevant). Keep inline comments for non-obvious logic only.
