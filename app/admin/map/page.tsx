'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, RefreshCw } from 'lucide-react'

interface TechLoc {
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
  const trailsRef = useRef<Record<string, [number, number][]>>({})
  const trailPolyRef = useRef<Record<string, any>>({})
  const LRef = useRef<any>(null)
  const [technicians, setTechnicians] = useState<TechLoc[]>([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)

  const fetchLocations = async () => {
    const { data } = await supabase
      .from('live_locations')
      .select('*, technicians:technician_id(id,name)')
    if (data) {
      const locs: TechLoc[] = data
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
    setLoading(false)
  }

  // Realtime subscription
  useEffect(() => {
    fetchLocations()
    const channel = supabase.channel('live-map-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations' }, fetchLocations)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Init map once
  useEffect(() => {
    if (!mapReady && technicians.length > 0) initMap()
    else if (mapReady) updateMap()
  }, [technicians])

  const makeMarkerHTML = (tech: TechLoc) => {
    const secAgo = Math.floor((Date.now() - new Date(tech.updatedAt).getTime()) / 1000)
    const fresh = secAgo < 30
    return `<div style="position:relative;display:inline-block;">
      ${fresh ? `<div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(34,197,94,0.2);animation:ripple3 1.8s ease-out infinite;"></div>` : ''}
      <div style="background:linear-gradient(135deg,#15803d,#16a34a);color:#fff;padding:5px 11px;border-radius:18px;font-size:11px;font-weight:700;white-space:nowrap;border:1.5px solid rgba(255,255,255,0.3);box-shadow:0 4px 16px rgba(22,163,74,0.55);display:flex;align-items:center;gap:6px;position:relative;">
        <div style="width:7px;height:7px;border-radius:50%;background:${fresh ? '#4ade80' : '#9ca3af'};${fresh ? 'box-shadow:0 0 8px #4ade80;animation:blink 1s ease-in-out infinite;' : ''}"></div>
        👷 ${tech.name}
      </div>
    </div>`
  }

  const initMap = async () => {
    if (!mapContainerRef.current || mapReady) return
    try {
      const L = (await import('leaflet')).default
      LRef.current = L
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      const center: [number, number] = technicians[0]
        ? [technicians[0].lat, technicians[0].lng]
        : [20.5937, 78.9629]

      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView(center, 13)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO', subdomains: 'abcd', maxZoom: 19
      }).addTo(map)

      technicians.forEach(tech => {
        const icon = L.divIcon({ html: makeMarkerHTML(tech), className: '', iconAnchor: [60, 18] })
        const marker = L.marker([tech.lat, tech.lng], { icon }).addTo(map)
          .bindPopup(`<strong>👷 ${tech.name}</strong><br><small style="color:#9ca3af;">Updated: ${new Date(tech.updatedAt).toLocaleTimeString()}</small>${tech.accuracy ? `<br><small style="color:#6b7280;">±${Math.round(tech.accuracy)}m</small>` : ''}`)
        markersRef.current[tech.id] = marker

        // Initialize trail array
        trailsRef.current[tech.id] = [[tech.lat, tech.lng]]
      })

      if (technicians.length > 1) {
        map.fitBounds(L.latLngBounds(technicians.map(t => [t.lat, t.lng] as [number, number])), { padding: [60, 60] })
      }

      setTimeout(() => map.invalidateSize(), 150)
      mapRef.current = map
      setMapReady(true)
    } catch (err) { console.error(err) }
  }

  const updateMap = () => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return

    technicians.forEach(tech => {
      const newLatLng: [number, number] = [tech.lat, tech.lng]

      if (markersRef.current[tech.id]) {
        // Animate marker to new position
        markersRef.current[tech.id].setLatLng(newLatLng)
        markersRef.current[tech.id].setIcon(
          L.divIcon({ html: makeMarkerHTML(tech), className: '', iconAnchor: [60, 18] })
        )
      } else {
        const icon = L.divIcon({ html: makeMarkerHTML(tech), className: '', iconAnchor: [60, 18] })
        const marker = L.marker(newLatLng, { icon }).addTo(map)
          .bindPopup(`<strong>👷 ${tech.name}</strong>`)
        markersRef.current[tech.id] = marker
        trailsRef.current[tech.id] = []
      }

      // Update trail
      if (!trailsRef.current[tech.id]) trailsRef.current[tech.id] = []
      const trail = trailsRef.current[tech.id]

      // Only add point if moved more than ~10m
      const last = trail[trail.length - 1]
      const moved = !last || Math.hypot(last[0] - tech.lat, last[1] - tech.lng) > 0.0001
      if (moved) {
        trail.push(newLatLng)
        if (trail.length > 60) trail.shift() // keep last 60 points

        // Redraw trail polyline
        if (trailPolyRef.current[tech.id]) {
          try { map.removeLayer(trailPolyRef.current[tech.id]) } catch {}
        }
        if (trail.length > 1) {
          const poly = L.polyline(trail, {
            color: '#4ade80',
            weight: 3,
            opacity: 0.6,
            lineJoin: 'round',
          }).addTo(map)
          trailPolyRef.current[tech.id] = poly

          // Gradient effect: add small dots along recent trail
          trail.slice(-5).forEach((pt, i) => {
            const dot = L.circleMarker(pt, {
              radius: 3 - i * 0.4,
              color: '#4ade80',
              fillColor: '#4ade80',
              fillOpacity: (0.6 - i * 0.1),
              weight: 0
            }).addTo(map)
            // Remove dots after 5 minutes
            setTimeout(() => { try { map.removeLayer(dot) } catch {} }, 300000)
          })
        }
      }
    })

    // Remove stale techs
    Object.keys(markersRef.current).forEach(id => {
      if (!technicians.find(t => t.id === id)) {
        try { map.removeLayer(markersRef.current[id]) } catch {}
        delete markersRef.current[id]
        if (trailPolyRef.current[id]) {
          try { map.removeLayer(trailPolyRef.current[id]) } catch {}
          delete trailPolyRef.current[id]
        }
      }
    })

    map.invalidateSize()
  }

  const secAgo = (ts: string) => {
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#06060d', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes ripple3{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.5);opacity:0}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        .leaflet-popup-content-wrapper{background:#13131f!important;border:1px solid rgba(255,255,255,0.1)!important;color:white!important;border-radius:14px!important;}
        .leaflet-popup-tip{background:#13131f!important;}
        .leaflet-container{background:#0a0a14!important;}
        .leaflet-control-zoom a{background:#13131f!important;border-color:rgba(255,255,255,0.08)!important;color:white!important;}
      `}</style>

      {/* Header */}
      <div style={{ background: '#0c0c14', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#fff', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <p style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>Live Tracking</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)' }}>Movement trail + real-time position</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: '8px', padding: '5px 10px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: '600' }}>Live</span>
          </div>
          <button onClick={fetchLocations} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#fff', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Tech chips */}
      <div style={{ background: '#0c0c14', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '8px 12px', overflowX: 'auto', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '7px', minWidth: 'max-content' }}>
          {loading ? (
            <span style={{ fontSize: '12px', color: '#4b5563' }}>Loading…</span>
          ) : technicians.length === 0 ? (
            <span style={{ fontSize: '12px', color: '#4b5563' }}>No technicians online right now</span>
          ) : technicians.map(tech => (
            <button key={tech.id} onClick={() => {
              if (mapRef.current && LRef.current) {
                mapRef.current.setView([tech.lat, tech.lng], 16)
                markersRef.current[tech.id]?.openPopup()
              }
            }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '20px', padding: '5px 12px', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>{tech.name}</span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{secAgo(tech.updatedAt)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ background: '#0c0c14', padding: '5px 14px', display: 'flex', gap: '12px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ display: 'inline-block', width: '20px', height: '3px', background: '#4ade80', borderRadius: '2px' }} />
          Movement trail
        </span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
          Current position
        </span>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06060d', zIndex: 10, flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #22c55e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#4b5563', fontSize: '13px' }}>
              {technicians.length === 0 ? 'No technicians online — map ready when they check in' : 'Loading map…'}
            </p>
          </div>
        )}
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  )
}
