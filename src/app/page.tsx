import Image from 'next/image'
import { ArrowRight, Bot, Cable, Cpu, Sparkles, TerminalSquare, Wrench } from 'lucide-react'
import { brand } from '@/lib/brand'

const capabilities = [
  {
    title: 'AI-guided wiring',
    body: 'Translate an idea into a practical circuit with components, connections, and power considerations.',
    icon: Cable,
  },
  {
    title: 'Code and firmware help',
    body: 'Generate starter code for sensors, boards, and devices, then iterate as the build changes.',
    icon: TerminalSquare,
  },
  {
    title: 'Debugging support',
    body: 'Reason through wiring mistakes, component behavior, serial logs, and deployment issues.',
    icon: Wrench,
  },
]

const palette = [
  ['Berry', brand.colors.berry],
  ['Berry soft', brand.colors.berrySoft],
  ['Berry deep', brand.colors.berryDeep],
  ['Leaf', brand.colors.leaf],
  ['Leaf light', brand.colors.leafLight],
  ['Warm base', brand.colors.lightBase],
  ['Dark base', brand.colors.darkBase],
]

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 48% 8%, rgba(214,51,108,0.18), transparent 30%), radial-gradient(circle at 14% 34%, rgba(255,255,255,0.56), transparent 24%), linear-gradient(180deg, var(--bg-base) 0%, var(--bg-overlay) 100%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(23,21,20,0.08)_1px,transparent_1px)] [background-size:18px_18px] opacity-30" />

      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-5">
        <nav
          className="mx-auto flex w-full max-w-4xl items-center justify-between rounded-2xl px-5 py-3 backdrop-blur-xl"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}
        >
          <div className="flex items-center gap-3">
            <Image src={brand.assets.icon} alt="" width={34} height={34} priority />
            <span className="text-xl font-extrabold tracking-[-0.05em]">{brand.name}</span>
          </div>
          <span className="hidden rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] sm:inline-flex" style={{ color: 'var(--accent)', background: 'rgba(214,51,108,0.1)' }}>
            app.berry.studio
          </span>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <Sparkles size={16} style={{ color: 'var(--accent)' }} />
              Brand foundation for future Berry agents
            </div>
            <h1 className="max-w-4xl text-6xl font-extrabold leading-[0.92] tracking-[-0.06em] sm:text-7xl lg:text-8xl">
              Open-source AI agent for hardware development.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8" style={{ color: 'var(--text-secondary)' }}>
              {brand.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#brand-system"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #D6336C 0%, #A61E4D 100%)', boxShadow: '0 18px 40px rgba(214,51,108,0.28)' }}
              >
                View brand system
                <ArrowRight size={16} />
              </a>
              <a
                href="#what-berry-does"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              >
                What Berry does
              </a>
            </div>
          </div>

          <BrandWorkbench />
        </div>
      </section>

      <section id="what-berry-does" className="relative mx-auto max-w-7xl px-5 pb-10">
        <div className="grid gap-4 md:grid-cols-3">
          {capabilities.map(({ title, body, icon: Icon }) => (
            <article
              key={title}
              className="rounded-[28px] p-6"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(214,51,108,0.12)', color: 'var(--accent)' }}>
                <Icon size={22} />
              </div>
              <h2 className="text-xl font-extrabold tracking-[-0.03em]">{title}</h2>
              <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                {body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="brand-system" className="relative mx-auto max-w-7xl px-5 pb-16">
        <div
          className="grid gap-8 rounded-[32px] p-6 md:grid-cols-[0.85fr_1.15fr] md:p-8"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--accent)' }}>
              Brand memory
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.05em]">Use this as the source of truth.</h2>
            <p className="mt-4 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
              Berry should feel warm, precise, useful, and slightly playful: a hardware bench with an AI collaborator, not a generic SaaS dashboard.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {palette.map(([name, value]) => (
              <div key={name} className="rounded-2xl p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="h-20 rounded-xl" style={{ background: value }} />
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold">{name}</span>
                  <code className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {value}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function BrandWorkbench() {
  return (
    <div
      className="relative overflow-hidden rounded-[34px] p-5"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}
    >
      <div className="absolute right-8 top-8 h-32 w-32 rounded-full blur-3xl" style={{ background: 'rgba(214,51,108,0.2)' }} />
      <div className="relative flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        </div>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Hardware AI workbench
        </span>
      </div>

      <div className="relative mt-5 min-h-[460px] overflow-hidden rounded-[26px] p-5" style={{ background: 'var(--bg-elevated)' }}>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 620 460" preserveAspectRatio="none" aria-hidden="true">
          <path className="brand-wire" d="M96 150 C210 118 216 70 330 86" fill="none" stroke="rgba(214,51,108,0.45)" strokeWidth="3" />
          <path className="brand-wire" d="M304 292 C395 250 432 180 536 196" fill="none" stroke="rgba(214,51,108,0.36)" strokeWidth="3" />
          <path className="brand-wire" d="M176 330 C245 350 270 270 356 270" fill="none" stroke="rgba(15,168,134,0.38)" strokeWidth="3" />
        </svg>

        <div className="relative grid gap-4">
          <WorkbenchCard eyebrow="Idea" title="Smart planter" description="Moisture sensor, pump, status LED" icon={Bot} />
          <WorkbenchCard eyebrow="Circuit" title="Place, wire, test" description="Battery, resistor, switch, sensor" icon={Cpu} featured />
          <WorkbenchCard eyebrow="Deploy" title="Generate firmware" description="Board setup, readings, alerts" icon={TerminalSquare} />
        </div>

        <div className="brand-float absolute bottom-8 right-8 rounded-[28px] p-5 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}>
          <Image src={brand.assets.icon} alt="berry icon" width={86} height={86} />
          <p className="mt-3 text-sm font-extrabold tracking-[-0.04em]">{brand.name}</p>
        </div>
      </div>
    </div>
  )
}

function WorkbenchCard({
  eyebrow,
  title,
  description,
  icon: Icon,
  featured = false,
}: {
  eyebrow: string
  title: string
  description: string
  icon: typeof Bot
  featured?: boolean
}) {
  return (
    <div
      className="relative max-w-[280px] rounded-3xl p-4"
      style={{
        marginLeft: featured ? 'auto' : undefined,
        background: featured ? 'rgba(214,51,108,0.11)' : 'var(--bg-surface)',
        border: featured ? '1px solid rgba(214,51,108,0.38)' : '1px solid var(--border)',
        boxShadow: featured ? '0 20px 50px rgba(214,51,108,0.18)' : 'var(--shadow-soft)',
      }}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'var(--bg-elevated)', color: featured ? 'var(--accent)' : 'var(--leaf)' }}>
        <Icon size={20} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: featured ? 'var(--accent)' : 'var(--text-muted)' }}>
        {eyebrow}
      </p>
      <h3 className="mt-1 text-lg font-extrabold tracking-[-0.04em]">{title}</h3>
      <p className="mt-2 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
    </div>
  )
}
