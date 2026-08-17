'use client'

import * as React from 'react'
import { ClipboardList, Route, Check, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Badge,
  Card,
  Input,
  Label,
  Select,
  Switch,
} from '@/components/ui/primitives'
import { Plate } from '@/components/plate'
import {
  LOCATIONS,
  HUB_COORDS,
  VEHICLE_ID_PATTERN,
  haversineKm,
  createEntry,
  BackendUnreachableError,
  type Location,
} from '@/lib/fleet'
import { useToast } from '@/components/toast'

interface Dispatch {
  vehicle_id: string
  assignment_id: string
  origin: Location
  destination: Location
  confirmed: boolean
  at: string
  queued?: boolean
}

export function DispatchView() {
  const toast = useToast()
  const [vehicleId, setVehicleId] = React.useState('VEH_001')
  const [assignmentId, setAssignmentId] = React.useState('ASN_1001')
  const [origin, setOrigin] = React.useState<Location>('Delhi')
  const [destination, setDestination] = React.useState<Location>('Mumbai')
  const [confirmed, setConfirmed] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [recent, setRecent] = React.useState<Dispatch[]>([])

  const vehicleValid = VEHICLE_ID_PATTERN.test(vehicleId)
  const assignmentValid = assignmentId.length >= 1 && assignmentId.length <= 20
  const sameHub = origin === destination
  const distance = React.useMemo(
    () => (sameHub ? 0 : haversineKm(HUB_COORDS[origin], HUB_COORDS[destination])),
    [origin, destination, sameHub],
  )
  const estHours = distance ? (distance / 52).toFixed(1) : '0'

  const canSubmit = vehicleValid && assignmentValid && !sameHub && !submitting

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    const record = (queued: boolean) =>
      setRecent((prev) =>
        [
          {
            vehicle_id: vehicleId,
            assignment_id: assignmentId,
            origin,
            destination,
            confirmed,
            at: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            queued,
          },
          ...prev,
        ].slice(0, 8),
      )
    try {
      await createEntry({
        vehicle_id: vehicleId,
        assignment_id: assignmentId,
        assignment_confirmed: confirmed,
        origin_location: origin,
        destination_location: destination,
      })
      toast.success('Dispatch created', `${vehicleId} · ${origin} → ${destination}`)
      record(false)
    } catch (err) {
      if (err instanceof BackendUnreachableError) {
        // Backend asleep/offline: queue locally so the flow still demonstrates.
        toast.info('Queued offline', `Backend unreachable · ${vehicleId} held in local queue`)
        record(true)
      } else {
        toast.error('Dispatch failed', err instanceof Error ? err.message : 'Unknown error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Dispatch & Trip Management
        </h2>
        <p className="text-xs text-muted-foreground">
          Assign a unit to a logistics corridor
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Plate title="New Assignment" description="POST /create/entry" icon={ClipboardList} modalSize="md">
          <form onSubmit={submit} className="flex flex-col gap-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="veh">Vehicle ID</Label>
                <Input
                  id="veh"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value.toUpperCase())}
                  placeholder="VEH_001"
                  className="font-mono"
                  aria-invalid={vehicleId.length > 0 && !vehicleValid}
                />
                {vehicleId.length > 0 && !vehicleValid && (
                  <span className="text-[11px] text-destructive">Must match VEH_### (e.g. VEH_001)</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="asn">Assignment ID</Label>
                <Input
                  id="asn"
                  value={assignmentId}
                  onChange={(e) => setAssignmentId(e.target.value)}
                  placeholder="ASN_1234"
                  className="font-mono"
                  maxLength={20}
                  aria-invalid={assignmentId.length > 0 && !assignmentValid}
                />
                <span className="text-[11px] text-muted-foreground">{assignmentId.length}/20 chars</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="origin">Origin Hub</Label>
                <Select id="origin" value={origin} onChange={(e) => setOrigin(e.target.value as Location)}>
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dest">Destination Hub</Label>
                <Select id="dest" value={destination} onChange={(e) => setDestination(e.target.value as Location)}>
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </Select>
              </div>
            </div>

            {sameHub && (
              <span className="text-[11px] text-destructive">Origin and destination must differ.</span>
            )}

            {/* Route summary preview */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Route className="size-4 text-primary" />
                {origin} → {destination}
              </div>
              <Badge tone="brand">{distance} km</Badge>
              <Badge tone="transit">~{estHours}h transit</Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <Label htmlFor="confirm">Assignment Confirmed</Label>
                <p className="text-[11px] text-muted-foreground">Toggle to lock the dispatch on submit</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {confirmed ? 'Confirmed' : 'Pending'}
                </span>
                <Switch id="confirm" checked={confirmed} onCheckedChange={setConfirmed} />
              </div>
            </div>

            <Button type="submit" disabled={!canSubmit} className="self-start">
              <Send /> {submitting ? 'Dispatching…' : 'Create Dispatch'}
            </Button>
          </form>
        </Plate>

        <Plate title="Recent Dispatches" description="This session" icon={Check} modalSize="md">
          <div className="flex flex-col gap-2 p-5">
            {recent.length === 0 && (
              <div className="flex flex-col items-center gap-1 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No dispatches yet</p>
                <p className="text-xs text-muted-foreground">Created assignments appear here.</p>
              </div>
            )}
            {recent.map((d, i) => (
              <div
                key={`${d.assignment_id}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">{d.vehicle_id}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{d.assignment_id}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{d.origin} → {d.destination}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={d.queued ? 'neutral' : d.confirmed ? 'nominal' : 'transit'}>
                    {d.queued ? 'Queued' : d.confirmed ? 'Confirmed' : 'Pending'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{d.at}</span>
                </div>
              </div>
            ))}
          </div>
        </Plate>
      </div>
    </div>
  )
}
