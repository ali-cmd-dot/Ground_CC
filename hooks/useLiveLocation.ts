'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

interface UseLiveLocationOptions {
  technicianId: string
  enabled: boolean
  intervalMs?: number
}

export function useLiveLocation({ technicianId, enabled, intervalMs = 15000 }: UseLiveLocationOptions) {
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<any>(null)
  const lastPositionRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null)

  const updateLocation = useCallback(async (lat: number, lng: number, accuracy?: number) => {
    if (!technicianId) return
    try {
      await supabase.from('live_locations').upsert({
        technician_id: technicianId,
        latitude: lat,
        longitude: lng,
        accuracy: accuracy || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'technician_id' })
    } catch (err) {
      console.error('Location update failed:', err)
    }
  }, [technicianId])

  useEffect(() => {
    if (!enabled || !technicianId) return

    if (!navigator.geolocation) return

    // Watch position for real-time updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        lastPositionRef.current = { lat: latitude, lng: longitude, timestamp: Date.now() }
        updateLocation(latitude, longitude, accuracy)
      },
      (err) => console.error('Watch position error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )

    // Also push every interval as backup
    intervalRef.current = setInterval(() => {
      if (lastPositionRef.current) {
        const { lat, lng } = lastPositionRef.current
        updateLocation(lat, lng)
      }
    }, intervalMs)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, technicianId, intervalMs, updateLocation])

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    // Remove from live_locations when checked out
    if (technicianId) {
      await supabase.from('live_locations').delete().eq('technician_id', technicianId)
    }
  }, [technicianId])

  return { stopTracking }
}
