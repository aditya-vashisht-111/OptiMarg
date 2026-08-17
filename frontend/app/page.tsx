'use client'

import * as React from 'react'
import { Menu, Radar } from 'lucide-react'
import { ToastProvider } from '@/components/toast'
import { Sidebar, NAV, type ViewId } from '@/components/sidebar'
import { OverviewView } from '@/components/views/overview-view'
import { SpatialView } from '@/components/views/spatial-view'
import { OptimizationView } from '@/components/views/optimization-view'
import { DispatchView } from '@/components/views/dispatch-view'
import { InspectorView } from '@/components/views/inspector-view'
import { EtaView } from '@/components/views/eta-view'
import { AdminView } from '@/components/views/admin-view'
import { QueryView } from '@/components/views/query-view'
import { LoginView } from '@/components/login-view'
import { useFleet } from '@/components/use-fleet'
import { pingBackend } from '@/lib/fleet'
import { cn } from '@/lib/utils'

function CommandCenter() {
  const [view, setView] = React.useState<ViewId>('overview')
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [online, setOnline] = React.useState<boolean | null>(null)

  // Cross-view navigation targets (e.g. from a map popup to inspector/eta)
  const [inspectId, setInspectId] = React.useState<string | null>(null)
  const [etaId, setEtaId] = React.useState<string | null>(null)

  const fleet = useFleet()

  React.useEffect(() => {
    let active = true
    const check = async () => {
      const ok = await pingBackend()
      if (active) setOnline(ok)
    }
    check()
    const t = setInterval(check, 30000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [])

  const goInspect = React.useCallback((id: string) => {
    setInspectId(id)
    setView('inspector')
    setMobileOpen(false)
  }, [])

  const goEta = React.useCallback((id: string) => {
    setEtaId(id)
    setView('eta')
    setMobileOpen(false)
  }, [])

  const select = (v: ViewId) => {
    setView(v)
    setMobileOpen(false)
  }

  const current = NAV.find((n) => n.id === view)

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          active={view}
          onSelect={select}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative animate-in slide-in-from-left">
            <Sidebar
              active={view}
              onSelect={select}
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/70 px-4 backdrop-blur md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2 md:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Radar className="size-4" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {current?.label}
            </h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              OptiMarg · Autonomous Fleet Intelligence & Logistics Command Center
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-nominal/25 bg-nominal/10 px-2.5 py-1 text-[11px] font-medium text-nominal">
              <span className="size-1.5 rounded-full bg-nominal" />
              Live
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          <div className="mx-auto max-w-[1400px]">
            {view === 'overview' && (
              <OverviewView
                fleet={fleet}
                online={online}
                onNavigate={select}
                onInspect={goInspect}
                onEta={goEta}
              />
            )}
            {view === 'spatial' && (
              <SpatialView fleet={fleet} onInspect={goInspect} onEta={goEta} />
            )}
            {view === 'optimization' && <OptimizationView fleet={fleet} />}
            {view === 'dispatch' && <DispatchView />}
            {view === 'inspector' && <InspectorView initialId={inspectId} onEta={goEta} />}
            {view === 'eta' && <EtaView initialId={etaId} />}
            {view === 'admin' && <AdminView />}
            {view === 'query' && <QueryView fleet={fleet} />}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function Page() {
  const [authed, setAuthed] = React.useState(false)

  return (
    <ToastProvider>
      {authed ? <CommandCenter /> : <LoginView onAuthenticated={() => setAuthed(true)} />}
    </ToastProvider>
  )
}
