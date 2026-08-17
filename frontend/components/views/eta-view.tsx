'use client'

import * as React from 'react'
import { Clock, Zap, TrendingUp, Gauge, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Input, Label, Progress, Select, Skeleton } from '@/components/ui/primitives'
import { Plate } from '@/components/plate'
import { runEta, FLEET_IDS, type EtaResult } from '@/lib/fleet'
import { useToast } from '@/components/toast'

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 text-primary" /> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  )
}

export function EtaView({ initialId }: { initialId?: string | null }) {
  const toast = useToast()
  const [vehicleId, setVehicleId] = React.useState(initialId ?? 'VEH_001')
  const [result, setResult] = React.useState<EtaResult | null>(null)
  const [loading, setLoading] = React.useState(false)

  const run = React.useCallback(
    async (id: string) => {
      const clean = id.trim().toUpperCase()
      if (!clean) return
      setLoading(true)
      try {
        const r = await runEta(clean)
        setResult(r)
        toast.success('ETA computed', `${clean} · ${r.predictedMinutes} min predicted`)
      } catch {
        toast.error('ETA failed', 'Could not run the prediction engine.')
      } finally {
        setLoading(false)
      }
    },
    [toast],
  )

  React.useEffect(() => {
    if (initialId) {
      setVehicleId(initialId)
      run(initialId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId])

  const delayPct = result
    ? Math.min(100, Math.round((result.predictedMinutes / result.nominalMinutes) * 100))
    : 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Machine Learning ETA Engine
        </h2>
        <p className="text-xs text-muted-foreground">
          Predicted arrival, traffic factor and model confidence
        </p>
      </div>

      <Plate title="Run Prediction" description="POST /eta/output" icon={Clock} modalSize="lg" bodyClassName="min-h-[380px]">
        <div className="flex flex-col gap-5 p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run(vehicleId)
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="eta-veh">Vehicle ID</Label>
              <Input
                id="eta-veh"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value.toUpperCase())}
                placeholder="VEH_001"
                className="font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:w-44">
              <Label htmlFor="eta-quick">Quick select</Label>
              <Select
                id="eta-quick"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                {FLEET_IDS.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={loading}>
              <Zap /> {loading ? 'Predicting…' : 'Predict ETA'}
            </Button>
          </form>

          {loading && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          )}

          {!loading && result && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={Timer} label="Predicted Duration" value={`${result.predictedMinutes} min`} sub={`${(result.predictedMinutes / 60).toFixed(1)} hours`} />
                <StatCard icon={Clock} label="Estimated Arrival" value={result.eta} />
                <StatCard icon={Gauge} label="Traffic Delay Factor" value={`${result.trafficDelayFactor}×`} sub={result.trafficDelayFactor > 1.3 ? 'Heavy congestion' : 'Light traffic'} />
                <StatCard icon={TrendingUp} label="Confidence Score" value={`${Math.round(result.confidence * 100)}%`} sub="Model certainty" />
              </div>

              <Card className="p-4">
                <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Nominal vs. Estimated</span>
                  <span className="text-foreground">
                    +{result.predictedMinutes - result.nominalMinutes} min delay
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>Nominal</span>
                      <span>{result.nominalMinutes} min</span>
                    </div>
                    <Progress value={Math.min(100, (result.nominalMinutes / result.predictedMinutes) * 100)} tone="nominal" />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>Estimated</span>
                      <span>{result.predictedMinutes} min</span>
                    </div>
                    <Progress value={delayPct} tone="transit" />
                  </div>
                </div>
              </Card>
            </>
          )}

          {!loading && !result && (
            <div className="flex flex-col items-center gap-1 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Clock className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No prediction yet</p>
              <p className="text-xs text-muted-foreground">Select a unit and run the ETA engine.</p>
            </div>
          )}
        </div>
      </Plate>
    </div>
  )
}
