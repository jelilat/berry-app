'use client'

import Image from 'next/image'
import {
  Cpu,
  Home,
  LogIn,
  LogOut,
  Plus,
} from 'lucide-react'
import { brand } from '@/lib/brand'
import type { AuthSession } from '@/lib/auth/session'
import type { UserProjectEntry } from '@/lib/projects/user-projects'

/**
 * Left rail for the builder home: navigation, projects, and auth actions.
 * @param props Sidebar state and callbacks.
 */
export function BuilderSidebar({
  authEnabled,
  session,
  projects,
  onSignIn,
  onSignOut,
  onOpenProject,
  onNewProject,
}: {
  authEnabled: boolean
  session: AuthSession | null
  projects: UserProjectEntry[]
  onSignIn: () => void
  onSignOut: () => void
  onOpenProject: (projectId: string) => void
  onNewProject: () => void
}) {
  return (
    <aside
      className="flex w-[248px] shrink-0 flex-col border-r px-3 py-4"
      style={{
        background: 'var(--bg-overlay)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="mb-6 flex items-center gap-2 px-2">
        <Image src={brand.assets.icon} alt="" width={22} height={22} />
        <span className="text-sm font-extrabold tracking-[-0.04em]">{brand.name}</span>
      </div>

      <nav className="space-y-1">
        <SidebarButton active icon={Home} label="Home" />
      </nav>

      <div className="mt-8 px-2">
        <p
          className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: 'var(--text-muted)' }}
        >
          Projects
        </p>

        {authEnabled && session ? (
          <>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Your projects
              </span>
              <button
                type="button"
                onClick={onNewProject}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                aria-label="New project"
                style={{ color: 'var(--text-muted)' }}
              >
                <Plus size={15} />
              </button>
            </div>

            <div className="space-y-1">
              {projects.length === 0 ? (
                <p className="rounded-xl px-3 py-2 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                  Nothing saved yet — pick a starter bench below or describe a build in the prompt.
                </p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-black/[0.04]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Cpu size={14} style={{ color: 'var(--text-muted)' }} />
                    <span className="truncate">{project.name}</span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : authEnabled ? (
          <p className="rounded-xl px-3 py-2 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
            Sign in to see your projects.
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Local projects
              </span>
              <button
                type="button"
                onClick={onNewProject}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                aria-label="New project"
                style={{ color: 'var(--text-muted)' }}
              >
                <Plus size={15} />
              </button>
            </div>

            <div className="space-y-1">
              {projects.length === 0 ? (
                <p className="rounded-xl px-3 py-2 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                  Projects save in this browser.
                </p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onOpenProject(project.id)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-black/[0.04]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <Cpu size={14} style={{ color: 'var(--text-muted)' }} />
                    <span className="truncate">{project.name}</span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-auto space-y-2 px-2 pt-6">
        {/* <a
          href="https://berry.studio"
          className="inline-flex items-center gap-2 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <MessageSquare size={14} />
          Feedback
        </a> */}

        {!authEnabled ? null : session ? (
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/[0.04]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #F05F8D 0%, #D6336C 55%, #A61E4D 100%)',
              boxShadow: '0 12px 28px rgba(214,51,108,0.22)',
            }}
          >
            <LogIn size={15} />
            Sign in
          </button>
        )}
      </div>
    </aside>
  )
}

/**
 * Render one sidebar navigation button.
 * @param props Button label, icon, and active state.
 */
function SidebarButton({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof Home
  label: string
  active?: boolean
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
      style={{
        background: active ? 'rgba(255,255,255,0.72)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        boxShadow: active ? 'inset 0 0 0 1px var(--border)' : undefined,
      }}
    >
      <Icon size={16} />
      {label}
    </div>
  )
}
