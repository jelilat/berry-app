'use client'

import {
  Cable,
  Download,
  FolderOpen,
  Play,
  Redo2,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import { countValidationErrors } from '@/lib/validation'
import type { ValidationResult } from '@/lib/validation'
import { ViewModeToggle } from './ViewModeToggle'

/**
 * Studio top toolbar: project actions, view mode, active wire type, undo/redo.
 */
export function StudioToolbar({
  projectName,
  viewMode,
  onViewModeChange,
  activeWireLabel,
  onNew,
  onLoadExample,
  onSave,
  onExport,
  onImportClick,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDeleteSelected,
  hasSelection,
  validationResults,
  hasValidationErrors: hasErrors,
  onRun,
  onDeploy,
}: {
  projectName: string
  viewMode: '2d' | '3d'
  onViewModeChange: (mode: '2d' | '3d') => void
  activeWireLabel: string
  onNew: () => void
  onLoadExample: () => void
  onSave: () => void
  onExport: () => void
  onImportClick: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onDeleteSelected: () => void
  hasSelection: boolean
  validationResults: ValidationResult[]
  hasValidationErrors: boolean
  onRun: () => void
  onDeploy: () => void
}) {
  const errorCount = countValidationErrors(validationResults)
  const blockedTitle =
    hasErrors && errorCount > 0
      ? `Fix ${errorCount} wiring error${errorCount === 1 ? '' : 's'} before running`
      : undefined
  return (
    <header
      className="flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <span className="mr-1 text-sm font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {projectName}
      </span>

      <ToolbarButton label="New" icon={Sparkles} onClick={onNew} />
      <ToolbarButton label="Example" icon={FolderOpen} onClick={onLoadExample} />
      <ToolbarButton label="Save" icon={Save} onClick={onSave} />
      <ToolbarButton label="Export" icon={Download} onClick={onExport} />
      <ToolbarButton label="Import" icon={Upload} onClick={onImportClick} />

      <span className="mx-1 h-6 w-px" style={{ background: 'var(--border)' }} />

      <ToolbarButton label="Undo" icon={Undo2} onClick={onUndo} disabled={!canUndo} />
      <ToolbarButton label="Redo" icon={Redo2} onClick={onRedo} disabled={!canRedo} />

      <span className="mx-1 h-6 w-px" style={{ background: 'var(--border)' }} />

      <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />

      <span className="mx-1 h-6 w-px" style={{ background: 'var(--border)' }} />

      <ToolbarButton
        label="Run"
        icon={Play}
        onClick={onRun}
        disabled={hasErrors}
        title={blockedTitle}
      />
      <ToolbarButton
        label="Deploy"
        icon={Rocket}
        onClick={onDeploy}
        disabled={hasErrors}
        title={blockedTitle}
      />

      <span
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold"
        style={{
          background: 'rgba(15,168,134,0.12)',
          border: '1px solid rgba(15,168,134,0.35)',
          color: 'var(--leaf)',
        }}
        title="Choose jumper type in the left palette"
      >
        <Cable size={14} />
        {activeWireLabel}
      </span>

      <ToolbarButton
        label="Delete"
        icon={Trash2}
        onClick={onDeleteSelected}
        disabled={!hasSelection}
      />
    </header>
  )
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  title,
}: {
  label: string
  icon: typeof Save
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
