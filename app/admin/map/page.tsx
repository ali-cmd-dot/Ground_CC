'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, RefreshCw, Navigation } from 'lucide-react'

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
  const accuracyCirclesRef = useRef<Record<string, any>>({})
  const trailsRef = useRef<Record<string, [number, number][]>>({})
  const trailPolysRef = useRef<Record<string, any>>({})
  const LRef = useRef<any>(null)
  const [technicians, setTechnicians] = useState<TechLoc[]>([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from('live_locations')
      .select('*, technicians:technician_id(id,name)')
    if (!error && data) {
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
      setLastUpdate(new Date())
    }
    setLoading(false)
  }

  // Realtime subscription
  useEffect(() => {
    fetchLocations()
    const channel = supabase.channel('live-map-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations' }, () => {
        fetchLocations()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!mapReady && technicians.length > 0) {
      initMap()
    } else if (mapReady && technicians.length > 0) {
      updatePositions()
    }
  }, [technicians])

  const markerHtml = (tech: TechLoc) => {
    const secAgo = Math.floor((Date.now() - new Date(tech.updatedAt).getTime()) / 1000)
    const fresh = secAgo < 45
    const nameLen = tech.name.length
    return `
      <div style="position:relative;display:inline-flex;align-items:center;">
        ${fresh ? `
          <div style="position:absolute;top:-10px;left:-10px;right:-10px;bottom:-10px;
            border-radius:50%;background:rgba(34,197,94,0.12);
            animation:rpl 2s ease-out infinite;pointer-events:none;"></div>
          <div style="position:absolute;top:-6px;left:-6px;right:-6px;bottom:-6px;
            border-radius:50%;background:rgba(34,197,94,0.08);
            animation:rpl 2s ease-out 0.6s infinite;pointer-events:none;"></div>
        ` : ''}
        <div style="
          background:linear-gradient(135deg,#1e40af,#2563eb);
          color:#fff;padding:7px 14px 7px 10px;
          border-radius:22px;
          font-size:12px;font-weight:700;
          white-space:nowrap;
          border:2px solid rgba(255,255,255,0.35);
          box-shadow:0 4px 20px rgba(37,99,235,0.65), 0 0 0 1px rgba(37,99,235,0.3);
          display:flex;align-items:center;gap:7px;
          position:relative;
          font-family:system-ui;
        ">
          <div style="
            width:8px;height:8px;border-radius:50%;
            background:${fresh ? '#4ade80' : '#9ca3af'};
            flex-shrink:0;
            ${fresh ? 'box-shadow:0 0 10px #4ade80;animation:blk 1.5s ease-in-out infinite;' : ''}
          "></div>
          👷 ${tech.name}
        </div>
      </div>
    `
  }

  const initMap = async () => {
    if (!mapContainerRef.current || mapReady) return
    try {
      const L = (await import('leaflet')).default
      LRef.current = L
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      // Center on first tech or India
      const center: [number, number] = technicians.length > 0
        ? [technicians[0].lat, technicians[0].lng]
        : [20.5937, 78.9629]

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(center, 14)

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.control.attribution({ position: 'bottomleft', prefix: '' }).addTo(map)

      // Dark map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CARTO',
        subdomains: 'abcd', maxZoom: 19
      }).addTo(map)

      // Add all technician markers
      technicians.forEach(tech => {
        // Accuracy circle
        if (tech.accuracy && tech.accuracy < 500) {
          const circle = L.circle([tech.lat, tech.lng], {
            radius: tech.accuracy,
            color: '#22c55e',
            fillColor: '#22c55e',
            fillOpacity: 0.05,
            weight: 1,
            opacity: 0.3
          }).addTo(map)
          accuracyCirclesRef.current[tech.id] = circle
        }

        const icon = L.divIcon({
          html: markerHtml(tech),
          className: '',
          iconAnchor: [Math.max(55, tech.name.length * 4 + 40), 18]
        })
        const marker = L.marker([tech.lat, tech.lng], { icon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(popupHtml(tech), { maxWidth: 220 })

        markersRef.current[tech.id] = marker
        trailsRef.current[tech.id] = [[tech.lat, tech.lng]]
      })

      if (technicians.length > 1) {
        map.fitBounds(
          L.latLngBounds(technicians.map(t => [t.lat, t.lng] as [number, number])),
          { padding: [80, 80] }
        )
      }

      setTimeout(() => map.invalidateSize(), 150)
      mapRef.current = map
      setMapReady(true)
    } catch (err) { console.error('Map error:', err) }
  }

  const popupHtml = (tech: TechLoc) => {
    const secAgo = Math.floor((Date.now() - new Date(tech.updatedAt).getTime()) / 1000)
    const timeStr = secAgo < 60 ? `${secAgo}s ago` : `${Math.floor(secAgo / 60)}m ago`
    return `
      <div style="font-family:system-ui;padding:2px;">
        <div style="font-weight:800;font-size:15px;color:#fff;margin-bottom:4px;">👷 ${tech.name}</div>
        <div style="font-size:12px;color:#9ca3af;margin-bottom:2px;">
          Updated: ${timeStr} · ${new Date(tech.updatedAt).toLocaleTimeString()}
        </div>
        ${tech.accuracy ? `<div style="font-size:11px;color:#6b7280;">GPS Accuracy: ±${Math.round(tech.accuracy)}m</div>` : ''}
        <div style="font-size:11px;color:#4b5563;margin-top:4px;font-family:monospace;">
          ${tech.lat.toFixed(6)}, ${tech.lng.toFixed(6)}
        </div>
        <button onclick="window.open('https://www.google.com/maps/search/?api=1&query=${tech.lat},${tech.lng}','_blank')"
          style="margin-top:8px;background:rgba(37,99,235,0.15);border:1px solid rgba(37,99,235,0.3);
          color:#93c5fd;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:600;
          cursor:pointer;font-family:system-ui;">
          Open in Maps
        </button>
      </div>
    `
  }

  const updatePositions = () => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return

    technicians.forEach(tech => {
      const newPos: [number, number] = [tech.lat, tech.lng]

      // Update or create marker
      if (markersRef.current[tech.id]) {
        markersRef.current[tech.id].setLatLng(newPos)
        markersRef.current[tech.id].setIcon(
          L.divIcon({
            html: markerHtml(tech),
            className: '',
            iconAnchor: [Math.max(55, tech.name.length * 4 + 40), 18]
          })
        )
        markersRef.current[tech.id].setPopupContent(popupHtml(tech))
      } else {
        const icon = L.divIcon({
          html: markerHtml(tech),
          className: '',
          iconAnchor: [Math.max(55, tech.name.length * 4 + 40), 18]
        })
        markersRef.current[tech.id] = L.marker(newPos, { icon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(popupHtml(tech), { maxWidth: 220 })
        trailsRef.current[tech.id] = []
      }

      // Update accuracy circle
      if (tech.accuracy && tech.accuracy < 500) {
        if (accuracyCirclesRef.current[tech.id]) {
          accuracyCirclesRef.current[tech.id].setLatLng(newPos)
          accuracyCirclesRef.current[tech.id].setRadius(tech.accuracy)
        } else {
          accuracyCirclesRef.current[tech.id] = L.circle(newPos, {
            radius: tech.accuracy, color: '#22c55e', fillColor: '#22c55e',
            fillOpacity: 0.05, weight: 1, opacity: 0.3
          }).addTo(map)
        }
      }

      // Update trail
      const trail = trailsRef.current[tech.id] || []
      const last = trail[trail.length - 1]
      const MIN_MOVEMENT = 0.00005 // ~5 meters
      const moved = !last || (Math.abs(last[0] - tech.lat) + Math.abs(last[1] - tech.lng)) > MIN_MOVEMENT

      if (moved) {
        trail.push(newPos)
        if (trail.length > 80) trail.splice(0, trail.length - 80)
        trailsRef.current[tech.id] = trail

        // Redraw trail with gradient effect
        if (trailPolysRef.current[tech.id]) {
          try { map.removeLayer(trailPolysRef.current[tech.id]) } catch {}
        }

        if (trail.length >= 2) {
          const poly = L.polyline(trail, {
            color: '#22c55e',
            weight: 4,
            opacity: 0.7,
            lineJoin: 'round',
            lineCap: 'round'
          }).addTo(map)
          trailPolysRef.current[tech.id] = poly

          // Head dot at current position
          const head = L.circleMarker(newPos, {
            radius: 6, color: '#22c55e', fillColor: '#4ade80',
            fillOpacity: 1, weight: 2, opacity: 0.9
          }).addTo(map)
          setTimeout(() => { try { map.removeLayer(head) } catch {} }, 30000)
        }
      }
    })

    // Remove departed techs
    Object.keys(markersRef.current).forEach(id => {
      if (!technicians.find(t => t.id === id)) {
        try {
          map.removeLayer(markersRef.current[id])
          if (accuracyCirclesRef.current[id]) map.removeLayer(accuracyCirclesRef.current[id])
          if (trailPolysRef.current[id]) map.removeLayer(trailPolysRef.current[id])
        } catch {}
        delete markersRef.current[id]
        delete accuracyCirclesRef.current[id]
        delete trailPolysRef.current[id]
      }
    })
  }

  const focusTech = (tech: TechLoc) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo([tech.lat, tech.lng], 16, { duration: 1.2 })
    markersRef.current[tech.id]?.openPopup()
  }

  const timeAgo = (ts: string) => {
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (s < 60) return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#06060d', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes rpl{0%{transform:scale(1);opacity:0.6}100%{transform:scale(3.5);opacity:0}}
        @keyframes blk{0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .leaflet-popup-content-wrapper{
          background:#13131f!important;border:1px solid rgba(255,255,255,0.1)!important;
          color:white!important;border-radius:14px!important;
          box-shadow:0 12px 40px rgba(0,0,0,0.7)!important;padding:0!important;
        }
        .leaflet-popup-content{margin:14px 16px!important;}
        .leaflet-popup-tip{background:#13131f!important;}
        .leaflet-container{background:#0a0a14!important;}
        .leaflet-control-zoom a{
          background:#13131f!important;border-color:rgba(255,255,255,0.08)!important;
          color:white!important;width:32px!important;height:32px!important;line-height:32px!important;
        }
        .leaflet-control-attribution{background:rgba(0,0,0,0.5)!important;color:rgba(255,255,255,0.2)!important;font-size:9px!important;}
        .tech-chip{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.08);border-radius:20px;
          padding:7px 13px;cursor:pointer;flex-shrink:0;
          transition:border-color 0.2s,background 0.2s;white-space:nowrap;}
        .tech-chip:hover{background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.15);}
        .tech-chip.fresh{border-color:rgba(34,197,94,0.25);background:rgba(34,197,94,0.06);}
      `}</style>

      {/* HEADER */}
      <div style={{ background: '#0c0c14', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#fff', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <p style={{ fontSize: '15px', fontWeight: '700', color: '#fff', lineHeight: 1 }}>Live Tracking</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>Real-time movement trail</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {lastUpdate && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
              Updated {timeAgo(lastUpdate.toISOString())}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: '8px', padding: '5px 10px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: '600' }}>Live</span>
          </div>
          <button onClick={fetchLocations} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#fff', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* TECH CHIPS STRIP */}
      <div style={{ background: '#0c0c14', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '8px 12px', overflowX: 'auto', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '7px', minWidth: 'max-content', alignItems: 'center' }}>
          {loading ? (
            <span style={{ fontSize: '12px', color: '#4b5563' }}>Loading locations…</span>
          ) : technicians.length === 0 ? (
            <span style={{ fontSize: '12px', color: '#4b5563' }}>No technicians online. They appear when checked in.</span>
          ) : technicians.map(tech => {
            const secAgo = Math.floor((Date.now() - new Date(tech.updatedAt).getTime()) / 1000)
            const fresh = secAgo < 45
            return (
              <button key={tech.id} className={`tech-chip ${fresh ? 'fresh' : ''}`} onClick={() => focusTech(tech)}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: fresh ? '#4ade80' : '#6b7280', boxShadow: fresh ? '0 0 8px #4ade80' : 'none', flexShrink: 0, animation: fresh ? 'pulse 2s infinite' : 'none' }} />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>{tech.name}</span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)' }}>
                  {secAgo < 60 ? `${secAgo}s` : `${Math.floor(secAgo / 60)}m`}
                </span>
                {tech.accuracy && tech.accuracy < 30 && (
                  <span style={{ fontSize: '10px', color: '#4ade80', background: 'rgba(74,222,128,0.1)', padding: '1px 5px', borderRadius: '5px' }}>±{Math.round(tech.accuracy)}m</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* LEGEND */}
      <div style={{ background: '#0c0c14', padding: '5px 14px 6px', display: 'flex', gap: '16px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ display: 'inline-block', width: '22px', height: '3px', background: 'linear-gradient(to right, rgba(74,222,128,0.3), #4ade80)', borderRadius: '2px' }} />
          Movement trail
        </span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(34,197,94,0.2)', border: '2px solid #22c55e' }} />
          GPS accuracy circle
        </span>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80' }} />
          Online · 
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6b7280', marginLeft: '-2px' }} />
          Stale
        </span>
      </div>

      {/* MAP */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06060d', zIndex: 10, flexDirection: 'column', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #22c55e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#4b5563', fontSize: '13px' }}>
              {technicians.length === 0
                ? 'Waiting for technicians to check in…'
                : `Loading map for ${technicians.length} technician${technicians.length > 1 ? 's' : ''}…`}
            </p>
          </div>
        )}
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  )
}
