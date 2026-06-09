'use client'

import CodeMirror from '@uiw/react-codemirror'
import { cpp } from '@codemirror/lang-cpp'
import { oneDark } from '@codemirror/theme-one-dark'
import { RotateCcw } from 'lucide-react'
import { DEFAULT_FIRMWARE_PATH } from '@/lib/firmware/source'
import type { BoardId } from '@/lib/project/types'

/**
 * Count source lines for compact editor status.
 * @param source Firmware source text.
 */
function countLines(source: string): number {
  if (source.length === 0) return 1
  return source.split('\n').length
}

/**
 * Browser firmware editor for the active `src/main.cpp` source file.
 * @param props Editor state and event handlers.
 */
export function FirmwareEditorPanel({
  board,
  source,
  onChange,
  onReset,
}: {
  board: BoardId
  source: string
  onChange: (source: string) => void
  onReset: () => void
}) {
  const lineCount = countLines(source)

  return (
    <section
      className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      aria-label="Firmware code editor"
    >
      <header
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {DEFAULT_FIRMWARE_PATH}
          </p>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            {board} · Arduino C++
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-lg px-2.5 py-1 text-xs font-bold"
            style={{
              background: 'rgba(15,168,134,0.1)',
              border: '1px solid rgba(15,168,134,0.28)',
              color: 'var(--leaf)',
            }}
          >
            {lineCount} line{lineCount === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          value={source}
          height="100%"
          minHeight="520px"
          extensions={[cpp()]}
          theme={oneDark}
          basicSetup={{
            autocompletion: true,
            bracketMatching: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            lineNumbers: true,
            searchKeymap: true,
          }}
          onChange={onChange}
        />
      </div>
    </section>
  )
}
