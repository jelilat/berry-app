# berry-app

`app.berry.studio` is the application home for **berry.**, an open-source AI agent for hardware development.

Berry helps builders go from an idea to working hardware with AI-guided wiring, code generation, debugging, and deployment support.

## Build Plan

Track implementation progress in **[BUILD_PLAN.md](./BUILD_PLAN.md)** — phased checklist from project model → Studio → validation → simulation → deploy → AI orchestration.

Project JSON format (3D-native, 2D uses xy): **[docs/project-schema.md](./docs/project-schema.md)**.

## Studio (2D bench)

Open **[http://localhost:3000/studio](http://localhost:3000/studio)** after `pnpm dev`.

- **Component tray** — grouped catalog (`listCatalogGrouped()`); click to place a part.
- **Canvas** — drag parts, delete selection, wire mode (terminal A → B).
- **Project** — auto-saves to `localStorage` key `berry-studio-project`; toolbar **Save**, **Export** JSON, **Import** file.
- **Templates** — **New** (breadboard + ESP32), **Example** (ESP32 LED blink from `public/examples/`).
- **Undo / redo** — history on project graph mutations (`src/lib/project/mutations.ts`).

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

## Firmware build (Phase 3)

Studio **Generate** maps wiring → `src/main.cpp` pin constants and blink logic. **Build** compiles via PlatformIO (`BERRY_BUILD_BACKEND=local` by default). Successful builds cache firmware under the OS temp dir and expose **Download** in Studio.

Supported boards: `esp32-devkit-v1` (`.bin`) and `arduino-uno` (`.hex`).

### Install PlatformIO

```bash
pip3 install --user platformio
# or: pipx install platformio
```

On macOS, pip often installs `pio` to `~/Library/Python/3.9/bin`. Berry augments PATH for common install locations automatically; if Build still cannot find PlatformIO, restart `pnpm dev` or set:

```bash
export BERRY_PLATFORMIO_BIN="$HOME/Library/Python/3.9/bin/pio"
```

### Mock backend (no PlatformIO)

For UI development and tests without a local compiler:

```bash
# .env.local
BERRY_BUILD_BACKEND=mock
```

### Build timing

- **First ESP32 build:** often 5–15 minutes while PlatformIO downloads toolchains
- **Later builds:** usually under a minute for small sketches
- **Wiring validation** must pass before Generate or Build

## Testing

Unit tests use [Vitest](https://vitest.dev/) for the project model (`src/lib/project/`) and Studio mutations.

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
