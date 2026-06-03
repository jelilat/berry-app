# berry-app

`app.berry.studio` is the application home for **berry.**, an open-source AI agent for hardware development.

Berry helps builders go from an idea to working hardware with AI-guided wiring, code generation, debugging, and deployment support.

## Build Plan

Track implementation progress in **[BUILD_PLAN.md](./BUILD_PLAN.md)** — phased checklist from project model → Studio → validation → simulation → deploy → AI orchestration.

Project JSON format (3D-native, 2D uses xy): **[docs/project-schema.md](./docs/project-schema.md)**.

## Brand Snapshot

- Name: `berry.`
- Tagline: Open-source AI agent for hardware development.
- Promise: Go from idea to working hardware in minutes with AI-guided wiring, code, debugging, and deployment support.
- Tone: warm, precise, useful, slightly playful, hardware-bench inspired.
- Primary color: `#D6336C`
- Primary gradient: `#F05F8D -> #D6336C -> #A61E4D`
- Leaf accent: `#0FA886 -> #52D6C3`
- Light base: `#F5F3EF`
- Dark base: `#0C0C0F`

## Assets

- Logo: `public/berry-logo.svg`
- Icon: `public/icon.svg`
- Reusable brand constants: `src/lib/brand.ts`
- Global CSS tokens: `src/app/globals.css`
- Tailwind brand palette: `tailwind.config.ts`

## Getting Started

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Testing

Unit tests use [Vitest](https://vitest.dev/) for the project model (`src/lib/project/`).

```bash
pnpm test        # watch mode
pnpm test:run    # single run (CI)
```

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test:run
```

## Notes For Future Agents

- **Build order:** follow [BUILD_PLAN.md](./BUILD_PLAN.md); check off tasks as stages complete.
- **Brand & copy:** use `AGENTS.md` and `.cursor/rules/berry-brand.mdc` before changing product voice, colors, or core UI direction.
