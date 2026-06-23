# berry.

[**berry.**](https://berry.studio) is an open-source AI agent for hardware development. It helps builders go from an idea to working hardware with AI-guided wiring, code generation, debugging, and deployment support.

Think of berry. as an AI hardware workbench: it understands parts, circuits, firmware, logs, and deployment steps, so you can prototype connected devices in minutes instead of days.

## Features

- **Studio** — a visual workbench for laying out parts and wiring them together.
  - **Canvas** — drag parts, delete selections, and wire terminals together.
  - **Templates** — start from scratch or load an example template.
  - **Undo / redo** and auto-save to your browser.
- **Firmware generation** — maps your wiring to `src/main.cpp` pin constants and logic.
- **Firmware build** — compiles via [PlatformIO](https://platformio.org/), with downloadable firmware for supported boards.
- **Simulation** — simulates your firmware in a browser-based emulator.
- **Deployment** — deploys your firmware to a supported board.
- **AI Assistant** — a chat interface for interacting with the AI.

Supported boards: `esp32-devkit-v1` (`.bin`) and `arduino-uno` (`.hex`).

## Getting Started

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000), or go straight to the Studio at [http://localhost:3000/studio](http://localhost:3000/studio).

## Firmware Builds

Studio **Generate** turns your wiring into firmware source, and **Build** compiles it with PlatformIO. Successful builds are cached and exposed via **Download** in the Studio.

### Install PlatformIO

```bash
pip3 install --user platformio
# or: pipx install platformio
```

On macOS, pip often installs `pio` to `~/Library/Python/3.9/bin`. berry. augments PATH for common install locations automatically. If Build still cannot find PlatformIO, restart `pnpm dev` or set:

```bash
export BERRY_PLATFORMIO_BIN="$HOME/Library/Python/3.9/bin/pio"
```

### Mock backend (no PlatformIO)

For UI development and tests without a local compiler:

```bash
# .env.local
BERRY_BUILD_BACKEND=mock
```

### Production build API

berry. uses the hosted build API when `BERRY_BUILD_API_URL` is set. The app posts the same `BuildInput` JSON to `POST /build`, keeps the API token server-side, and proxies firmware downloads through `/api/build/artifact?hash=...`.

```bash
# production environment
BERRY_BUILD_API_URL=https://your-build-api.example.com
BERRY_BUILD_API_TOKEN=change-me
```

Set `BERRY_BUILD_BACKEND=remote` explicitly if you want to force the build API outside Cloudflare Pages. Local development defaults to PlatformIO unless `BERRY_BUILD_BACKEND` is set.

### Build timing

- **First ESP32 build:** often 5–15 minutes while PlatformIO downloads toolchains.
- **Later builds:** usually under a minute for small sketches.
- **Wiring validation** must pass before Generate or Build.

## Testing

Unit tests use [Vitest](https://vitest.dev/) for the project model and Studio mutations.

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

## Contributing

berry. is open source and contributions are welcome. The implementation is organized as a phased checklist in **[BUILD_PLAN.md](./BUILD_PLAN.md)** — a good place to see what's in progress and where to help.
