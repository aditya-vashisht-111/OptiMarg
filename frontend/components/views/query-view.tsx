'use client'

import * as React from 'react'
import {
  Bot,
  Send,
  Sparkles,
  MapPin,
  Navigation,
  User,
  Fuel,
  CircleDot,
  Gauge,
  Clock,
  ShieldCheck,
  Wrench,
  Database,
  CornerDownLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card, Label, Select } from '@/components/ui/primitives'
import {
  HUB_COORDS,
  haversineKm,
  ASSET_META,
  type VehicleTelemetry,
} from '@/lib/fleet'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Extended per-vehicle diagnostics (deterministic knowledge base)     */
/* ------------------------------------------------------------------ */

function seeded(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    return h / 0x7fffffff
  }
}

type TireStatus = 'OK' | 'Low' | 'Critical'
interface Tire {
  pos: string
  psi: number
  wearPct: number
  status: TireStatus
}

interface Diagnostics {
  fuelType: 'Electric' | 'Diesel' | 'CNG'
  energyLabel: string
  energyPct: number
  rangeKm: number
  odometerKm: number
  engineTempC: number
  engineHealth: 'Optimal' | 'Elevated' | 'Overheating'
  tires: Tire[]
  worstTire: Tire
  tireAlert: boolean
  nextServiceKm: number
  serviceOverdue: boolean
  cargoPct: number
  cargoTonnes: number
}

const TIRE_POS = ['Front-Left', 'Front-Right', 'Mid-Left', 'Mid-Right', 'Rear-Left', 'Rear-Right']

function diagnostics(v: VehicleTelemetry): Diagnostics {
  const rnd = seeded(v.vehicleId + '_diag')
  const fuelType: Diagnostics['fuelType'] =
    rnd() < 0.45 ? 'Electric' : rnd() < 0.75 ? 'Diesel' : 'CNG'
  const energyLabel = fuelType === 'Electric' ? 'Charge' : 'Fuel'
  const energyPct = v.batteryPct
  const rangeKm = Math.round((energyPct / 100) * (fuelType === 'Electric' ? 320 : 620))

  const odometerKm = 40000 + Math.floor(rnd() * 180000)
  const engineTempC =
    v.status === 'Maintenance'
      ? Math.round(96 + rnd() * 22)
      : Math.round(74 + rnd() * 22)
  const engineHealth: Diagnostics['engineHealth'] =
    engineTempC > 110 ? 'Overheating' : engineTempC > 98 ? 'Elevated' : 'Optimal'

  // Tire pressures — seed a chance of a low/critical (blown) tire.
  const faultRoll = rnd()
  const faultIndex = Math.floor(rnd() * 6)
  const tires: Tire[] = TIRE_POS.map((pos, i) => {
    let psi = Math.round(95 + rnd() * 22)
    let status: TireStatus = 'OK'
    if (faultRoll < 0.28 && i === faultIndex) {
      // A flagged tire on ~28% of units.
      psi = faultRoll < 0.12 ? Math.round(8 + rnd() * 20) : Math.round(58 + rnd() * 20)
      status = faultRoll < 0.12 ? 'Critical' : 'Low'
    }
    const wearPct = Math.round(12 + rnd() * 74)
    return { pos, psi, wearPct, status }
  })
  const worstTire = tires.reduce((a, b) =>
    (b.status === 'Critical' ? 2 : b.status === 'Low' ? 1 : 0) >
    (a.status === 'Critical' ? 2 : a.status === 'Low' ? 1 : 0)
      ? b
      : a,
  )
  const tireAlert = worstTire.status !== 'OK'

  const nextServiceKm = Math.round(rnd() * 9000) - 1500
  const serviceOverdue = nextServiceKm < 0
  const cargoPct = Math.round(rnd() * 100)
  const cargoTonnes = Number(((cargoPct / 100) * 9).toFixed(1))

  return {
    fuelType,
    energyLabel,
    energyPct,
    rangeKm,
    odometerKm,
    engineTempC,
    engineHealth,
    tires,
    worstTire,
    tireAlert,
    nextServiceKm,
    serviceOverdue,
    cargoPct,
    cargoTonnes,
  }
}

/* ------------------------------------------------------------------ */
/* Telemetry helpers                                                   */
/* ------------------------------------------------------------------ */

type Tone = 'neutral' | 'nominal' | 'transit' | 'alert' | 'brand'

function corridorKm(v: VehicleTelemetry) {
  return haversineKm(HUB_COORDS[v.origin], HUB_COORDS[v.destination])
}
function coveredKm(v: VehicleTelemetry) {
  return Math.round(corridorKm(v) * (v.progress / 100))
}
function remainingKm(v: VehicleTelemetry) {
  return Math.round(corridorKm(v) * (1 - v.progress / 100))
}
function etaMinutes(v: VehicleTelemetry) {
  if (v.status !== 'In-Transit' || v.speedKmh <= 0) return null
  return Math.round((remainingKm(v) / v.speedKmh) * 60)
}
function fmtEta(mins: number) {
  const d = new Date(Date.now() + mins * 60000)
  return d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
}
function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m} min`
  return `${h} h ${m} min`
}

const statusTone: Record<string, Tone> = {
  Nominal: 'nominal',
  'In-Transit': 'transit',
  Maintenance: 'alert',
}

/* ------------------------------------------------------------------ */
/* Natural-language engine (fully local, no network)                  */
/* ------------------------------------------------------------------ */

/** Normalize a query: lowercase, strip punctuation, pad with spaces. */
function normalize(raw: string) {
  return (
    ' ' +
    raw
      .toLowerCase()
      .replace(/[^a-z0-9/%]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() +
    ' '
  )
}

function pick<T>(seed: string, arr: T[]): T {
  const rnd = seeded(seed)
  return arr[Math.floor(rnd() * arr.length)]
}

type GreetType = 'hi' | 'howareyou' | 'who' | 'thanks' | 'bye' | 'help' | null

function detectGreet(q: string): GreetType {
  if (/\b(thanks|thank you|thankyou|thx|ty|appreciate|cheers|much obliged|great work|good job|nice one|perfect|awesome|helpful)\b/.test(q)) return 'thanks'
  if (/\b(bye|goodbye|see you|see ya|cya|good night|goodnight|catch you later|talk later|that s all|that s it|i m done|log off)\b/.test(q)) return 'bye'
  if (/\b(how are you|how ?re you|how are things|how s it going|hows it going|how is it going|what s up|whats up|wassup|sup|hru|you good|how do you do|how have you been)\b/.test(q))
    return 'howareyou'
  if (/\b(help|help me|what can i ask|what should i ask|guide me|show me examples|examples|options|commands|how to use)\b/.test(q))
    return 'help'
  if (/\b(who are you|what are you|what can you do|what do you do|what can you help|your name|how do you work|what all can you|are you a bot|are you ai|are you human)\b/.test(q))
    return 'who'
  if (/\b(hi|hii|hiii|hey|heyy|heya|hello|helo|hellow|hiya|yo|namaste|namaskar|hola|greetings|good morning|good afternoon|good evening|good day|morning|evening|gm|ge)\b/.test(q))
    return 'hi'
  return null
}

/** Detect a bare affirmation like "yes", "sure", "go ahead". */
function detectAffirm(q: string): boolean {
  return /^\s*(yes|yess|yeah|yep|yup|ya|sure|ok|okay|okey|k|fine|alright|all right|go ahead|go on|please|please do|pls|do it|yes please|sounds good|why not|shoot|hit me|lets go|let s go|absolutely|definitely)\s*$/.test(q)
}

/** Detect a bare negative like "no", "nope", "not now". */
function detectDecline(q: string): boolean {
  return /^\s*(no|nope|nah|not now|not really|no thanks|no thank you|maybe later|i m good|im good|all good)\s*$/.test(q)
}

/** Time-of-day aware salutation for a warmer greeting. */
function timeSalutation(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Hello'
}

/** Resolve which vehicle a query is about (explicit id/reg/driver, else active). */
function resolveVehicle(raw: string, fleet: VehicleTelemetry[], activeId: string) {
  const q = normalize(raw)

  const idMatch = raw.match(/veh[\s_-]?0*(\d{1,3})/i)
  if (idMatch) {
    const id = 'VEH_' + idMatch[1].padStart(3, '0')
    const found = fleet.find((v) => v.vehicleId.toUpperCase() === id)
    if (found) return { v: found, explicit: true }
  }
  // Registration plate
  const reg = fleet.find((v) => raw.toLowerCase().includes(v.registration.toLowerCase()))
  if (reg) return { v: reg, explicit: true }
  // Driver name (full name or a distinctive first name)
  const drv = fleet.find((v) => {
    const full = v.driverName.toLowerCase()
    const first = full.split(' ')[0]
    return q.includes(' ' + full + ' ') || (first.length > 2 && q.includes(' ' + first + ' '))
  })
  if (drv) return { v: drv, explicit: true }

  const active = fleet.find((v) => v.vehicleId === activeId) ?? fleet[0]
  return { v: active, explicit: false }
}

type Topic = 'location' | 'destination' | 'driver' | 'fuel' | 'tire' | 'speed' | 'eta' | 'engine' | 'service' | 'cargo'

const TOPIC_WORDS: Record<Topic, string[]> = {
  destination: ['going', 'headed', 'head to', 'destination', 'where to', 'drop', 'deliver', 'delivery', 'route', 'corridor', 'bound for', 'en route', 'goes to', 'final stop', 'end point'],
  location: ['where is', 'where s', 'wheres', 'location', 'located', 'position', 'gps', 'coordinate', 'right now', 'currently', 'whereabouts', 'at the moment'],
  driver: ['driver', 'driving', 'chauffeur', 'operator', 'behind the wheel', 'fatigue', 'fatigued', 'tired', 'duty', 'rest', 'shift', 'crew', 'is he safe', 'is she safe'],
  fuel: ['fuel', 'petrol', 'diesel', 'gasoline', 'gas', 'charge', 'charging', 'battery', 'energy', 'range', 'refuel', 'recharge', 'tank', 'juice'],
  tire: ['tire', 'tyre', 'tires', 'tyres', 'blast', 'blasted', 'blown', 'burst', 'puncture', 'flat', 'pressure', 'psi', 'wheel', 'deflate'],
  speed: ['speed', 'how fast', 'fast is', 'moving', 'velocity', 'kmph', 'km/h', 'kmh', 'pace', 'how quick'],
  eta: ['eta', 'arrive', 'arrival', 'reach', 'reaching', 'when will', 'when does', 'time to', 'how long', 'get there'],
  engine: ['engine', 'temperature', 'temp', 'overheat', 'overheating', 'heat', 'motor', 'coolant'],
  service: ['service', 'maintenance', 'repair', 'workshop', 'due for', 'odometer', 'mileage', 'km driven', 'kilometers driven', 'wear'],
  cargo: ['cargo', 'load', 'freight', 'goods', 'payload', 'tonnes', 'tonne', 'how heavy', 'weight'],
}

function detectTopics(q: string): Topic[] {
  const kw = (words: string[]) => words.some((w) => q.includes(w))
  const topics: Topic[] = []
  const dest = kw(TOPIC_WORDS.destination)
  if (dest) topics.push('destination')
  if (kw(TOPIC_WORDS.location) && !dest) topics.push('location')
  if (kw(TOPIC_WORDS.driver)) topics.push('driver')
  if (kw(TOPIC_WORDS.fuel)) topics.push('fuel')
  if (kw(TOPIC_WORDS.tire)) topics.push('tire')
  if (kw(TOPIC_WORDS.speed)) topics.push('speed')
  if (kw(TOPIC_WORDS.eta) && !dest) topics.push('eta')
  if (kw(TOPIC_WORDS.engine)) topics.push('engine')
  if (kw(TOPIC_WORDS.service)) topics.push('service')
  if (kw(TOPIC_WORDS.cargo)) topics.push('cargo')
  return topics
}

/* ---- per-topic natural-language generators ---- */

function locationText(v: VehicleTelemetry) {
  const lat = v.lat.toFixed(3)
  const lng = v.lng.toFixed(3)
  if (v.status === 'In-Transit') {
    return `It's on the move — about ${v.progress}% through the ${v.origin} → ${v.destination} corridor, currently near ${lat}, ${lng}. Roughly ${coveredKm(v)} km behind it and ${remainingKm(v)} km still to go.`
  }
  if (v.status === 'Maintenance') {
    return `It's off the road for maintenance near ${lat}, ${lng}, so it isn't running the ${v.origin} → ${v.destination} corridor right now.`
  }
  return `It's staged at the ${v.origin} hub (${lat}, ${lng}), ready to start its ${v.origin} → ${v.destination} run.`
}

function destinationText(v: VehicleTelemetry) {
  const base = `It's headed to ${v.destination}, running the ${v.origin} → ${v.destination} corridor (~${corridorKm(v)} km end to end). ${remainingKm(v)} km remain, ${v.progress}% of the trip done.`
  const mins = etaMinutes(v)
  if (mins != null) return `${base} At the current pace it should arrive around ${fmtEta(mins)}.`
  return base
}

function driverText(v: VehicleTelemetry) {
  let note: string
  if (v.safetyStatus === 'Safe' && v.dutyHours < 7) {
    note = 'alert and comfortably within safe duty limits'
  } else if (v.safetyStatus === 'Fatigued' || v.dutyHours > 9) {
    note = 'showing fatigue — I would recommend an immediate rest break'
  } else {
    note = 'approaching the duty-hour limit, so a rest stop should be planned soon'
  }
  const atControls = v.assetType === 'ship' ? 'commanding the bridge' : 'behind the wheel'
  return `${v.driverName} (${v.driverId}) is ${atControls}, ${v.dutyHours} h into the shift. Safety status is "${v.safetyStatus}" — ${note}.`
}

function fuelText(v: VehicleTelemetry, d: Diagnostics) {
  const base = `${d.energyLabel} is at ${d.energyPct}% on its ${d.fuelType} powertrain, good for roughly ${d.rangeKm} km of range.`
  if (d.energyPct < 15) return `${base} That's critically low — it needs to ${d.fuelType === 'Electric' ? 'recharge' : 'refuel'} right away.`
  if (d.energyPct < 30) return `${base} Getting low — worth planning a ${d.fuelType === 'Electric' ? 'charge' : 'fuel'} stop soon.`
  return `${base} Plenty in reserve.`
}

function tireText(d: Diagnostics) {
  const w = d.worstTire
  if (w.status === 'Critical') {
    return `Alert: the ${w.pos} tire is CRITICAL at ${w.psi} PSI — treat that as a blowout/flat and get roadside support on it before the vehicle moves. The other five are holding normal pressure.`
  }
  if (w.status === 'Low') {
    return `Heads up: the ${w.pos} tire is running low at ${w.psi} PSI — re-inflate it at the next stop. No blowout, and the other five tires are fine.`
  }
  return `All six tires are healthy — pressures sit in the normal 95–117 PSI band with no punctures or blowouts detected.`
}

function speedText(v: VehicleTelemetry) {
  if (v.status === 'In-Transit') return `It's rolling at ${v.speedKmh} km/h right now.`
  if (v.status === 'Maintenance') return `It's stationary (0 km/h) — parked for maintenance.`
  return `It's stationary (${v.speedKmh} km/h) — staged at the hub, not yet dispatched.`
}

function etaText(v: VehicleTelemetry) {
  const mins = etaMinutes(v)
  if (mins == null) {
    return `There's no live ETA — the unit isn't in transit right now, so nothing is counting down.`
  }
  return `ETA is about ${fmtEta(mins)} — roughly ${fmtDuration(mins)} out, covering the remaining ${remainingKm(v)} km at its current ${v.speedKmh} km/h.`
}

function engineText(d: Diagnostics) {
  const base = `Engine is running at ${d.engineTempC}°C — status "${d.engineHealth}".`
  if (d.engineHealth === 'Overheating') return `${base} That's overheating; ease off and inspect coolant before continuing.`
  if (d.engineHealth === 'Elevated') return `${base} Slightly warm but still within tolerance — keep an eye on it.`
  return `${base} Temperatures are healthy.`
}

function serviceText(d: Diagnostics) {
  const odo = d.odometerKm.toLocaleString('en-IN')
  if (d.serviceOverdue) {
    return `Service is OVERDUE by ${Math.abs(d.nextServiceKm).toLocaleString('en-IN')} km — book the workshop now. Odometer reads ${odo} km.`
  }
  return `Next service is due in ${d.nextServiceKm.toLocaleString('en-IN')} km. Odometer currently reads ${odo} km.`
}

function cargoText(d: Diagnostics) {
  return `It's carrying ${d.cargoTonnes} t of freight — about ${d.cargoPct}% of its rated capacity.`
}

function topicText(t: Topic, v: VehicleTelemetry, d: Diagnostics): string {
  switch (t) {
    case 'location':
      return locationText(v)
    case 'destination':
      return destinationText(v)
    case 'driver':
      return driverText(v)
    case 'fuel':
      return fuelText(v, d)
    case 'tire':
      return tireText(d)
    case 'speed':
      return speedText(v)
    case 'eta':
      return etaText(v)
    case 'engine':
      return engineText(d)
    case 'service':
      return serviceText(d)
    case 'cargo':
      return cargoText(d)
  }
}

function overview(v: VehicleTelemetry, d: Diagnostics) {
  const alerts: string[] = []
  if (d.tireAlert) alerts.push(`${d.worstTire.pos} tire ${d.worstTire.status.toLowerCase()}`)
  if (d.energyPct < 20) alerts.push(`${d.energyLabel.toLowerCase()} low (${d.energyPct}%)`)
  if (v.safetyStatus !== 'Safe') alerts.push(`driver ${v.safetyStatus.toLowerCase()}`)
  if (d.engineHealth !== 'Optimal') alerts.push(`engine ${d.engineHealth.toLowerCase()}`)
  if (d.serviceOverdue) alerts.push('service overdue')

  const statusPhrase =
    v.status === 'In-Transit'
      ? `in transit, ${v.progress}% along ${v.origin} → ${v.destination} at ${v.speedKmh} km/h`
      : v.status === 'Maintenance'
        ? `in maintenance`
        : `staged at ${v.origin}, ready to roll`

  const head = `${v.vehicleId} is ${statusPhrase}. ${d.energyLabel} ${d.energyPct}%, driver ${v.driverName} is ${v.safetyStatus.toLowerCase()}, engine ${d.engineHealth.toLowerCase()}, tires ${d.tireAlert ? d.worstTire.status.toLowerCase() : 'all healthy'}.`
  if (alerts.length === 0) return `${head} Everything's green — no action needed.`
  return `${head}\n\n⚠ Watch items: ${alerts.join(', ')}.`
}

function fullReport(v: VehicleTelemetry, d: Diagnostics) {
  const mins = etaMinutes(v)
  const etaLine = mins != null ? ` · ETA ~${fmtEta(mins)}` : ''
  return [
    `Full report — ${v.vehicleId} (${v.registration})`,
    `• Status: ${v.status}, ${v.progress}% along ${v.origin} → ${v.destination}`,
    `• Position: ${v.lat.toFixed(3)}, ${v.lng.toFixed(3)} · ${remainingKm(v)} km remaining${etaLine}`,
    `• Driver: ${v.driverName} (${v.driverId}), ${v.dutyHours} h on duty · ${v.safetyStatus}`,
    `• ${d.energyLabel}: ${d.energyPct}% (${d.fuelType}) · ~${d.rangeKm} km range`,
    `• Speed: ${v.speedKmh} km/h`,
    `• Tires: ${d.tireAlert ? `${d.worstTire.pos} ${d.worstTire.status} @ ${d.worstTire.psi} PSI` : 'all six healthy'}`,
    `• Engine: ${d.engineTempC}°C (${d.engineHealth})`,
    `• Service: ${d.serviceOverdue ? `overdue by ${Math.abs(d.nextServiceKm).toLocaleString('en-IN')} km` : `due in ${d.nextServiceKm.toLocaleString('en-IN')} km`} · odo ${d.odometerKm.toLocaleString('en-IN')} km`,
    `• Cargo: ${d.cargoTonnes} t (${d.cargoPct}%)`,
  ].join('\n')
}

/* ---- fleet-wide questions ---- */

function fleetIntent(q: string, fleet: VehicleTelemetry[]): string | null {
  const isFleet =
    /\b(fleet|all vehicles|all trucks|all units|every vehicle|every truck|how many|which vehicle|which truck|which one|which unit|which driver|who has|who s|whose|across|entire|everyone|all of them|the whole|any vehicle|any truck|any unit|anyone|are there any|list|show me all|overall|summary of all|status of all)\b/.test(
      q,
    )
  const isSuperlative =
    /\b(least|lowest|min|minimum|smallest|worst|most|highest|max|maximum|best|top|fastest|slowest|soonest|earliest|closest|nearest|hottest|coldest|emptiest|fullest|running low|nearly empty|almost empty|most tired|most fatigued)\b/.test(
      q,
    )
  if (!isFleet && !isSuperlative) return null

  const diags = fleet.map((v) => ({ v, d: diagnostics(v) }))
  const kw = (words: string[]) => words.some((w) => q.includes(w))

  // Superlative / ranking questions ("which truck has the least fuel?").
  if (isSuperlative) {
    const wantLeast = /\b(least|lowest|min|minimum|smallest|emptiest|running low|nearly empty|almost empty|worst)\b/.test(q)
    const wantMost = /\b(most|highest|max|maximum|top|fullest|best)\b/.test(q)

    if (kw(TOPIC_WORDS.fuel)) {
      const sorted = [...diags].sort((a, b) => a.d.energyPct - b.d.energyPct)
      const pickd = wantMost ? sorted[sorted.length - 1] : sorted[0]
      return `${pickd.v.vehicleId} has the ${wantMost ? 'most' : 'least'} in the tank — ${pickd.d.energyLabel.toLowerCase()} at ${pickd.d.energyPct}% (${pickd.d.fuelType}), about ${pickd.d.rangeKm} km of range. Driver ${pickd.v.driverName}, running ${pickd.v.origin} → ${pickd.v.destination}.`
    }
    if (kw(TOPIC_WORDS.driver)) {
      const sorted = [...diags].sort((a, b) => b.v.dutyHours - a.v.dutyHours)
      const pickd = sorted[0]
      return `${pickd.v.driverName} (${pickd.v.vehicleId}) is the most worn down — ${pickd.v.dutyHours} h on duty, marked "${pickd.v.safetyStatus}". ${pickd.v.safetyStatus === 'Safe' ? 'Still within limits, but the longest shift out there.' : 'They should take a rest break soon.'}`
    }
    if (kw(TOPIC_WORDS.speed)) {
      const moving = diags.filter((x) => x.v.status === 'In-Transit')
      if (moving.length === 0) return `No units are moving right now, so there's no fastest or slowest to call.`
      const sorted = [...moving].sort((a, b) => a.v.speedKmh - b.v.speedKmh)
      const pickd = wantLeast ? sorted[0] : sorted[sorted.length - 1]
      return `${pickd.v.vehicleId} is the ${wantLeast ? 'slowest' : 'fastest'} on the road at ${pickd.v.speedKmh} km/h, ${pickd.v.progress}% along ${pickd.v.origin} → ${pickd.v.destination}.`
    }
    if (kw(TOPIC_WORDS.eta)) {
      const withEta = diags
        .map((x) => ({ ...x, mins: etaMinutes(x.v) }))
        .filter((x) => x.mins != null) as Array<{ v: VehicleTelemetry; d: Diagnostics; mins: number }>
      if (withEta.length === 0) return `No units are in transit with a live ETA right now.`
      const sorted = withEta.sort((a, b) => a.mins - b.mins)
      const pickd = wantMost ? sorted[sorted.length - 1] : sorted[0]
      return `${pickd.v.vehicleId} is ${wantMost ? 'furthest out' : 'arriving soonest'} — ETA around ${fmtEta(pickd.mins)}, roughly ${fmtDuration(pickd.mins)} away on ${pickd.v.origin} → ${pickd.v.destination}.`
    }
    if (kw(TOPIC_WORDS.engine)) {
      const sorted = [...diags].sort((a, b) => b.d.engineTempC - a.d.engineTempC)
      const pickd = wantLeast ? sorted[sorted.length - 1] : sorted[0]
      return `${pickd.v.vehicleId} is running ${wantLeast ? 'coolest' : 'hottest'} — engine at ${pickd.d.engineTempC}°C, status "${pickd.d.engineHealth}".`
    }
    // Superlative without a clear metric — fall through to a fleet snapshot.
  }

  // Tire alerts across the fleet
  if (kw(TOPIC_WORDS.tire)) {
    const bad = diags.filter((x) => x.d.tireAlert)
    if (bad.length === 0) return `Good news — no tire alerts anywhere in the fleet. All ${fleet.length} units have healthy pressures.`
    return `${bad.length} of ${fleet.length} units have tire issues:\n${bad
      .map((x) => `• ${x.v.vehicleId}: ${x.d.worstTire.pos} ${x.d.worstTire.status} @ ${x.d.worstTire.psi} PSI`)
      .join('\n')}`
  }

  // Low fuel/charge across the fleet
  if (kw(TOPIC_WORDS.fuel)) {
    const low = diags.filter((x) => x.d.energyPct < 30).sort((a, b) => a.d.energyPct - b.d.energyPct)
    if (low.length === 0) return `Every unit is above 30% ${'fuel/charge'} — no refuelling needed right now.`
    return `${low.length} unit(s) are low on ${'fuel/charge'}:\n${low
      .map((x) => `• ${x.v.vehicleId}: ${x.d.energyLabel} ${x.d.energyPct}% (${x.d.fuelType})`)
      .join('\n')}`
  }

  // Driver fatigue across the fleet
  if (kw(TOPIC_WORDS.driver)) {
    const tired = diags.filter((x) => x.v.safetyStatus !== 'Safe')
    if (tired.length === 0) return `All drivers are marked Safe and within duty limits across the fleet.`
    return `${tired.length} driver(s) need attention:\n${tired
      .map((x) => `• ${x.v.driverName} (${x.v.vehicleId}): ${x.v.safetyStatus}, ${x.v.dutyHours} h on duty`)
      .join('\n')}`
  }

  // In-transit count / general status roll-up
  const inTransit = fleet.filter((v) => v.status === 'In-Transit')
  const nominal = fleet.filter((v) => v.status === 'Nominal')
  const maint = fleet.filter((v) => v.status === 'Maintenance')
  if (kw(['how many', 'count', 'transit', 'moving', 'on the road']) && !kw(['maintenance', 'idle', 'staged'])) {
    return `${inTransit.length} of ${fleet.length} units are in transit right now (${inTransit
      .map((v) => v.vehicleId)
      .join(', ')}).`
  }

  const alerts = diags.filter(
    (x) => x.d.tireAlert || x.d.energyPct < 20 || x.v.safetyStatus !== 'Safe' || x.d.engineHealth !== 'Optimal' || x.d.serviceOverdue,
  )
  return `Fleet snapshot — ${fleet.length} units total:\n• ${inTransit.length} in transit\n• ${nominal.length} staged/nominal\n• ${maint.length} in maintenance\n• ${alerts.length} with active watch items${
    alerts.length ? `: ${alerts.map((x) => x.v.vehicleId).join(', ')}` : ''
  }`
}

/* ---- small-talk generators ---- */

function greetHi(seed: string) {
  const s = timeSalutation()
  return pick(seed, [
    `${s}! I'm your OptiMarg fleet assistant. Ask me anything — where a truck is, how the driver's holding up, fuel or tire status, ETAs, you name it. Which unit should I look at?`,
    `${s}! Good to see you. I keep live eyes on the whole fleet, so ask away — location, driver, fuel, tires, engine, ETA. Which vehicle can I check?`,
    `${s}! Ready when you are. Try something like "how's the driver on VEH_004?" or "how much fuel is left?" — or just tell me what you want to know.`,
  ])
}
function helpReply() {
  return "Here's the kind of thing you can ask me — plain and casual is fine:\n• \"Where is VEH_004?\" or \"where's it headed?\"\n• \"How's the driver holding up?\"\n• \"How much petrol / charge is left?\"\n• \"Any tire blown or low on pressure?\"\n• \"How fast is it going?\" / \"what's the ETA?\"\n• \"Engine and service status?\"\n• Fleet-wide: \"which truck has the least fuel?\", \"who's the most tired driver?\", \"how many are in transit?\"\n• \"Give me a full report\"\nName a unit like VEH_002, or I'll use the one selected on the right. What would you like to know?"
}
function howAreYou(seed: string) {
  return pick(seed, [
    "All systems green on my end, thanks for asking! More to the point, your fleet's what I watch — want a quick status roll-up?",
    "Running smoothly! I've got live eyes on every unit. Want me to check a specific truck or give you the fleet overview?",
  ])
}
function whoAmI() {
  return "I'm the OptiMarg Query Assistant. I've got live telemetry on every unit and I can answer natural questions like:\n• \"Where is VEH_004?\" / \"where's it going?\"\n• \"How's the driver doing?\"\n• \"How much petrol/charge is left?\"\n• \"Any tire blown or low?\"\n• \"What's the speed / ETA?\"\n• \"Engine and service status?\"\n• \"Give me a full report\"\nYou can name a unit (like VEH_002) or I'll use the one selected on the right. Ask casually or formally — I'll figure it out."
}
function thanksReply(seed: string) {
  return pick(seed, [
    "Anytime! Ping me if you want to check another unit, driver, or the whole fleet.",
    "You're welcome! I'm here whenever you need a status check.",
  ])
}
function byeReply(seed: string) {
  return pick(seed, [
    "Take care! I'll keep watch over the fleet — come back anytime.",
    "See you! I'll be right here monitoring the trucks.",
  ])
}
function fallback(v: VehicleTelemetry) {
  return `I want to get this right — I can tell you about location, destination, driver, fuel/charge, tires, speed, ETA, engine or service for any unit (e.g. ${v.vehicleId}). For example: "how's the driver?", "how much petrol is left?", "any tire blown?", or "give me a full report". What would you like to know?`
}

/** Short-term conversational memory so follow-ups feel natural. */
interface ConvoMemory {
  lastVehicleId: string | null
  lastTopics: Topic[]
  awaitingRollup: boolean
}
const EMPTY_MEMORY: ConvoMemory = { lastVehicleId: null, lastTopics: [], awaitingRollup: false }

/** Top-level: turn a free-text query into a natural answer + updated memory. */
function answerQuery(
  raw: string,
  activeId: string,
  fleet: VehicleTelemetry[],
  mem: ConvoMemory,
): { text: string; mem: ConvoMemory } {
  const q = normalize(raw)
  const seed = raw + activeId + fleet.length
  const greet = detectGreet(q)
  const topicsPreview = detectTopics(q)
  const reportish = /\b(report|rundown|full status|full detail|everything about|tell me everything|complete picture|all details|status of it)\b/.test(q)
  const overviewish = /\b(how is it doing|hows it doing|how is it going with|how is the truck|how s the truck|how is the vehicle|hows the vehicle|status|condition|overview|summary|how is it|how s it|doing well|all good|everything ok|everything okay|health)\b/.test(q)
  const hasSubstance = topicsPreview.length > 0 || reportish || overviewish

  const reply = (text: string, next: Partial<ConvoMemory> = {}): { text: string; mem: ConvoMemory } => ({
    text,
    mem: { ...mem, awaitingRollup: false, ...next },
  })

  // 1. If we just offered a roll-up, honor a bare yes / no.
  if (mem.awaitingRollup && !hasSubstance && !greet) {
    if (detectAffirm(q)) {
      return reply(fleetIntent(normalize('fleet snapshot'), fleet) ?? overview(fleet[0], diagnostics(fleet[0])))
    }
    if (detectDecline(q)) {
      return reply("No worries — I'm right here. Just name a unit or ask about a driver, fuel, tires or ETA whenever you need.")
    }
  }

  // 2. Pure small talk short-circuits (only when there's no fleet/vehicle question).
  const fleetish = fleetIntent(q, fleet)
  if (fleetish && !greet) {
    return reply(fleetish)
  }

  // 3. Resolve the vehicle — prefer an explicitly named unit, then the one we
  //    were just discussing, then the panel's active unit.
  const { v, explicit } = resolveVehicle(raw, fleet, mem.lastVehicleId ?? activeId)
  const d = diagnostics(v)
  const fromMemory = !explicit && mem.lastVehicleId != null && v.vehicleId === mem.lastVehicleId

  // 4. Follow-up: an explicit unit with no new topic reuses the last topic
  //    ("how's the fuel on VEH_004?" → "and VEH_005?").
  let topics = topicsPreview
  if (topics.length === 0 && explicit && mem.lastTopics.length > 0 && !reportish && !overviewish) {
    topics = mem.lastTopics
  }

  const lead = explicit || fromMemory ? `${v.vehicleId}: ` : `${v.vehicleId} (your active unit): `
  const prefix = (body: string) => (greet === 'hi' ? `Hi! ${body}` : body)

  if (topics.length > 0) {
    const body = topics.map((t) => topicText(t, v, d)).join(' ')
    return reply(prefix(lead + body), { lastVehicleId: v.vehicleId, lastTopics: topics })
  }
  if (reportish) return reply(prefix(fullReport(v, d)), { lastVehicleId: v.vehicleId })
  if (overviewish) return reply(prefix(overview(v, d)), { lastVehicleId: v.vehicleId })

  // 5. No substantive intent — handle greeting / small talk.
  if (greet === 'hi') return reply(greetHi(seed))
  if (greet === 'howareyou') return reply(howAreYou(seed), { awaitingRollup: true })
  if (greet === 'who') return reply(whoAmI())
  if (greet === 'help') return reply(helpReply())
  if (greet === 'thanks') return reply(thanksReply(seed))
  if (greet === 'bye') return reply(byeReply(seed))

  return reply(fallback(v))
}

/* ------------------------------------------------------------------ */
/* Presentation                                                        */
/* ------------------------------------------------------------------ */

const factToneClass: Record<Tone, string> = {
  neutral: 'border-border bg-muted text-foreground',
  nominal: 'border-nominal/25 bg-nominal/10 text-nominal',
  transit: 'border-transit/35 bg-transit/15 text-transit-foreground',
  alert: 'border-alert/25 bg-alert/10 text-alert',
  brand: 'border-primary/25 bg-primary/10 text-primary',
}

const SUGGESTIONS = [
  'Where is this vehicle right now?',
  'Where is it going?',
  'How is the driver doing?',
  'Is a tire blown or low on pressure?',
  'How much fuel / charge is left?',
  'What is the ETA?',
  'Give me a full report',
]

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  pending?: boolean
}

export function QueryView({ fleet }: { fleet: VehicleTelemetry[] }) {
  const [contextId, setContextId] = React.useState<string>(fleet[0]?.vehicleId ?? 'VEH_001')
  const [input, setInput] = React.useState('')
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [busy, setBusy] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const idRef = React.useRef(0)
  const timers = React.useRef<number[]>([])
  const memRef = React.useRef<ConvoMemory>(EMPTY_MEMORY)

  const ctxVehicle = fleet.find((v) => v.vehicleId === contextId) ?? fleet[0]
  const ctxDiag = ctxVehicle ? diagnostics(ctxVehicle) : null

  // Keep latest values reachable from async timers without stale closures.
  const ctxIdRef = React.useRef(contextId)
  ctxIdRef.current = contextId
  const fleetRef = React.useRef(fleet)
  fleetRef.current = fleet

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  React.useEffect(() => {
    const t = timers.current
    return () => t.forEach((id) => clearTimeout(id))
  }, [])

  const send = React.useCallback(
    (raw: string) => {
      const q = raw.trim()
      if (!q || busy) return

      const userId = ++idRef.current
      const aid = ++idRef.current
      setMessages((m) => [
        ...m,
        { id: userId, role: 'user', text: q },
        { id: aid, role: 'assistant', text: '', pending: true },
      ])
      setInput('')
      setBusy(true)

      const { text: full, mem } = answerQuery(q, ctxIdRef.current, fleetRef.current, memRef.current)
      memRef.current = mem
      // A short "thinking" pause that scales with answer length, then a smooth
      // word-aware stream reveal.
      const think = 320 + Math.min(520, full.length * 1.2) + Math.random() * 200
      const t1 = window.setTimeout(() => {
        let i = 0
        const chunk = Math.max(2, Math.round(full.length / 90))
        const step = () => {
          i = Math.min(full.length, i + chunk)
          // Snap to the next word boundary so words never render half-formed.
          if (i < full.length) {
            const nextSpace = full.indexOf(' ', i)
            if (nextSpace !== -1 && nextSpace - i < 12) i = nextSpace
          }
          const slice = full.slice(0, i)
          setMessages((m) => m.map((msg) => (msg.id === aid ? { ...msg, text: slice, pending: false } : msg)))
          if (i < full.length) {
            const t = window.setTimeout(step, 16)
            timers.current.push(t)
          } else {
            setBusy(false)
          }
        }
        step()
      }, think)
      timers.current.push(t1)
    },
    [busy],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Chat column */}
      <Card className="flex min-h-[640px] flex-col overflow-hidden lg:col-span-2">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-card/60 px-5 py-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Bot className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">OptiMarg Query Assistant</h2>
              <Badge tone="nominal">
                <span className="size-1.5 rounded-full bg-nominal" />
                Online
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Conversational assistant with live access to fleet telemetry &amp; diagnostics
            </p>
          </div>
          <Badge tone="brand" className="hidden sm:inline-flex">
            <Database className="size-3" />
            {fleet.length} units indexed
          </Badge>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-auto px-4 py-5 md:px-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-7" />
              </span>
              <h3 className="text-base font-semibold text-foreground">Ask me anything about your fleet</h3>
              <p className="mt-1 max-w-md text-pretty text-sm text-muted-foreground">
                Say hi, or ask naturally — &ldquo;how&apos;s the driver?&rdquo;, &ldquo;how much petrol is left?&rdquo;,
                &ldquo;any tire blown?&rdquo;. Mention a unit like{' '}
                <span className="font-medium text-foreground">VEH_004</span> or I&apos;ll use the one selected on the
                right.
              </p>
              <div className="mt-5 flex max-w-lg flex-wrap justify-center gap-2">
                {SUGGESTIONS.slice(0, 5).map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            if (m.role === 'user') {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="flex max-w-[85%] items-start gap-2.5">
                    <div className="rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm">
                      {m.text}
                    </div>
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <User className="size-4" />
                    </span>
                  </div>
                </div>
              )
            }
            return (
              <div key={m.id} className="flex justify-start">
                <div className="flex max-w-[92%] items-start gap-2.5">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <Bot className="size-4" />
                  </span>
                  <div className="min-w-0 rounded-2xl rounded-tl-sm border border-border bg-background px-4 py-3 shadow-sm">
                    {m.pending ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                        <span className="ml-1.5 text-xs text-muted-foreground">Thinking…</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-line text-pretty text-sm leading-relaxed text-foreground">{m.text}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-card/60 px-4 py-3 md:px-5">
          {messages.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={busy}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={`Ask about ${contextId} or any unit…`}
                className="h-11 w-full rounded-xl border border-input bg-background pl-4 pr-10 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none"
                aria-label="Ask a question about the fleet"
              />
              <CornerDownLeft className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
            </div>
            <Button onClick={() => send(input)} disabled={!input.trim() || busy} className="h-11 gap-1.5 px-4">
              <Send className="size-4" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Context / knowledge panel */}
      <div className="space-y-4">
        <Card>
          <div className="border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Vehicle Context</h3>
            <p className="text-xs text-muted-foreground">Default unit for questions without an ID</p>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="ctx">Active unit</Label>
              <Select
                id="ctx"
                value={contextId}
                onChange={(e) => {
                  setContextId(e.target.value)
                  // Manual selection becomes the new default context.
                  memRef.current = { ...memRef.current, lastVehicleId: null, lastTopics: [] }
                }}
              >
                {fleet.map((v) => (
                  <option key={v.vehicleId} value={v.vehicleId}>
                    {v.vehicleId} · {ASSET_META[v.assetType].label} · {v.origin} → {v.destination}
                  </option>
                ))}
              </Select>
            </div>

            {ctxVehicle && ctxDiag && (
              <div className="grid grid-cols-2 gap-2">
                <SnapStat icon={MapPin} label="Status" value={ctxVehicle.status} tone={statusTone[ctxVehicle.status]} />
                <SnapStat icon={Navigation} label="Progress" value={`${ctxVehicle.progress}%`} tone="transit" />
                <SnapStat
                  icon={Fuel}
                  label={ctxDiag.energyLabel}
                  value={`${ctxDiag.energyPct}%`}
                  tone={ctxDiag.energyPct < 20 ? 'alert' : 'nominal'}
                />
                <SnapStat
                  icon={CircleDot}
                  label="Tires"
                  value={ctxDiag.tireAlert ? ctxDiag.worstTire.status : 'OK'}
                  tone={ctxDiag.tireAlert ? 'alert' : 'nominal'}
                />
                <SnapStat icon={Gauge} label="Speed" value={`${ctxVehicle.speedKmh} km/h`} tone="neutral" />
                <SnapStat
                  icon={ShieldCheck}
                  label={ASSET_META[ctxVehicle.assetType].driverRole}
                  value={ctxVehicle.safetyStatus}
                  tone={ctxVehicle.safetyStatus === 'Safe' ? 'nominal' : ctxVehicle.safetyStatus === 'Alert' ? 'transit' : 'alert'}
                />
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">What I can answer</h3>
          </div>
          <ul className="space-y-2.5 px-5 py-4">
            {[
              { icon: MapPin, t: 'Location & live position' },
              { icon: Navigation, t: 'Destination & route corridor' },
              { icon: User, t: 'Driver identity, duty & fatigue' },
              { icon: Fuel, t: 'Fuel / charge level & range' },
              { icon: CircleDot, t: 'Tire pressure, punctures & blowouts' },
              { icon: Gauge, t: 'Speed & motion state' },
              { icon: Clock, t: 'ETA & time to arrival' },
              { icon: Wrench, t: 'Engine, odometer & service due' },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-2.5 text-sm text-foreground">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-3.5" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function SnapStat({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  tone?: Tone
}) {
  return (
    <div className={cn('rounded-lg border px-2.5 py-2', factToneClass[tone])}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide opacity-70">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  )
}
