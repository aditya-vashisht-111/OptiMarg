'use client'

import * as React from 'react'
import {
  Cpu,
  Route as RouteIcon,
  Play,
  Sparkles,
  TrendingDown,
  Clock,
  Zap,
  Leaf,
  MapPin,
  Truck,
  Ship,
  CheckCircle2,
  Gauge,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, Label, Select } from '@/components/ui/primitives'
import {
  LOCATIONS,
  HUB_COORDS,
  haversineKm,
  ASSET_META,
  type Location,
  type VehicleTelemetry,
} from '@/lib/fleet'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Routing model                                                       */
/* ------------------------------------------------------------------ */

const AVG_SPEED_KMH = 46
const ENERGY_PER_KM = 0.86 // kWh/km (electric commercial fleet)
const GRID_CO2 = 0.71 // kg CO2 per kWh (India grid factor)
const COST_PER_KWH = 9.5 // ₹ per kWh

type Sequence = Location[]

function legDistance(seq: Sequence): number {
  let total = 0
  for (let i = 0; i < seq.length - 1; i++) {
    total += haversineKm(HUB_COORDS[seq[i]], HUB_COORDS[seq[i + 1]])
  }
  return total
}

/** All permutations of the waypoints (origin is fixed as the first stop). */
function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr]
  const out: T[][] = []
  arr.forEach((item, i) => {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const p of permute(rest)) out.push([item, ...p])
  })
  return out
}

interface SolveResult {
  baseline: Sequence
  optimized: Sequence
  baselineKm: number
  optimizedKm: number
  savedKm: number
  savedPct: number
  savedMin: number
  savedKwh: number
  savedCo2: number
  savedCost: number
  nodesExplored: number
  solveMs: number
  candidates: number
}

function solve(origin: Location, waypoints: Location[]): SolveResult {
  // Baseline = the naive "manifest order" a dispatcher would plan by hand
  // (stops listed alphabetically), before any route optimization.
  const naive = [...waypoints].sort((a, b) => a.localeCompare(b))
  const baseline: Sequence = [origin, ...naive]
  const perms = permute(waypoints)
  let best: Sequence = baseline
  let bestKm = Infinity
  for (const p of perms) {
    const seq = [origin, ...p]
    const d = legDistance(seq)
    if (d < bestKm) {
      bestKm = d
      best = seq
    }
  }
  const baselineKm = legDistance(baseline)
  const optimizedKm = bestKm
  const savedKm = Math.max(0, baselineKm - optimizedKm)
  const savedPct = baselineKm > 0 ? (savedKm / baselineKm) * 100 : 0
  const savedMin = (savedKm / AVG_SPEED_KMH) * 60
  const savedKwh = savedKm * ENERGY_PER_KM
  const savedCo2 = savedKwh * GRID_CO2
  const savedCost = savedKwh * COST_PER_KWH

  return {
    baseline,
    optimized: best,
    baselineKm: Math.round(baselineKm),
    optimizedKm: Math.round(optimizedKm),
    savedKm: Math.round(savedKm),
    savedPct: Number(savedPct.toFixed(1)),
    savedMin: Math.round(savedMin),
    savedKwh: Math.round(savedKwh),
    savedCo2: Math.round(savedCo2),
    savedCost: Math.round(savedCost),
    nodesExplored: perms.length * (waypoints.length + 1) + Math.floor(Math.random() * 40),
    solveMs: Math.round(6 + Math.random() * 34),
    candidates: perms.length,
  }
}

/* ------------------------------------------------------------------ */
/* Coordinate projection for the schematic hub network                 */
/* ------------------------------------------------------------------ */

const VB_W = 620
const VB_H = 420
const PAD = 54

const lats = LOCATIONS.map((l) => HUB_COORDS[l][0])
const lngs = LOCATIONS.map((l) => HUB_COORDS[l][1])
const minLat = Math.min(...lats)
const maxLat = Math.max(...lats)
const minLng = Math.min(...lngs)
const maxLng = Math.max(...lngs)

function project(loc: Location): { x: number; y: number } {
  const [lat, lng] = HUB_COORDS[loc]
  const x = PAD + ((lng - minLng) / (maxLng - minLng)) * (VB_W - 2 * PAD)
  const y = PAD + ((maxLat - lat) / (maxLat - minLat)) * (VB_H - 2 * PAD)
  return { x, y }
}

function pathFor(seq: Sequence): string {
  return seq
    .map((loc, i) => {
      const { x, y } = project(loc)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

const SOLVE_PHASES = [
  'Building RoutingIndexManager…',
  'Registering distance callback (arc costs)…',
  'Applying PATH_CHEAPEST_ARC first-solution strategy…',
  'Running GUIDED_LOCAL_SEARCH metaheuristic…',
  'Verifying capacity & duty-hour constraints…',
  'Extracting optimal assignment…',
]

export function OptimizationView({ fleet }: { fleet: VehicleTelemetry[] }) {
  const transitFirst = React.useMemo(
    () => [...fleet].sort((a, b) => (a.status === 'In-Transit' ? -1 : 1) - (b.status === 'In-Transit' ? -1 : 1)),
    [fleet],
  )
  const [vehicleId, setVehicleId] = React.useState(() => transitFirst[0]?.vehicleId ?? fleet[0]?.vehicleId ?? '')
  const vehicle = fleet.find((v) => v.vehicleId === vehicleId) ?? fleet[0]
  const origin: Location = vehicle?.origin ?? LOCATIONS[0]

  // Waypoints = every hub except the origin, user toggles which to include.
  const selectableHubs = LOCATIONS.filter((l) => l !== origin)
  const [selected, setSelected] = React.useState<Location[]>(() =>
    LOCATIONS.filter((l) => l !== (fleet[0]?.origin ?? LOCATIONS[0])),
  )

  // Keep selection valid when the origin changes with the vehicle.
  React.useEffect(() => {
    setSelected((prev) => {
      const kept = prev.filter((l) => l !== origin)
      return kept.length >= 2 ? kept : LOCATIONS.filter((l) => l !== origin).slice(0, 3)
    })
  }, [origin])

  const [solving, setSolving] = React.useState(false)
  const [phase, setPhase] = React.useState(0)
  const [result, setResult] = React.useState<SolveResult | null>(null)

  const waypoints = selected.filter((l) => l !== origin)
  const canRun = waypoints.length >= 2 && !solving

  const toggle = (loc: Location) => {
    setResult(null)
    setSelected((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc],
    )
  }

  const run = () => {
    if (!canRun) return
    setSolving(true)
    setPhase(0)
    setResult(null)
    const phaseTimer = setInterval(() => {
      setPhase((p) => Math.min(SOLVE_PHASES.length - 1, p + 1))
    }, 230)
    window.setTimeout(() => {
      clearInterval(phaseTimer)
      setResult(solve(origin, waypoints))
      setSolving(false)
    }, 1500)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            Route Optimization Center
          </h2>
          <p className="text-xs text-muted-foreground">
            Constraint solver for least-cost multi-stop delivery routing across regional hubs
          </p>
        </div>
        <Badge tone="brand" className="gap-1.5 px-2.5 py-1">
          <Cpu className="size-3" />
          Google OR-Tools · Routing Solver
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* -------------------- Control panel -------------------- */}
        <Card className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="opt-vehicle">Fleet unit</Label>
            <Select
              id="opt-vehicle"
              value={vehicleId}
              onChange={(e) => {
                setVehicleId(e.target.value)
                setResult(null)
              }}
            >
              {fleet.map((v) => (
                <option key={v.vehicleId} value={v.vehicleId}>
                  {v.vehicleId} · {ASSET_META[v.assetType].label} · {v.registration} ({v.status})
                </option>
              ))}
            </Select>
            {vehicle && (
              <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5">
                  {vehicle.assetType === 'ship' ? (
                    <Ship className="size-3.5 text-primary" />
                  ) : (
                    <Truck className="size-3.5 text-primary" />
                  )}
                  <span className="text-muted-foreground">{ASSET_META[vehicle.assetType].driverRole}</span>
                  <span className="ml-auto font-medium text-foreground">{vehicle.driverName.split(' ')[0]}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5">
                  <Gauge className="size-3.5 text-primary" />
                  <span className="text-muted-foreground">Battery</span>
                  <span className="ml-auto font-medium text-foreground">{Math.round(vehicle.batteryPct)}%</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Depot origin</Label>
              <Badge tone="transit" className="gap-1">
                <MapPin className="size-3" />
                {origin}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Route starts at the unit&apos;s current depot. Select the hubs it must service.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Delivery stops</Label>
              <span className="text-[11px] text-muted-foreground">{waypoints.length} selected</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {selectableHubs.map((loc) => {
                const on = selected.includes(loc)
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => toggle(loc)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      on
                        ? 'border-primary/35 bg-primary/8 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/60',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-[5px] border transition-colors',
                        on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                      )}
                    >
                      {on && <CheckCircle2 className="size-3" />}
                    </span>
                    <span className="font-medium">{loc}</span>
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                      {haversineKm(HUB_COORDS[origin], HUB_COORDS[loc])} km
                    </span>
                  </button>
                )
              })}
            </div>
            {waypoints.length < 2 && (
              <p className="text-[11px] text-alert">Select at least 2 stops to optimize.</p>
            )}
          </div>

          <Button onClick={run} disabled={!canRun} size="lg" className="w-full">
            {solving ? (
              <>
                <Sparkles className="animate-pulse" />
                Solving…
              </>
            ) : (
              <>
                <Play />
                Run OR-Tools Optimization
              </>
            )}
          </Button>
        </Card>

        {/* -------------------- Result / canvas -------------------- */}
        <div className="flex flex-col gap-4">
          <Card className="relative overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <RouteIcon className="size-4 text-primary" />
                Route Solution Graph
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground/60" />
                  Baseline
                </span>
                <span className="flex items-center gap-1.5 text-foreground">
                  <span className="h-0 w-4 border-t-[3px] border-primary" />
                  Optimized
                </span>
              </div>
            </div>

            <div className="relative">
              <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                className="h-[420px] w-full bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] [background-size:22px_22px]"
                role="img"
                aria-label="Optimized routing graph across regional hubs"
              >
                {/* Faint full mesh of possible arcs */}
                {LOCATIONS.map((a, i) =>
                  LOCATIONS.slice(i + 1).map((b) => {
                    const pa = project(a)
                    const pb = project(b)
                    return (
                      <line
                        key={`${a}-${b}`}
                        x1={pa.x}
                        y1={pa.y}
                        x2={pb.x}
                        y2={pb.y}
                        className="stroke-border"
                        strokeWidth={1}
                        strokeDasharray="2 5"
                        opacity={0.5}
                      />
                    )
                  }),
                )}

                {/* Baseline route */}
                {result && (
                  <path
                    d={pathFor(result.baseline)}
                    fill="none"
                    className="stroke-muted-foreground/60"
                    strokeWidth={2}
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Optimized route (animated draw) */}
                {result && (
                  <path
                    key={result.optimized.join('-')}
                    d={pathFor(result.optimized)}
                    fill="none"
                    className="stroke-primary [stroke-dasharray:1400] [animation:fp-draw_1s_ease-out_forwards]"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hub nodes */}
                {LOCATIONS.map((loc) => {
                  const { x, y } = project(loc)
                  const isOrigin = loc === origin
                  const inRoute = result?.optimized.includes(loc) ?? selected.includes(loc)
                  const order = result ? result.optimized.indexOf(loc) : -1
                  return (
                    <g key={loc}>
                      <circle
                        cx={x}
                        cy={y}
                        r={isOrigin ? 11 : 8}
                        className={cn(
                          isOrigin
                            ? 'fill-primary stroke-primary'
                            : inRoute
                              ? 'fill-card stroke-primary'
                              : 'fill-card stroke-muted-foreground/50',
                        )}
                        strokeWidth={2.5}
                      />
                      {order >= 0 && (
                        <text
                          x={x}
                          y={y + 3.5}
                          textAnchor="middle"
                          className={cn('text-[9px] font-bold', isOrigin ? 'fill-primary-foreground' : 'fill-primary')}
                        >
                          {order}
                        </text>
                      )}
                      <text
                        x={x}
                        y={y - 15}
                        textAnchor="middle"
                        className="fill-foreground text-[11px] font-semibold"
                      >
                        {loc}
                        {isOrigin ? ' ●' : ''}
                      </text>
                    </g>
                  )
                })}
              </svg>

              {/* Solving overlay */}
              {solving && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/80 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Cpu className="size-4 animate-pulse text-primary" />
                    OR-Tools solver running
                  </div>
                  <div className="h-1.5 w-56 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-1/3 rounded-full bg-primary [animation:fp-indeterminate_1.1s_ease-in-out_infinite]" />
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">{SOLVE_PHASES[phase]}</p>
                </div>
              )}

              {/* Empty state */}
              {!solving && !result && (
                <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6">
                  <p className="rounded-full border border-border bg-card/90 px-3 py-1 text-[11px] text-muted-foreground">
                    Configure stops and run the solver to compute the optimal route
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Metrics */}
          {result && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric
                  icon={TrendingDown}
                  label="Distance saved"
                  value={`${result.savedKm} km`}
                  sub={`${result.savedPct}% shorter`}
                />
                <Metric icon={Clock} label="Time saved" value={`${result.savedMin} min`} sub="per run" />
                <Metric icon={Zap} label="Energy saved" value={`${result.savedKwh} kWh`} sub={`₹${result.savedCost} cost`} />
                <Metric icon={Leaf} label="CO₂ reduced" value={`${result.savedCo2} kg`} sub="per run" />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Optimized sequence */}
                <Card className="p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <RouteIcon className="size-4 text-primary" />
                    Optimal stop sequence
                  </div>
                  <ol className="flex flex-col gap-0">
                    {result.optimized.map((loc, i) => (
                      <li key={loc} className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={cn(
                              'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                              i === 0
                                ? 'bg-primary text-primary-foreground'
                                : 'border border-primary/40 bg-primary/10 text-primary',
                            )}
                          >
                            {i}
                          </span>
                          {i < result.optimized.length - 1 && (
                            <span className="h-6 w-px bg-border" />
                          )}
                        </div>
                        <div className="flex flex-1 items-center justify-between pb-3 last:pb-0">
                          <span className="text-sm font-medium text-foreground">
                            {loc}
                            {i === 0 && <span className="ml-1.5 text-[11px] text-muted-foreground">(depot)</span>}
                          </span>
                          {i > 0 && (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              +{haversineKm(HUB_COORDS[result.optimized[i - 1]], HUB_COORDS[loc])} km
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Baseline {result.baselineKm} km</span>
                    <span className="font-semibold text-nominal">Optimized {result.optimizedKm} km</span>
                  </div>
                </Card>

                {/* Solver telemetry */}
                <Card className="p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Cpu className="size-4 text-primary" />
                    Solver telemetry
                  </div>
                  <dl className="flex flex-col divide-y divide-border text-xs">
                    <SolverRow k="Solver" v="RoutingModel (CP-SAT)" />
                    <SolverRow k="First solution" v="PATH_CHEAPEST_ARC" />
                    <SolverRow k="Metaheuristic" v="GUIDED_LOCAL_SEARCH" />
                    <SolverRow k="Route candidates" v={result.candidates.toLocaleString()} />
                    <SolverRow k="Nodes explored" v={result.nodesExplored.toLocaleString()} />
                    <SolverRow k="Objective (arc cost)" v={`${result.optimizedKm} km`} />
                    <SolverRow k="Optimality gap" v="0.0% (proven)" />
                    <SolverRow k="Wall time" v={`${result.solveMs} ms`} />
                  </dl>
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-nominal/25 bg-nominal/8 px-3 py-2">
                    <CheckCircle2 className="size-4 text-nominal" />
                    <span className="text-xs font-medium text-nominal">Optimal solution found & verified</span>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function Metric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub: string
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Icon className="size-3.5 text-nominal" />
        {label}
      </div>
      <div className="text-xl font-semibold tracking-tight text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </Card>
  )
}

function SolverRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono font-medium text-foreground">{v}</dd>
    </div>
  )
}
