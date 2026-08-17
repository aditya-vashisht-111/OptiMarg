'use client'

import * as React from 'react'
import { FLEET_IDS, synthesizeVehicle, type VehicleTelemetry } from '@/lib/fleet'

/**
 * Maintains a live demo fleet with gently animated telemetry (position along
 * corridor, speed, battery drift). This powers the map + dashboard so the
 * command center always feels alive even without a websocket backend.
 */
export function useFleet(pollMs = 3000) {
  const [fleet, setFleet] = React.useState<VehicleTelemetry[]>(() =>
    FLEET_IDS.map((id) => synthesizeVehicle(id)),
  )

  React.useEffect(() => {
    const t = setInterval(() => {
      setFleet((prev) =>
        prev.map((v) => {
          if (v.status !== 'In-Transit') return v
          // Slowed to ~40% of the previous rate so the on-map movement is
          // easy to follow (a full corridor now takes ~2-3x longer to cross).
          const nextProgress = Math.min(100, v.progress + Math.random() * 1.2)
          const done = nextProgress >= 100
          return {
            ...v,
            progress: done ? 100 : nextProgress,
            status: done ? 'Nominal' : v.status,
            speedKmh: done ? 0 : Math.max(20, Math.round(v.speedKmh + (Math.random() - 0.5) * 8)),
            batteryPct: Math.max(6, Number((v.batteryPct - Math.random() * 0.4).toFixed(1))),
          }
        }),
      )
    }, pollMs)
    return () => clearInterval(t)
  }, [pollMs])

  return fleet
}
