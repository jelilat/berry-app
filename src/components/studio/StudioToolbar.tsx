'use client'

import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react'
import {
  Check,
  Cpu,
  FolderOpen,
  Hammer,
  Pencil,
  Play,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Redo2,
  X,
} from 'lucide-react'
import { ViewModeToggle, type StudioViewMode } from './ViewModeToggle'
import type { ValidationResult } from '@/lib/validation'

/**
 * Product-style Studio top bar with project status and pipeline actions.
 */
export function StudioToolbar({
  projectName,
  viewMode,
  onViewModeChange,
  onNew,
  onLoadExample,
  onRename,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDeleteSelected,
  hasSelection,
  validationResults,
  onValidationClick,
  hasValidationErrors,
  onBuild,
  onSimulate,
  onDeploy,
  buildDisabled,
  simulateDisabled,
}: {
  projectName: string
  viewMode: StudioViewMode
  onViewModeChange: (mode: StudioViewMode) => void
  onNew: () => void
  onLoadExample: () => void
  onRename: (name: string) => void
  onSave: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onDeleteSelected: () => void
  hasSelection: boolean
  validationResults: ValidationResult[]
  onValidationClick: () => void
  hasValidationErrors: boolean
  onBuild: () => void
  onSimulate: () => void
  onDeploy: () => void
  buildDisabled?: boolean
  simulateDisabled?: boolean
}) {
  const warningCount = validationResults.filter((result) => result.severity !== 'info').length
  const blockedTitle = hasValidationErrors
    ? 'Open pre-flight checks before building'
    : 'Compile firmware'

  return (
    <header
      className="flex h-[58px] shrink-0 items-center gap-3 border-b px-4"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ProjectTitleEditor projectName={projectName} onRename={onRename} />
        <button
          type="button"
          onClick={onValidationClick}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-bold"
          style={{
            color: warningCount > 0 ? '#f59e0b' : 'var(--leaf)',
            background: warningCount > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(15,168,134,0.09)',
            border: warningCount > 0 ? '1px solid rgba(245,158,11,0.28)' : '1px solid rgba(15,168,134,0.24)',
          }}
          title="Open pre-flight checks"
        >
          {warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? '' : 's'}` : 'Ready'}
        </button>
      </div>

      <div className="flex items-center gap-1">
        <IconButton label="New chat-ready project" icon={Sparkles} onClick={onNew} />
        <IconButton label="Load example" icon={FolderOpen} onClick={onLoadExample} />
        <IconButton label="Save" icon={Save} onClick={onSave} />
        <IconButton label="Undo" icon={Undo2} onClick={onUndo} disabled={!canUndo} />
        <IconButton label="Redo" icon={Redo2} onClick={onRedo} disabled={!canRedo} />
        <IconButton label="Delete selected" icon={Trash2} onClick={onDeleteSelected} disabled={!hasSelection} />
      </div>

      <span className="h-6 w-px" style={{ background: 'var(--border)' }} />
      <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />
      <span className="h-6 w-px" style={{ background: 'var(--border)' }} />

      <TextButton label="Build" icon={Hammer} onClick={onBuild} disabled={hasValidationErrors || buildDisabled} title={blockedTitle} />
      <TextButton label="Simulate" icon={Play} onClick={onSimulate} disabled={hasValidationErrors || simulateDisabled} title="Run simulation" primary />
      <IconButton label="Deploy coming soon" icon={Rocket} onClick={onDeploy} disabled={hasValidationErrors} />
      <IconButton label="Simulation engine" icon={Cpu} onClick={() => {}} disabled />
    </header>
  )
}

/**
 * Inline editor for the current Studio project title.
 * @param props Current project name and rename callback.
 */
function ProjectTitleEditor({
  projectName,
  onRename,
}: {
  projectName: string
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(projectName)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!editing) {
      setDraftName(projectName)
    }
  }, [editing, projectName])

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  /**
   * Enter title editing mode with the latest project name.
   */
  function startEditing() {
    setDraftName(projectName)
    setEditing(true)
  }

  /**
   * Save a title edit and leave editing mode.
   */
  function commitRename() {
    onRename(draftName)
    setEditing(false)
  }

  /**
   * Discard a title edit and leave editing mode.
   */
  function cancelRename() {
    setDraftName(projectName)
    setEditing(false)
  }

  /**
   * Submit the title edit form.
   * @param event Form submit event.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    commitRename()
  }

  /**
   * Handle title input keyboard shortcuts.
   * @param event Input keyboard event.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    cancelRename()
  }

  /**
   * Save the draft when focus leaves the title editor.
   * @param event Input blur event.
   */
  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    if (event.currentTarget.form?.contains(event.relatedTarget as Node | null)) return
    commitRename()
  }

  if (editing) {
    return (
      <form className="flex min-w-0 max-w-[360px] flex-1 items-center gap-1" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          aria-label="Project name"
          className="h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm font-extrabold outline-none"
          style={{
            background: 'var(--bg-surface)',
            borderColor: 'var(--berry)',
            color: 'var(--text-primary)',
          }}
        />
        <IconButton label="Save project name" icon={Check} onClick={commitRename} />
        <IconButton label="Cancel rename" icon={X} onClick={cancelRename} />
      </form>
    )
  }

  return (
    <div className="group flex min-w-0 max-w-[360px] flex-1 items-center gap-1">
      <h1 className="truncate text-sm font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {projectName}
      </h1>
      <IconButton label="Rename project" icon={Pencil} onClick={startEditing} />
    </div>
  )
}

/**
 * Compact icon-only toolbar button.
 * @param props Button label, icon, callback, and state.
 */
function IconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string
  icon: typeof Save
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-35"
      style={{ color: 'var(--text-secondary)' }}
    >
      <Icon size={16} />
    </button>
  )
}

/**
 * Pipeline action button.
 * @param props Button label, icon, callback, and visual state.
 */
function TextButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  title,
  primary,
}: {
  label: string
  icon: typeof Save
  onClick: () => void
  disabled?: boolean
  title?: string
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        color: primary ? 'var(--leaf)' : 'var(--text-secondary)',
        background: primary ? 'rgba(15,168,134,0.1)' : 'transparent',
        border: primary ? '1px solid rgba(15,168,134,0.25)' : '1px solid transparent',
      }}
    >
      <Icon size={15} />
      {label}
    </button>
  )
}
