'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, RefreshCw, Activity, Users, Maximize2 } from 'lucide-react'

interface TechLocation {
  id: string
  name: string
  lat: number
  lng: number
  accuracy?: number
  updatedAt: string
}

export default function LiveMapPage() {
  const router = useRouter()
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Record<string, any>>({})
  const [technicians, setTechnicians] = useState<TechLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const LRef = useRef<any>(null)

  useEffect(() => {
    fetchLocations()

    // Supabase Realtime subscription for live_locations
    const channel = supabase.channel('live-tracking')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'live_locations'
      }, async (payload) => {
        await fetchLocations()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!mapReady && technicians.length > 0) initMap()
    else if (mapReady) updateMarkers()
  }, [technicians])

  const fetchLocations = async () => {
    try {
      const { data } = await supabase
        .from('live_locations')
        .select('*, technicians:technician_id(id, name)')

      if (data) {
        const locs: TechLocation[] = data
          .filter((d: any) => d.latitude && d.longitude)
          .map((d: any) => ({
            id: d.technician_id,
            name: d.technicians?.name || 'Unknown',
            lat: d.latitude,
            lng: d.longitude,
            accuracy: d.accuracy,
            updatedAt: d.updated_at,
          }))
        setTechnicians(locs)
      }
    } finally { setLoading(false) }
  }

  const makeIcon = (L: any, tech: TechLocation) => {
    const secAgo = Math.floor((Date.now() - new Date(tech.updatedAt).getTime()) / 1000)
    const isRecent = secAgo < 60
    return L.divIcon({
      html: `<div style="position:relative;">
        ${isRecent ? `<div style="position:absolute;top:-4px;left:-4px;right:-4px;bottom:-4px;border-radius:50%;background:rgba(34,197,94,0.2);animation:ripple 2s infinite;"></div>` : ''}
        <div style="background:linear-gradient(135deg,#16a34a,#15803d);color:white;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 4px 15px rgba(22,163,74,0.5);border:2px solid rgba(255,255,255,0.3);position:relative;">
          <span style="margin-right:4px;">👷</span>${tech.name}
          ${isRecent ? '<span style="display:inline-block;width:6px;height:6px;background:#4ade80;border-radius:50%;margin-left:4px;vertical-align:middle;box-shadow:0 0 6px #4ade80;"></span>' : ''}
        </div>
      </div>`,
      className: '',
      iconAnchor: [60, 16]
    })
  }

  const initMap = async () => {
    if (!mapContainerRef.current || mapReady) return
    try {
      const L = (await import('leaflet')).default
      LRef.current = L
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      const center = technicians[0]
        ? [technicians[0].lat, technicians[0].lng] as [number, number]
        : [20.5937, 78.9629] as [number, number]

      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView(center, 13)
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO', subdomains: 'abcd', maxZoom: 19
      }).addTo(map)

      technicians.forEach(tech => {
        const marker = L.marker([tech.lat, tech.lng], { icon: makeIcon(L, tech) })
          .addTo(map)
          .bindPopup(`<div style="font-family:system-ui;color:#fff;min-width:160px;background:#1a1a2e;padding:8px;">
            <strong>${tech.name}</strong><br>
            <small style="color:#9ca3af;">Updated: ${new Date(tech.updatedAt).toLocaleTimeString()}</small><br>
            ${tech.accuracy ? `<small style="color:#9ca3af;">Accuracy: ±${Math.round(tech.accuracy)}m</small>` : ''}
          </div>`)
        markersRef.current[tech.id] = marker
      })

      if (technicians.length > 1) {
        map.fitBounds(L.latLngBounds(technicians.map(t => [t.lat, t.lng] as [number, number])), { padding: [60, 60] })
      }

      setTimeout(() => map.invalidateSize(), 200)
      mapRef.current = map
      setMapReady(true)
    } catch (err) { console.error('Map error:', err) }
  }

  const updateMarkers = async () => {
    const L = LRef.current
    if (!mapRef.current || !L) return

    technicians.forEach(tech => {
      const existing = markersRef.current[tech.id]
      if (existing) {
        // Smooth animate to new position
        existing.setLatLng([tech.lat, tech.lng])
        existing.setIcon(makeIcon(L, tech))
      } else {
        const marker = L.marker([tech.lat, tech.lng], { icon: makeIcon(L, tech) })
          .addTo(mapRef.current)
          .bindPopup(`<strong>${tech.name}</strong>`)
        markersRef.current[tech.id] = marker
      }
    })

    // Remove markers for techs no longer online
    Object.keys(markersRef.current).forEach(id => {
      if (!technicians.find(t => t.id === id)) {
        markersRef.current[id].remove()
        delete markersRef.current[id]
      }
    })

    mapRef.current.invalidateSize()
  }

  const secAgo = (ts: string) => {
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#06060d', fontFamily: 'system-ui,sans-serif' }}>
      <style>{`
        @keyframes ripple { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2);opacity:0} }
        .leaflet-popup-content-wrapper{background:#1a1a2e!important;border:1px solid rgba(255,255,255,0.1)!important;color:white!important;border-radius:12px!important;}
        .leaflet-popup-tip{background:#1a1a2e!important;}
        .leaflet-container{background:#0a0a1a!important;}
        .leaflet-control-zoom a{background:#1a1a2e!important;border-color:rgba(255,255,255,0.1)!important;color:white!important;}
      `}</style>

      {/* Header */}
      <div style={{ background: '#0a0a12', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <p style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>Live Tracking</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Real-time locations</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '6px 10px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: '600' }}>Live</span>
          </div>
          <button onClick={fetchLocations} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#fff', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Body — map + sidebar stacked on mobile, side by side on desktop */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

        {/* Technician chips - horizontal scroll on mobile */}
        <div style={{ background: '#0a0a12', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 12px', overflowX: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px', minWidth: 'max-content' }}>
            {loading ? (
              <span style={{ fontSize: '13px', color: '#6b7280', padding: '4px 0' }}>Loading...</span>
            ) : technicians.length === 0 ? (
              <span style={{ fontSize: '13px', color: '#6b7280', padding: '4px 0' }}>No technicians currently online</span>
            ) : technicians.map(tech => (
              <div key={tech.id} onClick={() => {
                if (mapRef.current && LRef.current) {
                  mapRef.current.setView([tech.lat, tech.lng], 15)
                  markersRef.current[tech.id]?.openPopup()
                }
              }} style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '20px', padding: '6px 12px', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{tech.name}</span>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{secAgo(tech.updatedAt)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Map — full remaining height */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {!mapReady && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06060d', zIndex: 10, flexDirection: 'column', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid #22c55e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#6b7280', fontSize: '13px' }}>
                {technicians.length === 0 ? 'Waiting for technicians to go live...' : 'Loading map...'}
              </p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
