'use client'

import * as React from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  HUB_COORDS,
  LOCATIONS,
  type VehicleTelemetry,
  type Location,
} from '@/lib/fleet'
import { Gauge, BatteryMedium, Route, Truck, Ship } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  Nominal: 'oklch(0.55 0.11 155)',
  'In-Transit': 'oklch(0.62 0.15 55)',
  Maintenance: 'oklch(0.55 0.18 25)',
}

const INDIA_CENTER: [number, number] = [20.9, 79.0]

function vehiclePos(v: VehicleTelemetry): [number, number] {
  const [oLat, oLng] = HUB_COORDS[v.origin]
  const [dLat, dLng] = HUB_COORDS[v.destination]
  const t = v.progress / 100
  return [oLat + (dLat - oLat) * t, oLng + (dLng - oLng) * t]
}

// Actual illustrated miniatures, keyed off the unit's authoritative asset type
// (`v.assetType` from lib/fleet). Ships serve the Chennai <-> Kolkata sea
// corridor; everyone else is an overland truck. Sizes are kept compact so
// units don't cluster into a blob when they converge on a hub.
const TRUCK_ICON = L.icon({
  iconUrl: '/markers/truck.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -14],
  className: 'fleet-vehicle-icon',
})
const SHIP_ICON = L.icon({
  iconUrl: '/markers/ship.png',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -16],
  className: 'fleet-vehicle-icon',
})
function vehicleIcon(v: VehicleTelemetry): L.Icon {
  return v.assetType === 'ship' ? SHIP_ICON : TRUCK_ICON
}

// All unique corridors between the 5 hubs, drawn as dotted transit lines.
function hubCorridors(): [Location, Location][] {
  const pairs: [Location, Location][] = []
  for (let i = 0; i < LOCATIONS.length; i++) {
    for (let j = i + 1; j < LOCATIONS.length; j++) {
      pairs.push([LOCATIONS[i], LOCATIONS[j]])
    }
  }
  return pairs
}

export default function FleetMap({
  fleet,
  onInspect,
  onEta,
}: {
  fleet: VehicleTelemetry[]
  onInspect?: (id: string) => void
  onEta?: (id: string) => void
}) {
  const corridors = React.useMemo(hubCorridors, [])

  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={5}
      scrollWheelZoom
      className="size-full"
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      {/* Dotted transit corridors between hubs */}
      {corridors.map(([a, b]) => (
        <Polyline
          key={`${a}-${b}`}
          positions={[HUB_COORDS[a], HUB_COORDS[b]]}
          pathOptions={{
            color: 'oklch(0.56 0.13 42)',
            weight: 1,
            opacity: 0.28,
            dashArray: '2 7',
          }}
        />
      ))}

      {/* Hub markers */}
      {LOCATIONS.map((loc) => (
        <CircleMarker
          key={loc}
          center={HUB_COORDS[loc]}
          radius={7}
          pathOptions={{
            color: 'oklch(0.56 0.13 42)',
            weight: 2,
            fillColor: 'oklch(0.99 0.01 85)',
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -6]} opacity={1}>
            <span className="text-xs font-semibold">{loc} Hub</span>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Active vehicles */}
      {fleet.map((v) => {
        const pos = vehiclePos(v)
        const color = STATUS_COLOR[v.status]
        return (
          <React.Fragment key={v.vehicleId}>
            {v.status === 'In-Transit' && (
              <Polyline
                positions={[HUB_COORDS[v.origin], pos, HUB_COORDS[v.destination]]}
                pathOptions={{ color, weight: 2, opacity: 0.5 }}
              />
            )}
            <Marker position={pos} icon={vehicleIcon(v)}>
              <Popup>
                <div className="min-w-[210px] font-sans">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-stone-800">
                      {v.vehicleId}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ background: `${color}22`, color }}
                    >
                      {v.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-stone-500">
                    {v.assetType === 'ship' ? (
                      <Ship className="size-3" />
                    ) : (
                      <Truck className="size-3" />
                    )}
                    {v.assetType === 'ship' ? 'Container Ship' : 'Delivery Truck'}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-stone-500">
                    <Route className="size-3" />
                    {v.origin} → {v.destination}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-stone-600">
                    <span className="flex items-center gap-1">
                      <Gauge className="size-3" /> {v.speedKmh} km/h
                    </span>
                    <span className="flex items-center gap-1">
                      <BatteryMedium className="size-3" /> {v.batteryPct}%
                    </span>
                  </div>
                  <div className="mt-2.5 flex gap-1.5">
                    <button
                      onClick={() => onInspect?.(v.vehicleId)}
                      className="flex-1 rounded-md bg-stone-800 px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-stone-700"
                    >
                      Telemetry
                    </button>
                    <button
                      onClick={() => onEta?.(v.vehicleId)}
                      className="flex-1 rounded-md border border-stone-300 px-2 py-1 text-[11px] font-medium text-stone-700 transition-colors hover:bg-stone-100"
                    >
                      Predict ETA
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        )
      })}
    </MapContainer>
  )
}
