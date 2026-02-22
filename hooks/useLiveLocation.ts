'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

interface UseLiveLocationOptions {
  technicianId: string
  enabled: boolean
  intervalMs?: number
}

export function useLiveLocation({ technicianId, enabled, intervalMs = 12000 }: UseLiveLocationOptions) {
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<any>(null)
  const lastPushRef = useRef<number>(0)
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null)

  const pushToSupabase = useCallback(async (lat: number, lng: number, accuracy?: number) => {
    if (!technicianId) return
    try {
      const { error } = await supabase.from('live_locations').upsert(
        {
          technician_id: technicianId,
          latitude: lat,
          longitude: lng,
          accuracy: accuracy ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'technician_id' }
      )
      if (error) console.error('Live location upsert error:', error)
    } catch (err) {
      console.error('Location push failed:', err)
    }
  }, [technicianId])

  useEffect(() => {
    if (!enabled || !technicianId || !navigator.geolocation) return

    const handlePosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords
      lastPosRef.current = { lat: latitude, lng: longitude }

      const now = Date.now()
      // Push if enough time has passed OR accuracy is good
      if (now - lastPushRef.current > intervalMs || (accuracy && accuracy < 20)) {
        lastPushRef.current = now
        pushToSupabase(latitude, longitude, accuracy)
      }
    }

    const handleError = (err: GeolocationPositionError) => {
      console.warn('Geolocation error:', err.message)
    }

    // watchPosition with high accuracy — this is the primary source
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 3000,      // use cached if < 3s old
        timeout: 15000,
      }
    )

    // Backup interval: push last known position every intervalMs
    intervalRef.current = setInterval(() => {
      if (lastPosRef.current) {
        const { lat, lng } = lastPosRef.current
        // Fresh push to keep updated_at current (heartbeat)
        pushToSupabase(lat, lng)
      } else {
        // If no watchPosition result yet, try getCurrentPosition
        navigator.geolocation.getCurrentPosition(
          pos => {
            lastPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            pushToSupabase(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
          },
          err => console.warn('getCurrentPosition fallback error:', err),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        )
      }
    }, intervalMs)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, technicianId, intervalMs, pushToSupabase])

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    lastPosRef.current = null
    // Remove from live_locations on checkout
    if (technicianId) {
      await supabase.from('live_locations').delete().eq('technician_id', technicianId)
    }
  }, [technicianId])

  return { stopTracking }
}
