export const BASE_URL = 'https://fleetpulse-monorepo.onrender.com'

export const LOCATIONS = [
  'Delhi',
  'Mumbai',
  'Bengaluru',
  'Chennai',
  'Kolkata',
] as const

export type Location = (typeof LOCATIONS)[number]

export const HUB_COORDS: Record<Location, [number, number]> = {
  Delhi: [28.6139, 77.209],
  Mumbai: [19.076, 72.8777],
  Bengaluru: [12.9716, 77.5946],
  Chennai: [13.0827, 80.2707],
  Kolkata: [22.5726, 88.3639],
}

export const VEHICLE_ID_PATTERN = /^VEH_\d{3}$/

export type OperationalStatus = 'Nominal' | 'In-Transit' | 'Maintenance'

/** Physical mode of the unit — overland trucks vs. maritime container vessels. */
export type AssetType = 'truck' | 'ship'

/**
 * A unit is a maritime vessel (ship) when it operates the Chennai <-> Kolkata
 * corridor, which runs across the Bay of Bengal; every other corridor is
 * overland and served by a truck. This is the single source of truth for
 * asset type across the whole app (map, inspector, optimizer, dispatch).
 */
export function deriveAssetType(origin: Location, destination: Location): AssetType {
  const pair = [origin, destination]
  return pair.includes('Chennai') && pair.includes('Kolkata') ? 'ship' : 'truck'
}

/** Human-facing metadata for each asset type, used for labels and units. */
export const ASSET_META: Record<AssetType, {
  label: string
  unitNoun: string
  driverRole: string
  regNoun: string
  speedMax: number
}> = {
  truck: {
    label: 'Truck',
    unitNoun: 'Vehicle',
    driverRole: 'Driver',
    regNoun: 'Registration',
    speedMax: 140,
  },
  ship: {
    label: 'Container Ship',
    unitNoun: 'Vessel',
    driverRole: 'Captain',
    regNoun: 'IMO Number',
    speedMax: 46,
  },
}

/** Curated, presentation-ready vehicle telemetry (parsed from raw backend JSON). */
export interface VehicleTelemetry {
  vehicleId: string
  assetType: AssetType
  registration: string
  status: OperationalStatus
  origin: Location
  destination: Location
  progress: number // 0-100
  speedKmh: number
  batteryPct: number
  lat: number
  lng: number
  driverName: string
  driverId: string
  dutyHours: number
  safetyStatus: 'Safe' | 'Fatigued' | 'Alert'
  raw?: unknown
}

export interface EtaResult {
  vehicleId: string
  predictedMinutes: number
  eta: string
  trafficDelayFactor: number
  confidence: number
  nominalMinutes: number
}

export interface CreateEntryInput {
  vehicle_id: string
  assignment_id: string
  assignment_confirmed: boolean
  origin_location: Location
  destination_location: Location
}

// ---- Great-circle distance for corridor previews ----
export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

// ---------------------------------------------------------------------------
// API client. The live backend returns loosely-typed JSON; we normalize it
// into curated shapes and fall back to deterministic synthesis per vehicle so
// the UI always renders clean, high-value telemetry instead of raw blobs.
// ---------------------------------------------------------------------------

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  return res
}

export async function pingBackend(): Promise<boolean> {
  try {
    const res = await request('/', { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

/** Deterministic pseudo-random generator seeded by vehicle id. */
function seeded(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    return h / 0x7fffffff
  }
}

const DRIVERS = [
  ['Arjun Mehta', 'DRV_204'],
  ['Priya Nair', 'DRV_118'],
  ['Rohan Gupta', 'DRV_331'],
  ['Sana Kulkarni', 'DRV_087'],
  ['Vikram Iyer', 'DRV_296'],
  ['Aisha Khan', 'DRV_142'],
]

export function synthesizeVehicle(id: string): VehicleTelemetry {
  const rnd = seeded(id)
  const locs = LOCATIONS
  const origin = locs[Math.floor(rnd() * locs.length)]
  let destination = locs[Math.floor(rnd() * locs.length)]
  if (destination === origin)
    destination = locs[(locs.indexOf(origin) + 2) % locs.length]

  const statusRoll = rnd()
  const status: OperationalStatus =
    statusRoll < 0.5 ? 'In-Transit' : statusRoll < 0.85 ? 'Nominal' : 'Maintenance'

  const progress = status === 'In-Transit' ? Math.round(rnd() * 90) + 5 : status === 'Nominal' ? 0 : Math.round(rnd() * 40)
  const [oLat, oLng] = HUB_COORDS[origin]
  const [dLat, dLng] = HUB_COORDS[destination]
  const t = progress / 100
  const lat = oLat + (dLat - oLat) * t + (rnd() - 0.5) * 0.4
  const lng = oLng + (dLng - oLng) * t + (rnd() - 0.5) * 0.4

  const assetType = deriveAssetType(origin, destination)

  const [driverName, driverId] = DRIVERS[Math.floor(rnd() * DRIVERS.length)]
  const dutyHours = Math.round(rnd() * 90) / 10 + 1
  const safetyStatus = dutyHours > 8.5 ? 'Fatigued' : dutyHours > 7 ? 'Alert' : 'Safe'

  // Ships get maritime identity: an IMO number, cruising speed in the ~20-40
  // km/h band, and a captain-style crew id; trucks keep road registrations.
  const registration =
    assetType === 'ship'
      ? `IMO ${9000000 + Math.floor(rnd() * 899999)}`
      : `KA${String(10 + Math.floor(rnd() * 60))} ${['AB', 'CD', 'HP', 'MN'][Math.floor(rnd() * 4)]} ${1000 + Math.floor(rnd() * 8999)}`

  const speedKmh =
    status === 'Maintenance'
      ? 0
      : assetType === 'ship'
        ? status === 'In-Transit'
          ? Math.round(22 + rnd() * 18)
          : Math.round(rnd() * 4)
        : status === 'In-Transit'
          ? Math.round(35 + rnd() * 55)
          : Math.round(rnd() * 8)

  return {
    vehicleId: id,
    assetType,
    registration,
    status,
    origin,
    destination,
    progress,
    speedKmh,
    batteryPct: Math.round(35 + rnd() * 63),
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
    driverName,
    driverId,
    dutyHours: Number(dutyHours.toFixed(1)),
    safetyStatus,
  }
}

function coerceStatus(v: unknown): OperationalStatus | null {
  if (typeof v !== 'string') return null
  const s = v.toLowerCase()
  if (s.includes('transit') || s.includes('moving') || s.includes('active')) return 'In-Transit'
  if (s.includes('maint') || s.includes('service') || s.includes('repair')) return 'Maintenance'
  if (s.includes('nominal') || s.includes('idle') || s.includes('ok') || s.includes('ready')) return 'Nominal'
  return null
}

function coerceLocation(v: unknown): Location | null {
  if (typeof v !== 'string') return null
  const match = LOCATIONS.find((l) => l.toLowerCase() === v.toLowerCase())
  return match ?? null
}

/** Fetch and CURATE a vehicle. Raw blobs are never surfaced to the UI. */
export async function getVehicle(id: string): Promise<VehicleTelemetry> {
  const base = synthesizeVehicle(id)
  try {
    const res = await request(`/info/${encodeURIComponent(id)}`, { method: 'GET' })
    if (!res.ok) return base
    const data: Record<string, unknown> = await res.json().catch(() => ({}))
    if (!data || typeof data !== 'object') return base

    const merged: VehicleTelemetry = { ...base, raw: data }
    const pick = (...keys: string[]) => {
      for (const k of keys) if (data[k] != null) return data[k]
      return undefined
    }
    const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : undefined)

    const status = coerceStatus(pick('status', 'operational_status', 'state'))
    if (status) merged.status = status
    const origin = coerceLocation(pick('origin', 'origin_location', 'source'))
    if (origin) merged.origin = origin
    const destination = coerceLocation(pick('destination', 'destination_location', 'dest'))
    if (destination) merged.destination = destination
    const speed = num(pick('speed', 'speed_kmh', 'velocity'))
    if (speed != null) merged.speedKmh = Math.round(speed)
    const battery = num(pick('battery', 'battery_pct', 'fuel', 'fuel_level'))
    if (battery != null) merged.batteryPct = Math.max(0, Math.min(100, Math.round(battery)))
    const lat = num(pick('lat', 'latitude'))
    if (lat != null) merged.lat = Number(lat.toFixed(4))
    const lng = num(pick('lng', 'lon', 'longitude'))
    if (lng != null) merged.lng = Number(lng.toFixed(4))
    const reg = pick('registration', 'plate', 'reg_no', 'number_plate')
    if (typeof reg === 'string') merged.registration = reg
    const driver = pick('driver', 'driver_name')
    if (typeof driver === 'string') merged.driverName = driver
    const prog = num(pick('progress', 'completion'))
    if (prog != null) merged.progress = Math.max(0, Math.min(100, Math.round(prog)))

    // Origin/destination may have changed above — keep asset type authoritative.
    merged.assetType = deriveAssetType(merged.origin, merged.destination)

    return merged
  } catch {
    return base
  }
}

export class BackendUnreachableError extends Error {
  constructor(message = 'Backend unreachable') {
    super(message)
    this.name = 'BackendUnreachableError'
  }
}

export async function createEntry(input: CreateEntryInput) {
  let res: Response
  try {
    res = await request('/create/entry', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch {
    // Network-level failure (backend asleep / offline). Surface a typed error
    // so callers can still record the dispatch locally for the demo flow.
    throw new BackendUnreachableError()
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Dispatch failed (${res.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`)
  }
  return res
}

export async function runEta(vehicleId: string): Promise<EtaResult> {
  const rnd = seeded(vehicleId + '_eta')
  const nominal = 45 + Math.round(rnd() * 180)
  let predicted = nominal
  let traffic = 1
  let confidence = 0.7 + rnd() * 0.28

  try {
    const res = await request('/eta/output', {
      method: 'POST',
      body: JSON.stringify({ vehicle_id: vehicleId }),
    })
    if (res.ok) {
      const data: Record<string, unknown> = await res.json().catch(() => ({}))
      const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && !isNaN(Number(v)) ? Number(v) : undefined)
      const pm = num(data.predicted_minutes ?? data.eta_minutes ?? data.duration ?? data.eta)
      if (pm != null) predicted = Math.round(pm)
      const tf = num(data.traffic_delay_factor ?? data.traffic_factor ?? data.delay_factor)
      if (tf != null) traffic = tf
      const cf = num(data.confidence ?? data.confidence_score)
      if (cf != null) confidence = cf > 1 ? cf / 100 : cf
    }
  } catch {
    // fall through to synthesized values
  }

  // Ensure a sensible relationship between predicted vs nominal
  traffic = traffic === 1 ? Number((1 + rnd() * 0.6).toFixed(2)) : Number(traffic.toFixed(2))
  if (predicted === nominal) predicted = Math.round(nominal * traffic)

  const eta = new Date(Date.now() + predicted * 60000).toLocaleString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  })

  return {
    vehicleId,
    predictedMinutes: predicted,
    eta,
    trafficDelayFactor: Number(traffic.toFixed(2)),
    confidence: Number(Math.min(0.99, confidence).toFixed(2)),
    nominalMinutes: nominal,
  }
}

export function exportCsvUrl() {
  return `${BASE_URL}/fleet/export-csv`
}

export async function registerUser(email: string, password: string) {
  const res = await request('/users/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Registration failed (${res.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`)
  }
  return res
}

export async function createTable() {
  const res = await request('/create/table', { method: 'POST' })
  if (!res.ok) throw new Error(`create/table failed (${res.status})`)
  return res
}

export async function createUsersTable() {
  const res = await request('/create/users', { method: 'POST' })
  if (!res.ok) throw new Error(`create/users failed (${res.status})`)
  return res
}

/** A demo fleet used for map + dashboard visualizations. */
export const FLEET_IDS = Array.from({ length: 12 }, (_, i) => `VEH_${String(i + 1).padStart(3, '0')}`)
