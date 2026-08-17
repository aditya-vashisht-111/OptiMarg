'use client'

import * as React from 'react'
import { Search, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Modal } from '@/components/ui/primitives'
import { Plate } from '@/components/plate'
import { VehicleDetail } from '@/components/vehicle-detail'
import {
  getVehicle,
  VEHICLE_ID_PATTERN,
  FLEET_IDS,
  type VehicleTelemetry,
} from '@/lib/fleet'
import { useToast } from '@/components/toast'

export function InspectorView({
  initialId,
  onEta,
}: {
  initialId?: string | null
  onEta: (id: string) => void
}) {
  const toast = useToast()
  const [query, setQuery] = React.useState(initialId ?? '')
  const [vehicle, setVehicle] = React.useState<VehicleTelemetry | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [popout, setPopout] = React.useState(false)

  const search = React.useCallback(
    async (raw: string) => {
      const id = raw.trim().toUpperCase()
      if (!id) return
      if (!VEHICLE_ID_PATTERN.test(id)) {
        toast.error('Invalid unit ID', 'Format must be VEH_### (e.g. VEH_001).')
        return
      }
      setLoading(true)
      try {
        const v = await getVehicle(id)
        setVehicle(v)
      } catch {
        toast.error('Lookup failed', 'Could not reach the fleet backend.')
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  React.useEffect(() => {
    if (initialId) {
      setQuery(initialId)
      search(initialId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Intelligent Vehicle Inspector
        </h2>
        <p className="text-xs text-muted-foreground">
          Curated, high-value telemetry for any fleet unit
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          search(query)
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search unit ID — e.g. VEH_001"
            className="pl-9 font-mono uppercase"
            aria-label="Vehicle ID"
          />
        </div>
        <Button type="submit" disabled={loading}>
          <Search /> {loading ? 'Searching…' : 'Inspect Unit'}
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        <span className="mr-1 text-[11px] text-muted-foreground">Quick:</span>
        {FLEET_IDS.slice(0, 6).map((id) => (
          <button
            key={id}
            onClick={() => {
              setQuery(id)
              search(id)
            }}
            className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          >
            {id}
          </button>
        ))}
      </div>

      <Plate
        title="Unit Telemetry"
        description={vehicle ? vehicle.vehicleId : 'Awaiting search'}
        icon={Search}
        modalSize="lg"
        actions={
          vehicle ? (
            <Button variant="outline" size="sm" onClick={() => setPopout(true)}>
              <ExternalLink /> Dedicated window
            </Button>
          ) : undefined
        }
        bodyClassName="min-h-[420px]"
      >
        <VehicleDetail vehicle={vehicle} loading={loading} onEta={onEta} />
      </Plate>

      <Modal
        open={popout}
        onClose={() => setPopout(false)}
        title={vehicle ? `${vehicle.vehicleId} — Telemetry` : 'Telemetry'}
        description="Dedicated inspection window"
        size="lg"
      >
        <VehicleDetail vehicle={vehicle} onEta={onEta} />
      </Modal>
    </div>
  )
}
