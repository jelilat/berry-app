'use client'

import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { cpp } from '@codemirror/lang-cpp'
import { oneDark } from '@codemirror/theme-one-dark'
import { Check, Clipboard, RotateCcw } from 'lucide-react'
import { copyTextToClipboard } from '@/lib/clipboard'
import type { BoardId } from '@/lib/project/types'

const COPY_FEEDBACK_MS = 1600

/**
 * Count source lines for compact editor status.
 * @param source Firmware source text.
 */
function countLines(source: string): number {
  if (source.length === 0) return 1
  return source.split('\n').length
}

/**
 * Browser firmware editor for a worktree file in the Code workspace.
 * @param props Editor state and event handlers.
 */
export function FirmwareEditorPanel({
  board,
  filePath,
  source,
  readOnly = false,
  onChange,
  onReset,
}: {
  board: BoardId
  filePath: string
  source: string
  readOnly?: boolean
  onChange: (source: string) => void
  onReset?: () => void
}) {
  const lineCount = countLines(source)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (copyState === 'idle') return undefined
    const timeout = window.setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  /**
   * Copy the current firmware source to the system clipboard.
   */
  const copySource = async () => {
    try {
      await copyTextToClipboard(source)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <section
      className="berry-firmware-editor flex h-full min-h-0 flex-col overflow-hidden rounded-2xl"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      aria-label="Firmware code editor"
    >
      <header
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {filePath}
          </p>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            {board} · {readOnly ? 'Generated · read only' : 'Arduino C++'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copySource}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold"
            style={{
              background: copyState === 'failed' ? 'rgba(214, 51, 108, 0.1)' : 'var(--bg-elevated)',
              border:
                copyState === 'failed'
                  ? '1px solid rgba(214, 51, 108, 0.28)'
                  : '1px solid var(--border)',
              color: copyState === 'failed' ? 'var(--accent)' : 'var(--text-primary)',
            }}
            title="Copy code"
          >
            {copyState === 'copied' ? <Check size={14} /> : <Clipboard size={14} />}
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
          </button>
          <span
            className="rounded-lg px-2.5 py-1 text-xs font-bold"
            style={{
              background: readOnly ? 'rgba(214, 51, 108, 0.1)' : 'rgba(15,168,134,0.1)',
              border: readOnly
                ? '1px solid rgba(214, 51, 108, 0.28)'
                : '1px solid rgba(15,168,134,0.28)',
              color: readOnly ? 'var(--accent)' : 'var(--leaf)',
            }}
          >
            {readOnly ? 'Generated' : `${lineCount} line${lineCount === 1 ? '' : 's'}`}
          </span>
          {!readOnly && onReset && (
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
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          value={source}
          height="100%"
          className="h-full overflow-hidden"
          extensions={[cpp()]}
          theme={oneDark}
          editable={!readOnly}
          style={{ height: '100%' }}
          basicSetup={{
            autocompletion: !readOnly,
            bracketMatching: true,
            foldGutter: true,
            highlightActiveLine: !readOnly,
            highlightSelectionMatches: true,
            lineNumbers: true,
            searchKeymap: true,
          }}
          onChange={readOnly ? undefined : onChange}
        />
      </div>

      <style jsx global>{`
        .berry-firmware-editor .cm-editor {
          height: 100%;
        }

        .berry-firmware-editor .cm-scroller {
          overflow: auto;
        }
      `}</style>
    </section>
  )
}
