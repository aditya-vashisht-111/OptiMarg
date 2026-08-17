'use client'

import * as React from 'react'
import {
  LayoutDashboard,
  Map,
  ClipboardList,
  Search,
  Clock,
  Settings,
  Radar,
  Waypoints,
  MessagesSquare,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewId = 'overview' | 'spatial' | 'optimization' | 'dispatch' | 'inspector' | 'eta' | 'admin' | 'query'

export const NAV: {
  id: ViewId
  label: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'overview', label: 'Command Overview', desc: 'Fleet KPIs & status board', icon: LayoutDashboard },
  { id: 'spatial', label: 'Spatial Telemetry', desc: 'Live corridors & map', icon: Map },
  { id: 'optimization', label: 'Optimization Center', desc: 'OR-Tools route solver', icon: Waypoints },
  { id: 'dispatch', label: 'Dispatch & Trips', desc: 'Create assignments', icon: ClipboardList },
  { id: 'inspector', label: 'Vehicle Inspector', desc: 'Unit telemetry lookup', icon: Search },
  { id: 'eta', label: 'ML ETA Engine', desc: 'Arrival predictions', icon: Clock },
  { id: 'admin', label: 'Admin & Data Hub', desc: 'Exports & utilities', icon: Settings },
  { id: 'query', label: 'Query Assistant', desc: 'Ask anything about the fleet', icon: MessagesSquare },
]

export function Sidebar({
  active,
  onSelect,
  collapsed,
  onToggle,
}: {
  active: ViewId
  onSelect: (v: ViewId) => void
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Radar className="size-5" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-xl font-bold tracking-tight text-sidebar-foreground">
              OptiMarg
            </div>
            <div className="truncate text-[11px] text-muted-foreground">Command Center</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => {
          const isActive = active === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
              )}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
                  isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
              </span>
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium leading-tight">
                    {item.label}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {item.desc}
                  </span>
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer: backend health + collapse */}
      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            'mb-2 flex items-center gap-2 rounded-lg border border-sidebar-border bg-card px-2.5 py-2',
            collapsed && 'justify-center px-0',
          )}
        >
          <span className="relative flex size-2.5 items-center justify-center">
            <span className="fp-pulse absolute inline-flex size-2.5 rounded-full text-nominal" />
            <span className="relative size-2 rounded-full bg-nominal" />
          </span>
          {!collapsed && <span className="text-xs font-medium text-foreground">Backend online</span>}
        </div>
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  )
}
