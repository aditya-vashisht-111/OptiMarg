'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { Maximize2, Minimize2, MapPin, Route as RouteIcon, Truck, Ship } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, Skeleton } from '@/components/ui/primitives'
import { StatusBadge } from '@/components/plate'
import { LOCATIONS, type VehicleTelemetry } from '@/lib/fleet'
import { cn } from '@/lib/utils'

const FleetMap = dynamic(() => import('@/components/fleet-map'), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-muted/40">
      <Skeleton className="size-full" />
    </div>
  ),
})

export function SpatialView({
  fleet,
  onInspect,
  onEta,
}: {
  fleet: VehicleTelemetry[]
  onInspect: (id: string) => void
  onEta: (id: string) => void
}) {
  const [full, setFull] = React.useState(false)

  const transit = fleet.filter((v) => v.status === 'In-Transit')

  return (
    <div
      className={cn(
        full
          ? 'fixed inset-0 z-50 flex flex-col bg-background p-4'
          : 'flex flex-col gap-4',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Spatial Telemetry & Corridors
          </h2>
          <p className="text-xs text-muted-foreground">
            Live vehicle positions across Indian logistics hubs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="transit">
            <span className="size-1.5 rounded-full bg-transit" />
            {transit.length} in transit
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setFull((v) => !v)}>
            {full ? <Minimize2 /> : <Maximize2 />}
            {full ? 'Exit fullscreen' : 'Popout map'}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'grid gap-4',
          full ? 'min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_300px]' : 'grid-cols-1 lg:grid-cols-[1fr_300px]',
        )}
      >
        <Card className="overflow-hidden">
          <div className={cn('w-full', full ? 'h-[calc(100vh-8rem)]' : 'h-[560px]')}>
            <FleetMap fleet={fleet} onInspect={onInspect} onEta={onEta} />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="size-4 text-primary" /> Regional Hubs
            </div>
            <ul className="flex flex-col gap-2">
              {LOCATIONS.map((loc) => {
                const here = fleet.filter(
                  (v) => v.origin === loc || v.destination === loc,
                ).length
                return (
                  <li
                    key={loc}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-foreground">{loc}</span>
                    <span className="text-xs text-muted-foreground">{here} linked</span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card className="min-h-0 flex-1 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <RouteIcon className="size-4 text-primary" /> Active Corridors
            </div>
            <ul className="flex max-h-[280px] flex-col gap-2 overflow-auto pr-1">
              {transit.length === 0 && (
                <li className="text-xs text-muted-foreground">No active transits.</li>
              )}
              {transit.map((v) => (
                <li
                  key={v.vehicleId}
                  className="rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
                      {v.assetType === 'ship' ? (
                        <Ship className="size-3.5 text-primary" />
                      ) : (
                        <Truck className="size-3.5 text-primary" />
                      )}
                      {v.vehicleId}
                    </span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {v.origin} → {v.destination} · {Math.round(v.progress)}%
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
