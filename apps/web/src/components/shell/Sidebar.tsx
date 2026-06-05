/**
 * Sidebar — chat history (Today) + role-appropriate canvas tiles.
 *
 * Sections:
 *  - "+ New conversation" button → ChatContext.newThread()
 *  - "Today" — recent chat threads from ChatContext; click switches active
 *  - Dashboards / Workflows / Tools — tiles filtered by user.role from
 *    moduleRegistry; click → ChatContext.openCanvas()
 */

import {
  Plus,
  MessageSquare,
  LayoutDashboard,
  Wrench,
  Workflow,
  // — icon registry below resolves the rest by name —
} from 'lucide-react'
import * as Lucide from 'lucide-react'
import { useMemo, type ComponentType } from 'react'
import { useChat } from '../../context/ChatContext.js'
import { useAuth } from '../../context/AuthContext.js'
import { useApp } from '../../context/AppContext.js'
import { modulesForRole, type ModuleEntry, type SidebarGroup } from '../../nlp/moduleRegistry.js'

type IconProps = { className?: string }
type IconComponent = ComponentType<IconProps>

function iconByName(name: string): IconComponent {
  const lib = Lucide as unknown as Record<string, IconComponent>
  return lib[name] ?? LayoutDashboard
}

const GROUP_META: Record<SidebarGroup, { icon: IconComponent; label: string }> = {
  Dashboards: { icon: LayoutDashboard, label: 'Dashboards' },
  Workflows: { icon: Workflow, label: 'Workflows' },
  Tools: { icon: Wrench, label: 'Tools' },
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function Sidebar() {
  const { threads, currentThread, newThread, openThread, openCanvas } = useChat()
  const { user } = useAuth()
  const { lang } = useApp()

  const modules = useMemo<ModuleEntry[]>(
    () => (user ? modulesForRole(user.role) : []),
    [user],
  )

  const grouped = useMemo(() => {
    const out: Record<SidebarGroup, ModuleEntry[]> = {
      Dashboards: [],
      Workflows: [],
      Tools: [],
    }
    for (const m of modules) out[m.sidebarGroup].push(m)
    return out
  }, [modules])

  return (
    <aside className="w-[260px] flex-shrink-0 border-r border-bdr-light bg-surface-secondary hidden md:flex md:flex-col">
      {/* New conversation */}
      <div className="px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={newThread}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-pill bg-primary text-white font-bold text-[13px] shadow-modal active:opacity-80 hover:bg-primary-dark transition"
        >
          <Plus className="w-4 h-4" />
          New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {/* Today — chat threads */}
        <section>
          <SectionHeader icon={MessageSquare} label="Today" />
          <ul className="space-y-0.5">
            {threads.length === 0 ? (
              <li className="px-2 py-3 text-[11px] text-txt-tertiary leading-relaxed">
                No conversations yet. Ask Saathi anything to begin.
              </li>
            ) : (
              threads.slice(0, 10).map((t) => {
                const active = currentThread?.id === t.id
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openThread(t.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-2xl flex items-start gap-2 transition ${
                        active
                          ? 'bg-primary-light text-primary'
                          : 'hover:bg-white text-txt-primary'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-70" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium truncate">{t.title}</div>
                        <div className="text-[10px] text-txt-tertiary mt-0.5">
                          {relTime(t.lastMessageAt)}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </section>

        {/* Dashboards / Workflows / Tools — role-appropriate tiles */}
        {(['Dashboards', 'Workflows', 'Tools'] as SidebarGroup[]).map((g) => {
          const items = grouped[g]
          if (items.length === 0) return null
          const meta = GROUP_META[g]
          return (
            <section key={g}>
              <SectionHeader icon={meta.icon} label={meta.label} />
              <ul className="space-y-0.5">
                {items.map((m) => {
                  const Icon = iconByName(m.icon)
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => openCanvas(m.id)}
                        className="w-full text-left px-2.5 py-2 rounded-2xl flex items-center gap-2 text-txt-primary hover:bg-white transition group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-primary-light text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-[12px] font-medium truncate">
                          {m.label[lang] ?? m.label.en}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </aside>
  )
}

function SectionHeader({
  icon: Icon,
  label,
}: {
  icon: IconComponent
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 mb-1.5">
      <Icon className="w-3 h-3 text-txt-tertiary" />
      <span className="text-[10px] uppercase tracking-wider text-txt-tertiary font-bold">
        {label}
      </span>
    </div>
  )
}
