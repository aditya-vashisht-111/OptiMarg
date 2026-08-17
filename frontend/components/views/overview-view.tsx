'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import {
  Truck,
  Ship,
  Send,
  MapPin,
  Activity,
  ArrowRight,
  ClipboardList,
  Search,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Skeleton } from '@/components/ui/primitives'
import { Plate, StatusBadge } from '@/components/plate'
import { LOCATIONS, type VehicleTelemetry } from '@/lib/fleet'
import type { ViewId } from '@/components/sidebar'
import { cn } from '@/lib/utils'

const FleetMap = dynamic(() => import('@/components/fleet-map'), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
})

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'brand',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  sub: string
  tone?: 'brand' | 'nominal' | 'transit' | 'alert'
}) {
  const toneMap = {
    brand: 'bg-primary/10 text-primary',
    nominal: 'bg-nominal/12 text-nominal',
    transit: 'bg-transit/18 text-transit-foreground',
    alert: 'bg-alert/12 text-alert',
  }
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </div>
        </div>
        <span className={cn('flex size-9 items-center justify-center rounded-xl', toneMap[tone])}>
          <Icon className="size-4.5" />
        </span>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">{sub}</div>
    </Card>
  )
}

export function OverviewView({
  fleet,
  online,
  onNavigate,
  onInspect,
  onEta,
}: {
  fleet: VehicleTelemetry[]
  online: boolean | null
  onNavigate: (v: ViewId) => void
  onInspect: (id: string) => void
  onEta: (id: string) => void
}) {
  const activeUnits = fleet.filter((v) => v.status !== 'Maintenance').length
  const dispatches = fleet.filter((v) => v.status === 'In-Transit').length
  const recent = [...fleet]
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 6)

  const quickActions: { id: ViewId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dispatch', label: 'New Dispatch', icon: ClipboardList },
    { id: 'inspector', label: 'Inspect Unit', icon: Search },
    { id: 'eta', label: 'Run ETA', icon: Clock },
    { id: 'spatial', label: 'Open Map', icon: MapPin },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">Command Overview</h2>
        <p className="text-xs text-muted-foreground">Live fleet posture across the network</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Truck} label="Live Active Fleet Units" value={activeUnits} sub={`${fleet.length} total registered`} tone="brand" />
        <Kpi icon={Send} label="Confirmed Active Dispatches" value={dispatches} sub="Currently in transit" tone="transit" />
        <Kpi icon={MapPin} label="Monitored Regional Hubs" value={LOCATIONS.length} sub={LOCATIONS.join(' · ')} tone="nominal" />
        <Kpi icon={Activity} label="Backend System Health" value="Online" sub="All systems operational" tone="nominal" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((a) => (
          <button
            key={a.id}
            onClick={() => onNavigate(a.id)}
            className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <a.icon className="size-4 text-primary" />
              {a.label}
            </span>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </div>

      {/* Multi-plate: map + status board */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Plate
          title="Live Grid Preview"
          description="Spatial telemetry across hubs"
          icon={MapPin}
          modalSize="full"
          actions={
            <Button variant="ghost" size="sm" onClick={() => onNavigate('spatial')}>
              Full view <ArrowRight />
            </Button>
          }
          bodyClassName="p-0"
        >
          <div className="h-[420px] w-full">
            <FleetMap fleet={fleet} onInspect={onInspect} onEta={onEta} />
          </div>
        </Plate>

        <Plate title="Recent Dispatch Status" description="Sorted by progress" icon={Activity} modalSize="md">
          <ul className="flex flex-col divide-y divide-border">
            {recent.map((v) => (
              <li key={v.vehicleId} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {v.assetType === 'ship' ? (
                      <Ship className="size-3.5 text-primary" />
                    ) : (
                      <Truck className="size-3.5 text-primary" />
                    )}
                    <button
                      onClick={() => onInspect(v.vehicleId)}
                      className="font-mono text-xs font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {v.vehicleId}
                    </button>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {v.origin} → {v.destination} · {Math.round(v.progress)}% · {v.speedKmh} km/h
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => onEta(v.vehicleId)} title="Run ETA">
                  <Clock className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Plate>
      </div>
    </div>
  )
}
