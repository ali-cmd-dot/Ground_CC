'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, RefreshCw } from 'lucide-react'

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e'
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#f97316', assigned: '#60a5fa', 'in-progress': '#a78bfa', completed: '#34d399', cancelled: '#6b7280'
}

export default function IssuesMapPage() {
  const router = useRouter()
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const routeLayersRef = useRef<any[]>([])
  const LRef = useRef<any>(null)
  const [issues, setIssues] = useState<any[]>([])
  const [techs, setTechs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [routeStatus, setRouteStatus] = useState('')
  const [colorMode, setColorMode] = useState<'priority' | 'status'>('priority')
  const [showLines, setShowLines] = useState(true)
  const [showTechs, setShowTechs] = useState(true)
  const [stats, setStats] = useState({ total: 0, withGPS: 0, techsOnline: 0 })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: issueData }, { data: techData }] = await Promise.all([
        supabase.from('issues').select('*, technicians:assigned_to(id,name)')
          .not('latitude', 'is', null).not('longitude', 'is', null)
          .neq('status', 'cancelled').neq('status', 'completed'),
        supabase.from('live_locations').select('*, technicians:technician_id(id,name)')
      ])
      const is = issueData || []
      const ts = (techData || []).filter((t: any) => t.latitude && t.longitude)
      setIssues(is)
      setTechs(ts)
      setStats({ total: is.length, withGPS: is.length, techsOnline: ts.length })
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const getColor = (issue: any) =>
    colorMode === 'priority' ? (PRIORITY_COLOR[issue.priority] || '#9ca3af') : (STATUS_COLOR[issue.status] || '#9ca3af')

  // OSRM real road route fetch
  const getOSRMRoute = async (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      const data = await res.json()
      if (data.code === 'Ok' && data.routes?.[0]) {
        const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number])
        const distKm = (data.routes[0].distance / 1000).toFixed(1)
        const durMin = Math.round(data.routes[0].duration / 60)
        return { coords, distKm, durMin }
      }
    } catch {}
    return null
  }

  const clearRoutes = () => {
    routeLayersRef.current.forEach(l => { try { mapRef.current?.removeLayer(l) } catch {} })
    routeLayersRef.current = []
  }

  const drawRoutes = useCallback(async () => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map || !showLines || techs.length === 0) return

    setRouteStatus('Loading road routes…')
    let loaded = 0
    const total = Math.min(techs.length * 3, techs.length * issues.length)

    for (const tech of techs) {
      if (!showTechs) break

      const sorted = [...issues].sort((a, b) => {
        const dA = Math.hypot(a.latitude - tech.latitude, a.longitude - tech.longitude)
        const dB = Math.hypot(b.latitude - tech.latitude, b.longitude - tech.longitude)
        return dA - dB
      }).slice(0, 3)

      for (const issue of sorted) {
        const color = getColor(issue)
        const route = await getOSRMRoute(tech.latitude, tech.longitude, issue.latitude, issue.longitude)

        if (route && route.coords.length > 1) {
          // Real road polyline
          const poly = L.polyline(route.coords, {
            color, weight: 3.5, opacity: 0.75,
            lineJoin: 'round', lineCap: 'round'
          }).addTo(map)

          // Distance badge at midpoint
          const midIdx = Math.floor(route.coords.length / 2)
          const mid = route.coords[midIdx]
          const badge = L.marker(mid, {
            icon: L.divIcon({
              html: `<div style="background:rgba(0,0,0,0.82);color:${color};font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px;border:1px solid ${color}50;white-space:nowrap;backdrop-filter:blur(4px);">${route.distKm} km · ${route.durMin} min</div>`,
              className: '', iconAnchor: [40, 10]
            })
          }).addTo(map)

          routeLayersRef.current.push(poly, badge)
        } else {
          // Fallback straight dashed line
          const line = L.polyline(
            [[tech.latitude, tech.longitude], [issue.latitude, issue.longitude]],
            { color, weight: 2, opacity: 0.4, dashArray: '8,8' }
          ).addTo(map)
          routeLayersRef.current.push(line)
        }

        loaded++
        setRouteStatus(`Loading routes… ${loaded}/${Math.min(total, techs.length * 3)}`)
      }
    }
    setRouteStatus('')
  }, [techs, issues, showLines, showTechs, colorMode])

  const initMap = useCallback(async () => {
    if (!mapContainerRef.current || mapReady) return
    try {
      const L = (await import('leaflet')).default
      LRef.current = L
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      const allPts = [
        ...issues.map(i => [i.latitude, i.longitude] as [number, number]),
        ...techs.map(t => [t.latitude, t.longitude] as [number, number])
      ]
      const center: [number, number] = allPts.length
        ? [allPts.reduce((s, p) => s + p[0], 0) / allPts.length, allPts.reduce((s, p) => s + p[1], 0) / allPts.length]
        : [20.5937, 78.9629]

      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView(center, 6)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO', subdomains: 'abcd', maxZoom: 19
      }).addTo(map)

      // Issue markers
      issues.forEach(issue => {
        const color = getColor(issue)
        const icon = L.divIcon({
          html: `<div style="width:13px;height:13px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.5);box-shadow:0 0 10px ${color}90;cursor:pointer;"></div>`,
          className: '', iconSize: [13, 13], iconAnchor: [6, 6]
        })
        L.marker([issue.latitude, issue.longitude], { icon }).addTo(map).bindPopup(`
          <div style="font-family:system-ui;min-width:190px;padding:2px;">
            <div style="font-weight:700;font-size:14px;letter-spacing:0.5px;">${issue.vehicle_no}</div>
            <div style="font-size:12px;color:#9ca3af;margin-top:2px;">${issue.client}</div>
            ${issue.city ? `<div style="font-size:11px;color:#6b7280;margin-top:1px;">📍 ${issue.city}${issue.location ? ` · ${issue.location}` : ''}</div>` : ''}
            <div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap;">
              <span style="font-size:10px;padding:2px 7px;border-radius:8px;background:${color}22;color:${color};border:1px solid ${color}44;font-weight:600;">${issue.priority}</span>
              <span style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.7);">${issue.status}</span>
            </div>
            <div style="margin-top:6px;font-size:11px;">
              ${issue.technicians ? `<span style="color:#60a5fa;">👷 ${issue.technicians.name}</span>` : '<span style="color:#f97316;">⚠ Unassigned</span>'}
            </div>
          </div>
        `)
      })

      // Technician live markers with names
      if (showTechs) {
        techs.forEach(tech => {
          const name = tech.technicians?.name || 'Tech'
          const icon = L.divIcon({
            html: `<div style="position:relative;display:inline-block;">
              <div style="position:absolute;top:-5px;left:-5px;right:-5px;bottom:-5px;border-radius:50%;background:rgba(59,130,246,0.15);animation:ripple2 2s ease-out infinite;"></div>
              <div style="background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff;padding:5px 11px;border-radius:16px;font-size:11px;font-weight:700;white-space:nowrap;border:1.5px solid rgba(255,255,255,0.25);box-shadow:0 4px 14px rgba(37,99,235,0.6);display:flex;align-items:center;gap:5px;position:relative;">
                <div style="width:6px;height:6px;border-radius:50%;background:#60a5fa;animation:pulse2 1.5s ease-in-out infinite;"></div>
                ${name}
              </div>
            </div>`,
            className: '',
            iconAnchor: [Math.max(40, name.length * 4), 16]
          })
          L.marker([tech.latitude, tech.longitude], { icon }).addTo(map)
            .bindPopup(`<strong>👷 ${name}</strong><br><small style="color:#9ca3af;">Live · ${new Date(tech.updated_at).toLocaleTimeString()}</small>`)
        })
      }

      if (allPts.length > 1) {
        map.fitBounds(L.latLngBounds(allPts), { padding: [60, 60] })
      } else if (allPts.length === 1) {
        map.setView(allPts[0], 12)
      }

      setTimeout(() => map.invalidateSize(), 100)
      mapRef.current = map
      setMapReady(true)

      await drawRoutes()
    } catch (err) { console.error(err) }
  }, [issues, techs, showTechs, drawRoutes])

  useEffect(() => {
    if (!mapReady && (issues.length > 0 || techs.length > 0)) { initMap() }
    else if (mapReady) { clearRoutes(); drawRoutes() }
  }, [issues, techs, mapReady, showLines, showTechs, colorMode])

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#06060d', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes ripple2{0%{transform:scale(1);opacity:0.5}100%{transform:scale(2.5);opacity:0}}
        @keyframes pulse2{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .leaflet-popup-content-wrapper{background:#13131f!important;border:1px solid rgba(255,255,255,0.1)!important;color:white!important;border-radius:14px!important;box-shadow:0 12px 40px rgba(0,0,0,0.6)!important;}
        .leaflet-popup-tip{background:#13131f!important;}
        .leaflet-container{background:#0a0a14!important;}
        .leaflet-control-zoom a{background:#13131f!important;border-color:rgba(255,255,255,0.08)!important;color:white!important;}
        .tbtn{padding:5px 11px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.55);font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;white-space:nowrap;}
        .tbtn.on{background:rgba(59,130,246,0.18);border-color:rgba(59,130,246,0.35);color:#93c5fd;}
      `}</style>

      {/* Header */}
      <div style={{ background: '#0c0c14', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#fff', flex: 1 }}>Issues Map</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button className={`tbtn ${colorMode === 'priority' ? 'on' : ''}`} onClick={() => setColorMode('priority')}>Priority</button>
          <button className={`tbtn ${colorMode === 'status' ? 'on' : ''}`} onClick={() => setColorMode('status')}>Status</button>
          <button className={`tbtn ${showLines ? 'on' : ''}`} onClick={() => setShowLines(v => !v)}>Routes</button>
          <button className={`tbtn ${showTechs ? 'on' : ''}`} onClick={() => setShowTechs(v => !v)}>Techs</button>
          <button className="tbtn" onClick={fetchData}><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ background: '#0c0c14', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0, overflowX: 'auto' }}>
        {[
          { label: 'Issues', val: stats.total, color: '#60a5fa' },
          { label: 'With GPS', val: stats.withGPS, color: '#4ade80' },
          { label: 'Techs Live', val: stats.techsOnline, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{s.label}:</span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>{s.val}</span>
          </div>
        ))}
        {routeStatus && (
          <span style={{ fontSize: '11px', color: '#4ade80', marginLeft: 'auto', flexShrink: 0 }}>⟳ {routeStatus}</span>
        )}
        <div style={{ marginLeft: routeStatus ? '8px' : 'auto', display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
          {Object.entries(colorMode === 'priority' ? PRIORITY_COLOR : STATUS_COLOR).map(([k, c]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c, display: 'inline-block' }} />{k}
            </span>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06060d', zIndex: 10, flexDirection: 'column', gap: '14px' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#4b5563', fontSize: '13px' }}>
              {loading ? 'Fetching issues…' : 'Rendering map with road routes…'}
            </p>
          </div>
        )}
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  )
}
