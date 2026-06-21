'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, ChevronDown } from 'lucide-react'
import { brand } from '@/lib/brand'
import { authSessionFromUser, type AuthSession } from '@/lib/auth/session'
import { createSupabaseBrowserClient } from '@/lib/auth/supabase-browser'
import {
  getAuthMode,
  hasSupabaseBrowserConfig,
  isAuthEnabled,
  isAuthRequired,
} from '@/lib/auth/config'
import {
  loadUserProjects,
  removeUserProject,
  upsertUserProject,
  type UserProjectEntry,
} from '@/lib/projects/user-projects'
import {
  clearActiveCloudProjectId,
  deleteCloudUserProject,
  loadCloudUserProjects,
  upsertCloudUserProject,
} from '@/lib/projects/cloud-projects'
import { createEmptyProject } from '@/lib/project/mutations'
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
  loadSelectedReasoningId,
  resolveUserModel,
  resolveUserReasoning,
  saveSelectedModelId,
  saveSelectedReasoningId,
  USER_REASONING_OPTIONS,
  USER_MODEL_OPTIONS,
  type UserReasoningOption,
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
  const [selectedReasoningId, setSelectedReasoningId] = useState(loadSelectedReasoningId())
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [reasoningMenuOpen, setReasoningMenuOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [promptFocused, setPromptFocused] = useState(false)

  const selectedModel = resolveUserModel(selectedModelId)
  const selectedReasoning = resolveUserReasoning(selectedReasoningId)
  const authMode = getAuthMode()
  const authEnabled = isAuthEnabled()
  const authRequired = isAuthRequired()
  const cloudSyncEnabled = authEnabled && hasSupabaseBrowserConfig()

  /**
   * Refresh the project sidebar from cloud for signed-in users, or local storage for guests.
   * @param signedIn Whether the current user has an active Supabase session.
   */
  const refreshProjects = useCallback(async (signedIn: boolean) => {
    if (!signedIn || !cloudSyncEnabled) {
      setProjects(loadUserProjects())
      return
    }

    try {
      const supabase = createSupabaseBrowserClient()
      setProjects(await loadCloudUserProjects(supabase))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load cloud projects')
      setProjects(loadUserProjects())
    }
  }, [cloudSyncEnabled])

  useEffect(() => {
    setProjects(loadUserProjects())
    setSelectedModelId(loadSelectedModelId())
    setSelectedReasoningId(loadSelectedReasoningId())

    if (!authEnabled) {
      return
    }

    if (!hasSupabaseBrowserConfig()) {
      if (authMode === 'required') {
        setErrorMessage('Auth is required, but Supabase is not configured')
      }
      return
    }

    let mounted = true
    try {
      const supabase = createSupabaseBrowserClient()
      supabase.auth.getUser().then(({ data, error }) => {
        if (!mounted) return
        if (error || !data.user) {
          setSession(null)
          void refreshProjects(false)
          return
        }
        setSession(authSessionFromUser(data.user))
        void refreshProjects(true)
      })

      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!mounted) return
        const signedIn = !!nextSession?.user
        setSession(nextSession?.user ? authSessionFromUser(nextSession.user) : null)
        void refreshProjects(signedIn)
      })

      return () => {
        mounted = false
        data.subscription.unsubscribe()
      }
    } catch {
      setSession(null)
      return () => {
        mounted = false
      }
    }
  }, [authEnabled, authMode, refreshProjects])

  useEffect(() => {
    if (!modelMenuOpen) return
    /**
     * Close the model menu when clicking outside the dropdown.
     * @param event Document click event.
     */
    function handlePointerDown(event: MouseEvent) {
      if (!modelMenuRef.current?.contains(event.target as Node)) {
        setModelMenuOpen(false)
        setReasoningMenuOpen(false)
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
    setReasoningMenuOpen(true)
  }, [])

  /**
   * Persist the selected reasoning preference.
   * @param reasoning User-facing reasoning option.
   */
  const handleSelectReasoning = useCallback((reasoning: UserReasoningOption) => {
    setSelectedReasoningId(reasoning.id)
    saveSelectedReasoningId(reasoning.id)
    setModelMenuOpen(false)
    setReasoningMenuOpen(false)
  }, [])

  /**
   * Open the bench after bootstrapping a reference template.
   * @param templateId Template id from a chip.
   */
  const handleTemplateSelect = useCallback(
    async (templateId: string) => {
      setBootstrapping(true)
      setErrorMessage(null)
      try {
        const project = await bootstrapBuilderTemplate(templateId, {
          saveForUser: false,
          saveToLocalStorage: !(session && cloudSyncEnabled),
        })
        if (session && cloudSyncEnabled) {
          const supabase = createSupabaseBrowserClient()
          const entry = await upsertCloudUserProject(supabase, project)
          await refreshProjects(true)
          router.push(`/bench/${entry.id}`)
        } else {
          upsertUserProject(project)
          clearActiveCloudProjectId()
          router.push('/bench')
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to open template')
      } finally {
        setBootstrapping(false)
      }
    },
    [cloudSyncEnabled, refreshProjects, router, session],
  )

  /**
   * Submit a custom prompt or show the login gate for guests.
   */
  const handleSubmitPrompt = useCallback(async () => {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt || bootstrapping) return

    if (authRequired && !session) {
      setLoginOpen(true)
      return
    }

    const starter = createEmptyProject()
    starter.metadata.name = cleanPrompt.slice(0, 64)
    starter.metadata.description = cleanPrompt
    stashPendingAgentRun(cleanPrompt, selectedModel, selectedReasoning.id)
    if (session && cloudSyncEnabled) {
      setBootstrapping(true)
      setErrorMessage(null)
      try {
        const supabase = createSupabaseBrowserClient()
        const entry = await upsertCloudUserProject(supabase, starter)
        await refreshProjects(true)
        router.push(`/bench/${entry.id}`)
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to save cloud project')
        setBootstrapping(false)
        return
      }
      setBootstrapping(false)
      return
    }
    saveProjectToStorage(starter)
    saveFirmwareSourceToStorage(createDefaultFirmwareSource(starter.board))
    upsertUserProject(starter)
    clearActiveCloudProjectId()
    router.push('/bench')
  }, [
    authRequired,
    bootstrapping,
    cloudSyncEnabled,
    prompt,
    refreshProjects,
    router,
    selectedModel,
    selectedReasoning.id,
    session,
  ])

  /**
   * Open a saved project from the sidebar.
   * @param projectId Saved project id.
   */
  const handleOpenProject = useCallback(
    (projectId: string) => {
      const project = projects.find((entry) => entry.id === projectId)
      if (!project) return
      if (session && cloudSyncEnabled) {
        router.push(`/bench/${project.id}`)
      } else {
        bootstrapSavedProject(project.projectJson)
        clearActiveCloudProjectId()
        router.push('/bench')
      }
    },
    [cloudSyncEnabled, projects, router, session],
  )

  /**
   * Start Google OAuth through Supabase.
   */
  const handleGoogleSignIn = useCallback(async () => {
    setErrorMessage(null)
    try {
      if (!cloudSyncEnabled) {
        throw new Error('Auth is not configured for this deployment')
      }
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account',
          },
        },
      })
      if (error) throw error
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start Google sign-in')
    }
  }, [cloudSyncEnabled])

  /**
   * Send a magic-link sign-in email through Supabase.
   * @param email Email address that should receive the sign-in link.
   */
  const handleEmailSignIn = useCallback(async (email: string) => {
    setErrorMessage(null)
    if (!cloudSyncEnabled) {
      throw new Error('Auth is not configured for this deployment')
    }
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }, [cloudSyncEnabled])

  /**
   * Sign the current user out of Supabase and refresh sidebar state.
   */
  const handleSignOut = useCallback(async () => {
    setErrorMessage(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setSession(null)
      clearActiveCloudProjectId()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to sign out')
    }
  }, [])

  /**
   * Focus the prompt and clear it for a fresh custom build.
   */
  const handleNewProject = useCallback(() => {
    setPrompt('')
    textareaRef.current?.focus()
  }, [])

  /**
   * Delete a saved project from cloud or local storage.
   * @param projectId Saved project id.
   */
  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      setErrorMessage(null)
      try {
        if (session && cloudSyncEnabled) {
          const supabase = createSupabaseBrowserClient()
          await deleteCloudUserProject(supabase, projectId)
          await refreshProjects(true)
          return
        }

        removeUserProject(projectId)
        setProjects(loadUserProjects())
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to delete project')
      }
    },
    [cloudSyncEnabled, refreshProjects, session],
  )

  return (
    <div className="flex min-h-[100dvh] flex-col md:flex-row" style={{ background: 'var(--bg-base)' }}>
      <BuilderSidebar
        authEnabled={authEnabled}
        session={session}
        projects={projects}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={handleSignOut}
        onOpenProject={handleOpenProject}
        onNewProject={handleNewProject}
        onDeleteProject={handleDeleteProject}
      />

      <main className="relative flex min-w-0 flex-1 flex-col items-center justify-start overflow-hidden px-4 py-8 sm:px-6 md:justify-center md:py-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 50% 12%, rgba(214,51,108,0.12), transparent 34%), radial-gradient(circle at 18% 28%, rgba(255,255,255,0.55), transparent 22%)',
          }}
        />

        <div className="relative w-full max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 sm:mb-8">
            {/* <Image src={brand.assets.icon} alt="" width={24} height={24} /> */}
            <span className="text-lg font-extrabold tracking-[-0.05em] sm:text-xl">{brand.name}</span>
          </div>

          <h1 className="mx-auto max-w-[11ch] text-4xl font-extrabold leading-[0.98] tracking-[-0.04em] min-[390px]:text-5xl sm:max-w-none sm:text-6xl sm:tracking-[-0.06em]">
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
            className="relative mx-auto mt-8 w-full max-w-xl rounded-[24px] p-3 text-left sm:mt-10 sm:rounded-[28px] sm:p-4"
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
              className="relative z-[1] min-h-[112px] w-full resize-none bg-transparent text-base font-medium leading-7 outline-none sm:text-lg"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Describe your hardware project"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSubmitPrompt()
                }
              }}
            />

            <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div ref={modelMenuRef} className="relative min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setModelMenuOpen((open) => {
                      const nextOpen = !open
                      if (nextOpen) setReasoningMenuOpen(false)
                      return nextOpen
                    })
                  }}
                  className="inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/[0.03] sm:w-auto"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  aria-expanded={modelMenuOpen}
                  aria-haspopup="listbox"
                >
                  {selectedModel.shortLabel} {selectedReasoning.label}
                  <ChevronDown size={14} />
                </button>

                {modelMenuOpen && (
                  <div className="absolute bottom-full left-0 right-0 z-10 mb-2 flex flex-col items-stretch gap-2 sm:right-auto sm:flex-row sm:items-end">
                    <div
                      role="listbox"
                      aria-label="Model"
                      className="w-full overflow-hidden rounded-[22px] p-2 sm:w-[240px]"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-soft)',
                      }}
                    >
                      <div
                        className="px-3 py-2 text-[13px] font-semibold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Model
                      </div>
                      {USER_MODEL_OPTIONS.map((model) => {
                        const selected = model.id === selectedModelId
                        return (
                          <button
                            key={model.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => handleSelectModel(model)}
                            className="flex h-11 w-full items-center justify-between rounded-2xl px-3 text-left text-sm font-semibold transition-colors hover:bg-black/[0.04]"
                            style={{
                              background: selected ? 'rgba(214,51,108,0.10)' : 'transparent',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {model.label}
                            {selected && <Check size={17} style={{ color: brand.colors.berry }} />}
                          </button>
                        )
                      })}
                    </div>

                    {reasoningMenuOpen && (
                      <div
                        role="listbox"
                        aria-label="Reasoning"
                        className="w-full overflow-hidden rounded-[22px] p-2 sm:w-[218px]"
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          boxShadow: 'var(--shadow-soft)',
                        }}
                      >
                        <div
                          className="px-3 py-2 text-[13px] font-semibold"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Reasoning
                        </div>
                        {USER_REASONING_OPTIONS.map((reasoning) => {
                          const selected = reasoning.id === selectedReasoningId
                          return (
                            <button
                              key={reasoning.id}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => handleSelectReasoning(reasoning)}
                              className="flex h-11 w-full items-center justify-between rounded-2xl px-3 text-left text-sm font-semibold transition-colors hover:bg-black/[0.04]"
                              style={{
                                background: selected ? 'rgba(214,51,108,0.10)' : 'transparent',
                                color: 'var(--text-primary)',
                              }}
                            >
                              {reasoning.label}
                              {selected && (
                                <Check size={17} style={{ color: brand.colors.berry }} />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSubmitPrompt}
                disabled={bootstrapping || prompt.trim().length === 0}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 sm:w-11"
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

          <div className="mt-8 sm:mt-10">
            <div className="flex snap-x gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:items-center sm:justify-center sm:overflow-visible sm:pb-0">
              {BUILDER_TEMPLATES.map((template) => {
                const Icon = template.icon
                return (
                  <button
                    key={template.id}
                    type="button"
                    disabled={bootstrapping}
                    onClick={() => handleTemplateSelect(template.id)}
                    className="inline-flex shrink-0 snap-start items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/[0.03] disabled:opacity-50"
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
        onGoogleSignIn={handleGoogleSignIn}
        onEmailSignIn={handleEmailSignIn}
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
