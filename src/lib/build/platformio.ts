import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import type { BoardId } from '@/lib/project/types'
import { BOARD_PIO_CONFIG, resolvePlatformioIni } from './platformio-ini'
import { persistBuildArtifact } from './artifacts'
import { computeFirmwareHash } from './hash'
import type {
  BuildDiagnostic,
  BuildInput,
  BuildResult,
  CompilerAdapter,
  FirmwareSourceFiles,
} from './types'

export { resolvePlatformioIni } from './platformio-ini'

/**
 * Parse GCC/PlatformIO-style diagnostic lines from compiler output.
 * @param output Combined stdout and stderr text.
 */
export function parsePlatformioDiagnostics(output: string): BuildDiagnostic[] {
  const diagnostics: BuildDiagnostic[] = []
  const linePattern =
    /^(.*?):(\d+)(?::(\d+))?:\s*(error|warning|note):\s*(.+)$/gm

  for (const match of output.matchAll(linePattern)) {
    const [, file, line, column, severity, message] = match
    diagnostics.push({
      severity: severity === 'warning' ? 'warning' : severity === 'note' ? 'info' : 'error',
      file: file?.trim() || undefined,
      line: line ? Number.parseInt(line, 10) : undefined,
      column: column ? Number.parseInt(column, 10) : undefined,
      message: message?.trim() ?? 'Compiler error',
      raw: match[0],
    })
  }

  if (diagnostics.length === 0 && output.trim().length > 0) {
    diagnostics.push({
      severity: 'error',
      message: 'PlatformIO build failed. See compiler output for details.',
      raw: output.trim(),
    })
  }

  return diagnostics
}

/**
 * Build a PATH that includes common PlatformIO install locations.
 * Next.js dev servers often inherit a minimal PATH without pip user bins.
 */
function buildPlatformioPath(): string {
  const home = os.homedir()
  const extra = [
    process.env.BERRY_PLATFORMIO_BIN?.trim(),
    path.join(home, '.local', 'bin'),
    path.join(home, '.platformio', 'penv', 'bin'),
    ...['3.13', '3.12', '3.11', '3.10', '3.9'].map((version) =>
      path.join(home, 'Library', 'Python', version, 'bin'),
    ),
  ].filter((entry): entry is string => Boolean(entry))

  return [...extra, process.env.PATH ?? ''].filter(Boolean).join(path.delimiter)
}

/** One PlatformIO invocation candidate. */
interface PlatformioCommand {
  command: string
  args: string[]
  label: string
}

/**
 * Ordered PlatformIO CLI candidates, including PATH overrides and Python module fallbacks.
 * @param pioArgs Arguments passed to `pio run`.
 */
function platformioCommands(pioArgs: string[]): PlatformioCommand[] {
  const commands: PlatformioCommand[] = []
  const binOverride = process.env.BERRY_PLATFORMIO_BIN?.trim()
  if (binOverride) {
    commands.push({ command: binOverride, args: pioArgs, label: binOverride })
  }

  for (const command of ['pio', 'platformio']) {
    commands.push({ command, args: pioArgs, label: command })
  }

  for (const python of ['python3', 'python']) {
    commands.push({
      command: python,
      args: ['-m', 'platformio', ...pioArgs],
      label: `${python} -m platformio`,
    })
  }

  return commands
}

/**
 * True when spawn failed because the executable was not found.
 * @param code Process exit code.
 * @param stderr Captured stderr text.
 */
function isSpawnNotFound(code: number, stderr: string): boolean {
  return code === 127 || /ENOENT|not found/i.test(stderr)
}

/**
 * Run a shell command and capture stdout/stderr.
 * @param command Executable name.
 * @param args Command arguments.
 * @param cwd Working directory for the process.
 */
function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      env: {
        ...process.env,
        PATH: buildPlatformioPath(),
      },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error: NodeJS.ErrnoException) => {
      resolve({ code: 127, stdout, stderr: `${stderr}\n${error.message}`.trim() })
    })
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

/**
 * Try common PlatformIO install locations until one can execute.
 * @param args Arguments passed to the CLI.
 * @param cwd Build working directory.
 */
async function runPlatformio(
  args: string[],
  cwd: string,
): Promise<
  | { ok: true; stdout: string; stderr: string; command: string }
  | { ok: false; spawnError: string }
> {
  for (const candidate of platformioCommands(args)) {
    const result = await runCommand(candidate.command, candidate.args, cwd)
    if (isSpawnNotFound(result.code, result.stderr)) {
      continue
    }
    return {
      ok: true,
      stdout: result.stdout,
      stderr: result.stderr,
      command: candidate.label,
    }
  }

  return {
    ok: false,
    spawnError:
      'PlatformIO CLI is not installed or not on PATH. Install with `pip3 install --user platformio` or `pipx install platformio`, then restart the dev server. On macOS, add `~/Library/Python/3.9/bin` to PATH or set `BERRY_PLATFORMIO_BIN` to the full `pio` path.',
  }
}

/**
 * Write firmware sources into a temp directory for PlatformIO.
 * @param rootDir Temp build root.
 * @param files Source files to write.
 * @param board Target board for default ini generation.
 */
export async function writeBuildFiles(
  rootDir: string,
  files: FirmwareSourceFiles,
  board: BoardId,
): Promise<string[]> {
  const written: string[] = []
  const srcDir = path.join(rootDir, 'src')
  await mkdir(srcDir, { recursive: true })
  const mainPath = path.join(srcDir, 'main.cpp')
  await writeFile(mainPath, files['src/main.cpp'], 'utf8')
  written.push('src/main.cpp')

  const iniContent = resolvePlatformioIni(board, files['platformio.ini'])
  const iniPath = path.join(rootDir, 'platformio.ini')
  await writeFile(iniPath, iniContent, 'utf8')
  written.push('platformio.ini')

  return written
}

/**
 * Compile firmware with PlatformIO in a temporary directory.
 * @param input Build input with project and source files.
 */
export async function compileWithPlatformIO(input: BuildInput): Promise<BuildResult> {
  const { project, files } = input
  const boardConfig = BOARD_PIO_CONFIG[project.board]
  const buildDir = await mkdtemp(path.join(os.tmpdir(), 'berry-build-'))

  try {
    const writtenFiles = await writeBuildFiles(buildDir, files, project.board)
    const runResult = await runPlatformio(['run'], buildDir)

    if (!runResult.ok) {
      return {
        ok: false,
        backend: 'local',
        diagnostics: [
          {
            severity: 'error',
            message: runResult.spawnError,
          },
        ],
      }
    }

    const combinedOutput = `${runResult.stdout}\n${runResult.stderr}`.trim()
    if (combinedOutput.length === 0) {
      // PlatformIO may exit non-zero without output in rare spawn cases.
    }

    const artifactPath = path.join(buildDir, boardConfig.artifactRelative)
    let artifactExists = false
    try {
      const artifactStat = await stat(artifactPath)
      artifactExists = artifactStat.isFile()
    } catch {
      artifactExists = false
    }

    if (!artifactExists) {
      return {
        ok: false,
        backend: 'local',
        diagnostics: parsePlatformioDiagnostics(combinedOutput),
      }
    }

    const binary = await readFile(artifactPath)
    const firmwareHash = computeFirmwareHash(project, files)
    const stored = await persistBuildArtifact(
      firmwareHash,
      project.board,
      binary,
      boardConfig.artifactRelative,
    )

    return {
      ok: true,
      backend: 'local',
      artifact: {
        board: project.board,
        firmwareHash,
        files: writtenFiles,
        binaryPath: boardConfig.artifactRelative,
        binarySizeBytes: binary.byteLength,
        filename: stored.filename,
        downloadUrl: stored.downloadUrl,
        createdAt: new Date().toISOString(),
      },
      diagnostics: [],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PlatformIO build failed'
    return {
      ok: false,
      backend: 'local',
      diagnostics: [{ severity: 'error', message }],
    }
  }
}

/** Local PlatformIO compiler adapter. */
export const localPlatformIOAdapter: CompilerAdapter = {
  backend: 'local',
  compile: compileWithPlatformIO,
}
