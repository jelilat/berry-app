'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronDown } from 'lucide-react'
import { brand } from '@/lib/brand'
import {
  clearAuthSession,
  createDummyUser,
  loadAuthSession,
  saveAuthSession,
  type AuthSession,
} from '@/lib/auth/dummy-auth'
import {
  loadUserProjects,
  type UserProjectEntry,
} from '@/lib/projects/user-projects'
import { createStarterProject } from '@/lib/project/mutations'
import {
  bootstrapBuilderTemplate,
  bootstrapSavedProject,
  stashPendingAgentRun,
} from '@/lib/studio/session-bootstrap'
import { saveFirmwareSourceToStorage, saveProjectToStorage } from '@/lib/studio/storage'
import { createDefaultFirmwareSource } from '@/lib/firmware/source'
import { BUILDER_TEMPLATES } from '@/lib/studio/templates'
import {
  loadSelectedModelId,
  resolveUserModel,
  saveSelectedModelId,
  USER_MODEL_OPTIONS,
  type UserModelOption,
} from '@/lib/studio/user-models'
import { BuilderSidebar } from './BuilderSidebar'
import { LoginPromptModal } from './LoginPromptModal'
import { TypingPromptHint } from './TypingPromptHint'

/**
 * Builder home: sidebar, hero prompt, model picker, and reference templates.
 */
export function BuilderHome() {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)

  const [session, setSession] = useState<AuthSession | null>(null)
  const [projects, setProjects] = useState<UserProjectEntry[]>([])
  const [prompt, setPrompt] = useState('')
  const [selectedModelId, setSelectedModelId] = useState(USER_MODEL_OPTIONS[0]!.id)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [promptFocused, setPromptFocused] = useState(false)

  const selectedModel = resolveUserModel(selectedModelId)

  useEffect(() => {
    setSession(loadAuthSession())
    setProjects(loadUserProjects())
    setSelectedModelId(loadSelectedModelId())
  }, [])

  useEffect(() => {
    if (!modelMenuOpen) return
    /**
     * Close the model menu when clicking outside the dropdown.
     * @param event Document click event.
     */
    function handlePointerDown(event: MouseEvent) {
      if (!modelMenuRef.current?.contains(event.target as Node)) {
        setModelMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [modelMenuOpen])

  /**
   * Persist the selected model preference.
   * @param model User-facing model option.
   */
  const handleSelectModel = useCallback((model: UserModelOption) => {
    setSelectedModelId(model.id)
    saveSelectedModelId(model.id)
    setModelMenuOpen(false)
  }, [])

  /**
   * Open the bench after bootstrapping a reference template.
   * @param templateId Template id from a chip.
   */
  const handleTemplateSelect = useCallback(
    async (templateId: string) => {
      const template = BUILDER_TEMPLATES.find((candidate) => candidate.id === templateId)
      setBootstrapping(true)
      setErrorMessage(null)
      try {
        await bootstrapBuilderTemplate(templateId, { saveForUser: !!session })
        if (template?.autoRunPrompt) {
          stashPendingAgentRun(template.prompt, selectedModel)
        }
        if (session) {
          setProjects(loadUserProjects())
        }
        router.push('/bench')
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to open template')
      } finally {
        setBootstrapping(false)
      }
    },
    [router, selectedModel, session],
  )

  /**
   * Submit a custom prompt or show the login gate for guests.
   */
  const handleSubmitPrompt = useCallback(() => {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt || bootstrapping) return

    if (!session) {
      setLoginOpen(true)
      return
    }

    const starter = createStarterProject()
    starter.metadata.name = cleanPrompt.slice(0, 64)
    starter.metadata.description = cleanPrompt
    saveProjectToStorage(starter)
    saveFirmwareSourceToStorage(createDefaultFirmwareSource(starter.board))
    stashPendingAgentRun(cleanPrompt, selectedModel)
    router.push('/bench')
  }, [bootstrapping, prompt, router, selectedModel, session])

  /**
   * Open a saved project from the sidebar.
   * @param projectId Saved project id.
   */
  const handleOpenProject = useCallback(
    (projectId: string) => {
      const project = projects.find((entry) => entry.id === projectId)
      if (!project) return
      bootstrapSavedProject(project.projectJson)
      router.push('/bench')
    },
    [projects, router],
  )

  /**
   * Placeholder sign-in that stores a demo session locally.
   */
  const handleSignIn = useCallback(() => {
    const nextSession = saveAuthSession(createDummyUser())
    setSession(nextSession)
    setLoginOpen(false)
  }, [])

  /**
   * Clear the dummy session and refresh sidebar state.
   */
  const handleSignOut = useCallback(() => {
    clearAuthSession()
    setSession(null)
  }, [])

  /**
   * Focus the prompt and clear it for a fresh custom build.
   */
  const handleNewProject = useCallback(() => {
    setPrompt('')
    textareaRef.current?.focus()
  }, [])

  return (
    <div className="flex min-h-[100dvh]" style={{ background: 'var(--bg-base)' }}>
      <BuilderSidebar
        session={session}
        projects={projects}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleSignOut}
        onOpenProject={handleOpenProject}
        onNewProject={handleNewProject}
      />

      <main className="relative flex min-w-0 flex-1 flex-col items-center justify-center px-6 py-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 50% 12%, rgba(214,51,108,0.12), transparent 34%), radial-gradient(circle at 18% 28%, rgba(255,255,255,0.55), transparent 22%)',
          }}
        />

        <div className="relative w-full max-w-3xl text-center">
          <div className="mb-8 inline-flex items-center gap-2">
            <Image src={brand.assets.icon} alt="" width={28} height={28} />
            <span className="text-lg font-extrabold tracking-[-0.05em]">{brand.name}</span>
          </div>

          <h1 className="text-5xl font-extrabold leading-[0.95] tracking-[-0.06em] sm:text-6xl">
            From idea to{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #F05F8D 0%, #D6336C 55%, #A61E4D 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              working hardware.
            </span>
          </h1>
          {/* <p className="mx-auto mt-5 max-w-xl text-base leading-7" style={{ color: 'var(--text-secondary)' }}>
            Drop a prompt, choose your model, and open a bench where parts land, nets connect, and
            firmware takes shape — without leaving the flow.
          </p> */}

          <div
            className="relative mt-10 rounded-[28px] p-4 text-left"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid rgba(214,51,108,0.22)',
              boxShadow: '0 24px 60px rgba(214,51,108,0.08), var(--shadow-soft)',
            }}
          >
            <TypingPromptHint visible={prompt.trim().length === 0 && !promptFocused} />

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onFocus={() => setPromptFocused(true)}
              onBlur={() => setPromptFocused(false)}
              rows={4}
              className="relative z-[1] w-full resize-none bg-transparent text-lg font-medium leading-7 outline-none"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Describe your hardware project"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSubmitPrompt()
                }
              }}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div ref={modelMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setModelMenuOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/[0.03]"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  aria-expanded={modelMenuOpen}
                  aria-haspopup="listbox"
                >
                  <SparklesDot />
                  {selectedModel.label}
                  <ChevronDown size={14} />
                </button>

                {modelMenuOpen && (
                  <div
                    role="listbox"
                    className="absolute bottom-full left-0 z-10 mb-2 min-w-[240px] overflow-hidden rounded-2xl py-1"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-soft)',
                    }}
                  >
                    {USER_MODEL_OPTIONS.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        role="option"
                        aria-selected={model.id === selectedModelId}
                        onClick={() => handleSelectModel(model)}
                        className="flex w-full flex-col items-start px-4 py-3 text-left transition-colors hover:bg-black/[0.03]"
                      >
                        <span className="text-sm font-bold">{model.label}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {model.description}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmitPrompt}
                disabled={bootstrapping || prompt.trim().length === 0}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #F05F8D 0%, #D6336C 55%, #A61E4D 100%)',
                  boxShadow: '0 12px 28px rgba(214,51,108,0.24)',
                }}
                aria-label="Send prompt to Pip"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>

          <div className="mt-10">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {BUILDER_TEMPLATES.map((template) => {
                const Icon = template.icon
                return (
                  <button
                    key={template.id}
                    type="button"
                    disabled={bootstrapping}
                    onClick={() => handleTemplateSelect(template.id)}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/[0.03] disabled:opacity-50"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Icon size={15} style={{ color: 'var(--text-muted)' }} />
                    {template.label}
                  </button>
                )
              })}
            </div>
          </div>

          {errorMessage && (
            <p
              className="mt-6 rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ background: 'rgba(214,51,108,0.1)', color: 'var(--accent)' }}
              role="alert"
            >
              {errorMessage}
            </p>
          )}
        </div>
      </main>

      <LoginPromptModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSignIn={handleSignIn}
      />
    </div>
  )
}

/**
 * Small berry-toned dot used in the model selector chip.
 */
function SparklesDot() {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full"
      style={{ background: 'rgba(214,51,108,0.12)', color: 'var(--accent)' }}
      aria-hidden="true"
    >
      <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
    </span>
  )
}
