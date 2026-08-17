'use client'

import * as React from 'react'
import {
  Gauge,
  BatteryMedium,
  MapPin,
  User,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Zap,
  IdCard,
  Truck,
  Ship,
} from 'lucide-react'
import { Badge, Progress, Skeleton } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/plate'
import { ASSET_META, type VehicleTelemetry } from '@/lib/fleet'
import { cn } from '@/lib/utils'

function Gauge360({
  value,
  max,
  label,
  unit,
  tone,
}: {
  value: number
  max: number
  label: string
  unit: string
  tone: 'brand' | 'nominal' | 'transit' | 'alert'
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const toneColor = {
    brand: 'oklch(0.56 0.13 42)',
    nominal: 'oklch(0.55 0.11 155)',
    transit: 'oklch(0.7 0.13 68)',
    alert: 'oklch(0.55 0.18 25)',
  }[tone]
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-secondary/40 p-4">
      <div className="relative size-24">
        <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="oklch(0.9 0.012 75)" strokeWidth="7" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={toneColor}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (pct / 100) * c}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-foreground">{value}</span>
          <span className="text-[10px] text-muted-foreground">{unit}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  )
}

function CorridorSteps({ v }: { v: VehicleTelemetry }) {
  const steps = ['Origin', 'In Transit', 'Destination']
  const activeStep = v.status === 'Nominal' && v.progress === 0 ? 0 : v.progress >= 100 ? 2 : 1
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-medium text-foreground">
        <span>{v.origin}</span>
        <span className="text-muted-foreground">→</span>
        <span>{v.destination}</span>
      </div>
      <Progress value={v.progress} tone="transit" />
      <div className="mt-2 flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className={cn(
                'size-2 rounded-full',
                i <= activeStep ? 'bg-transit' : 'bg-border',
              )}
            />
            <span
              className={cn(
                'text-[11px]',
                i <= activeStep ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function VehicleDetail({
  vehicle,
  loading,
  onEta,
  compact,
}: {
  vehicle: VehicleTelemetry | null
  loading?: boolean
  onEta?: (id: string) => void
  compact?: boolean
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <IdCard className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No unit selected</p>
        <p className="text-xs text-muted-foreground">
          Search a vehicle ID (e.g. VEH_001) to view curated telemetry.
        </p>
      </div>
    )
  }

  const v = vehicle
  const meta = ASSET_META[v.assetType]
  const AssetIcon = v.assetType === 'ship' ? Ship : Truck
  const safety =
    v.safetyStatus === 'Safe'
      ? { tone: 'nominal' as const, Icon: ShieldCheck }
      : { tone: 'alert' as const, Icon: ShieldAlert }

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Identity & status plate */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 font-mono text-xs font-semibold text-primary">
            {v.vehicleId.replace('VEH_', '')}
          </span>
          <div>
            <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground">
              {v.vehicleId}
              <Badge tone="brand" className="gap-1 px-1.5 py-0 text-[10px]">
                <AssetIcon className="size-3" />
                {meta.label}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">{meta.regNoun} {v.registration}</div>
          </div>
        </div>
        <StatusBadge status={v.status} />
      </div>

      {/* Corridor journey */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <MapPin className="size-3.5" /> Corridor Journey
        </div>
        <CorridorSteps v={v} />
      </div>

      {/* Live telemetry gauges */}
      <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3')}>
        <Gauge360 value={v.speedKmh} max={meta.speedMax} label="Current Speed" unit="km/h" tone="transit" />
        <Gauge360 value={v.batteryPct} max={100} label="Battery / Fuel" unit="%" tone={v.batteryPct < 20 ? 'alert' : 'nominal'} />
        <div className={cn('flex flex-col justify-center gap-2 rounded-xl border border-border bg-secondary/40 p-4', compact && 'col-span-2')}>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3.5" /> GPS Coordinates
          </div>
          <div className="font-mono text-sm text-foreground">{v.lat.toFixed(4)}, {v.lng.toFixed(4)}</div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gauge className="size-3.5" /> {v.speedKmh} km/h ·{' '}
            <BatteryMedium className="size-3.5" /> {v.batteryPct}%
          </div>
        </div>
      </div>

      {/* Crew & vitals */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <User className="size-3.5" /> {meta.driverRole} & Vitals
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <div className="text-[11px] text-muted-foreground">{meta.driverRole}</div>
            <div className="text-sm font-medium text-foreground">{v.driverName}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">{meta.driverRole} ID</div>
            <div className="font-mono text-sm text-foreground">{v.driverId}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Duty Hours</div>
            <div className="flex items-center gap-1 text-sm font-medium text-foreground">
              <Clock className="size-3.5 text-muted-foreground" /> {v.dutyHours}h
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">Safety</div>
            <Badge tone={safety.tone}>
              <safety.Icon className="size-3" /> {v.safetyStatus}
            </Badge>
          </div>
        </div>
      </div>

      {onEta && (
        <Button onClick={() => onEta(v.vehicleId)} className="self-start">
          <Zap /> Run ML ETA prediction
        </Button>
      )}
    </div>
  )
}
