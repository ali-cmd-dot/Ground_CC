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
  const issueMarkersRef = useRef<any[]>([])
  const techMarkersRef = useRef<any[]>([])
  const LRef = useRef<any>(null)

  const [issues, setIssues] = useState<any[]>([])
  const [techs, setTechs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [routeStatus, setRouteStatus] = useState('')
  const [colorMode, setColorMode] = useState<'priority' | 'status'>('priority')
  const [showRoutes, setShowRoutes] = useState(true)
  const [showTechs, setShowTechs] = useState(true)
  const [stats, setStats] = useState({ total: 0, withGPS: 0, techsOnline: 0 })

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch ALL active issues with GPS
      const { data: issueData } = await supabase
        .from('issues')
        .select('*, technicians:assigned_to(id,name)')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .not('status', 'eq', 'cancelled')

      // Fetch live technician locations
      const { data: techData } = await supabase
        .from('live_locations')
        .select('*, technicians:technician_id(id,name)')

      const is = issueData || []
      const ts = (techData || []).filter((t: any) => t.latitude && t.longitude)
      setIssues(is)
      setTechs(ts)
      setStats({ total: is.length, withGPS: is.length, techsOnline: ts.length })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    if (!loading && (issues.length > 0 || techs.length > 0)) {
      if (!mapReady) {
        initMap()
      } else {
        rebuildMap()
      }
    }
  }, [loading, issues, techs, colorMode, showTechs])

  useEffect(() => {
    if (mapReady) {
      clearRoutes()
      if (showRoutes) drawAllRoutes()
    }
  }, [showRoutes, mapReady])

  const getColor = (issue: any) =>
    colorMode === 'priority'
      ? (PRIORITY_COLOR[issue.priority] || '#9ca3af')
      : (STATUS_COLOR[issue.status] || '#9ca3af')

  // Fetch real road route from OSRM
  const getRoute = async (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 10000)
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(timer)
      const data = await res.json()
      if (data.code === 'Ok' && data.routes?.[0]) {
        return {
          coords: data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]),
          distKm: (data.routes[0].distance / 1000).toFixed(0),
          durMin: Math.round(data.routes[0].duration / 60)
        }
      }
    } catch {}
    return null
  }

  const clearRoutes = () => {
    if (!mapRef.current) return
    routeLayersRef.current.forEach(l => { try { mapRef.current.removeLayer(l) } catch {} })
    routeLayersRef.current = []
  }

  const clearAllMarkers = () => {
    if (!mapRef.current) return
    ;[...issueMarkersRef.current, ...techMarkersRef.current].forEach(l => {
      try { mapRef.current.removeLayer(l) } catch {}
    })
    issueMarkersRef.current = []
    techMarkersRef.current = []
  }

  const drawIssueMarkers = () => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return

    issueMarkersRef.current.forEach(l => { try { map.removeLayer(l) } catch {} })
    issueMarkersRef.current = []

    issues.forEach((issue, idx) => {
      const color = getColor(issue)
      const icon = L.divIcon({
        html: `<div style="
          width:16px;height:16px;border-radius:50%;
          background:${color};
          border:2.5px solid rgba(255,255,255,0.6);
          box-shadow:0 0 12px ${color}AA, 0 0 0 3px ${color}22;
          cursor:pointer;
          transition:transform 0.2s;
        "></div>`,
        className: '', iconSize: [16, 16], iconAnchor: [8, 8]
      })

      const techName = issue.technicians?.name
      const popup = L.popup({ maxWidth: 220, className: 'custom-popup' }).setContent(`
        <div style="font-family:system-ui;padding:4px 2px;">
          <div style="font-weight:800;font-size:15px;letter-spacing:0.5px;color:#fff;margin-bottom:4px;">${issue.vehicle_no}</div>
          <div style="font-size:12px;color:#9ca3af;margin-bottom:2px;">${issue.client}</div>
          ${issue.city ? `<div style="font-size:11px;color:#6b7280;">📍 ${issue.city}${issue.location ? ' · ' + issue.location : ''}</div>` : ''}
          <div style="margin-top:10px;display:flex;gap:5px;flex-wrap:wrap;">
            <span style="font-size:10px;padding:3px 9px;border-radius:8px;background:${color}22;color:${color};border:1px solid ${color}44;font-weight:700;">${issue.priority}</span>
            <span style="font-size:10px;padding:3px 9px;border-radius:8px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);font-weight:600;">${issue.status}</span>
          </div>
          <div style="margin-top:8px;font-size:12px;">
            ${techName
              ? `<span style="color:#60a5fa;font-weight:600;">👷 ${techName}</span>`
              : `<span style="color:#f97316;">⚠ Unassigned</span>`}
          </div>
          ${issue.issue ? `<div style="margin-top:6px;font-size:11px;color:#6b7280;line-height:1.4;">${issue.issue.slice(0,80)}${issue.issue.length > 80 ? '…' : ''}</div>` : ''}
        </div>
      `)

      const marker = L.marker([issue.latitude, issue.longitude], { icon }).addTo(map).bindPopup(popup)
      issueMarkersRef.current.push(marker)
    })
  }

  const drawTechMarkers = () => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map || !showTechs) return

    techMarkersRef.current.forEach(l => { try { map.removeLayer(l) } catch {} })
    techMarkersRef.current = []

    techs.forEach(tech => {
      const name = tech.technicians?.name || 'Technician'
      const secAgo = Math.floor((Date.now() - new Date(tech.updated_at).getTime()) / 1000)
      const fresh = secAgo < 60

      const icon = L.divIcon({
        html: `<div style="position:relative;display:inline-block;">
          ${fresh ? `<div style="position:absolute;top:-8px;left:-8px;right:-8px;bottom:-8px;border-radius:50%;background:rgba(59,130,246,0.15);animation:rpl 2s ease-out infinite;pointer-events:none;"></div>` : ''}
          <div style="
            background:linear-gradient(135deg,#1d4ed8,#2563eb);
            color:white;padding:6px 13px;border-radius:20px;
            font-size:12px;font-weight:700;white-space:nowrap;
            border:2px solid rgba(255,255,255,0.3);
            box-shadow:0 4px 16px rgba(37,99,235,0.6);
            display:flex;align-items:center;gap:6px;position:relative;
            font-family:system-ui;
          ">
            <div style="width:7px;height:7px;border-radius:50%;background:${fresh ? '#4ade80' : '#9ca3af'};${fresh ? 'box-shadow:0 0 8px #4ade80;animation:blk 1.5s infinite;' : ''}"></div>
            👷 ${name}
          </div>
        </div>`,
        className: '',
        iconAnchor: [Math.max(50, name.length * 5 + 30), 18]
      })

      const marker = L.marker([tech.latitude, tech.longitude], { icon }).addTo(map)
        .bindPopup(`
          <div style="font-family:system-ui;padding:2px;">
            <strong style="color:#fff;font-size:14px;">👷 ${name}</strong><br>
            <small style="color:#9ca3af;">Updated: ${new Date(tech.updated_at).toLocaleTimeString()}</small><br>
            ${tech.accuracy ? `<small style="color:#6b7280;">Accuracy: ±${Math.round(tech.accuracy)}m</small>` : ''}
          </div>
        `)
      techMarkersRef.current.push(marker)
    })
  }

  // Draw routes from EACH technician to ALL their assigned issues
  const drawAllRoutes = useCallback(async () => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return

    // If no techs, draw routes between issues to show all dots connected
    if (techs.length === 0) {
      setRouteStatus('No technicians live — showing issue locations')
      return
    }

    setRouteStatus('Loading road routes…')
    let loaded = 0
    let total = 0

    // Count total routes to load
    for (const tech of techs) {
      const assigned = issues.filter(i => i.assigned_to === tech.technician_id)
      const unassigned = issues.filter(i => !i.assigned_to).slice(0, 3)
      total += assigned.length + (assigned.length === 0 ? Math.min(unassigned.length, 3) : 0)
    }

    for (const tech of techs) {
      // Find issues assigned to this tech + nearest unassigned if none
      let techIssues = issues.filter(i => i.assigned_to === tech.technician_id)
      if (techIssues.length === 0) {
        // Show nearest 5 issues from this tech
        techIssues = [...issues].sort((a, b) =>
          Math.hypot(a.latitude - tech.latitude, a.longitude - tech.longitude) -
          Math.hypot(b.latitude - tech.latitude, b.longitude - tech.longitude)
        ).slice(0, 5)
      }

      for (const issue of techIssues) {
        if (!issue.latitude || !issue.longitude) continue

        const color = getColor(issue)
        const route = await getRoute(tech.latitude, tech.longitude, issue.latitude, issue.longitude)
        loaded++
        setRouteStatus(`Loading routes… ${loaded}/${total || loaded}`)

        if (route && route.coords.length > 1) {
          // Real road polyline — bright, thick, visible
          const poly = L.polyline(route.coords, {
            color, weight: 4, opacity: 0.85, lineJoin: 'round', lineCap: 'round'
          }).addTo(map)

          // Distance + time label — positioned at 40% of route for visibility
          const labelIdx = Math.floor(route.coords.length * 0.4)
          const labelPt = route.coords[labelIdx]
          const badge = L.marker(labelPt, {
            icon: L.divIcon({
              html: `<div style="
                background:rgba(0,0,0,0.88);
                color:${color};
                font-size:11px;font-weight:800;
                padding:4px 10px;border-radius:12px;
                border:1.5px solid ${color};
                white-space:nowrap;
                backdrop-filter:blur(4px);
                box-shadow:0 2px 12px rgba(0,0,0,0.5);
                font-family:system-ui;
              ">${route.distKm} km · ${route.durMin} min</div>`,
              className: '',
              iconAnchor: [45, 12]
            }),
            interactive: false,
            zIndexOffset: 1000
          }).addTo(map)

          routeLayersRef.current.push(poly, badge)
        } else {
          // Straight dashed fallback
          const line = L.polyline(
            [[tech.latitude, tech.longitude], [issue.latitude, issue.longitude]],
            { color, weight: 2.5, opacity: 0.5, dashArray: '10,8' }
          ).addTo(map)
          routeLayersRef.current.push(line)
        }
      }
    }
    setRouteStatus('')
  }, [techs, issues, colorMode])

  const initMap = async () => {
    if (!mapContainerRef.current) return
    try {
      const L = (await import('leaflet')).default
      LRef.current = L
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      const allPts = [
        ...issues.map(i => [i.latitude, i.longitude] as [number, number]),
        ...techs.map(t => [t.latitude, t.longitude] as [number, number])
      ]

      const center: [number, number] = allPts.length > 0
        ? [allPts.reduce((s, p) => s + p[0], 0) / allPts.length, allPts.reduce((s, p) => s + p[1], 0) / allPts.length]
        : [20.5937, 78.9629]

      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView(center, 5)
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© CARTO', subdomains: 'abcd', maxZoom: 19
      }).addTo(map)

      mapRef.current = map
      setMapReady(true)

      drawIssueMarkers()
      drawTechMarkers()

      if (allPts.length > 0) {
        map.fitBounds(L.latLngBounds(allPts), { padding: [60, 60], maxZoom: 14 })
      }

      setTimeout(() => map.invalidateSize(), 100)

      if (showRoutes) await drawAllRoutes()
    } catch (err) { console.error('Map init error:', err) }
  }

  const rebuildMap = () => {
    drawIssueMarkers()
    drawTechMarkers()
    clearRoutes()
    if (showRoutes) drawAllRoutes()
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#06060d', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes rpl{0%{transform:scale(1);opacity:0.5}100%{transform:scale(3);opacity:0}}
        @keyframes blk{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .leaflet-popup-content-wrapper{
          background:#13131f!important;
          border:1px solid rgba(255,255,255,0.1)!important;
          color:white!important;border-radius:14px!important;
          box-shadow:0 12px 40px rgba(0,0,0,0.7)!important;
          padding:0!important;
        }
        .leaflet-popup-content{margin:14px 16px!important;}
        .leaflet-popup-tip{background:#13131f!important;}
        .leaflet-container{background:#0a0a14!important;}
        .leaflet-control-zoom a{
          background:#13131f!important;border-color:rgba(255,255,255,0.08)!important;
          color:white!important;width:32px!important;height:32px!important;
          line-height:32px!important;font-size:16px!important;
        }
        .tbtn{
          padding:6px 13px;border-radius:9px;
          border:1px solid rgba(255,255,255,0.1);
          background:rgba(255,255,255,0.05);
          color:rgba(255,255,255,0.55);
          font-size:12px;font-weight:600;cursor:pointer;
          transition:all 0.15s;white-space:nowrap;font-family:system-ui;
        }
        .tbtn.on{background:rgba(59,130,246,0.18);border-color:rgba(59,130,246,0.35);color:#93c5fd;}
        .tbtn:hover{background:rgba(255,255,255,0.09);}
        .irow{padding:10px 12px;border-radius:10px;cursor:pointer;border:1px solid rgba(255,255,255,0.04);margin-bottom:4px;transition:background 0.15s;}
        .irow:hover{background:rgba(255,255,255,0.06);}
      `}</style>

      {/* HEADER */}
      <div style={{ background: '#0c0c14', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#fff', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontSize: '16px', fontWeight: '700', color: '#fff', flex: 1 }}>Issues Map</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button className={`tbtn ${colorMode === 'priority' ? 'on' : ''}`} onClick={() => setColorMode('priority')}>Priority</button>
          <button className={`tbtn ${colorMode === 'status' ? 'on' : ''}`} onClick={() => setColorMode('status')}>Status</button>
          <button className={`tbtn ${showRoutes ? 'on' : ''}`} onClick={() => setShowRoutes(v => !v)}>Routes</button>
          <button className={`tbtn ${showTechs ? 'on' : ''}`} onClick={() => { setShowTechs(v => !v) }}>Techs</button>
          <button className="tbtn" onClick={fetchData} style={{ padding: '6px 9px' }}><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ background: '#0c0c14', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0, overflowX: 'auto' }}>
        {[
          { label: 'Issues', val: stats.total, color: '#60a5fa' },
          { label: 'With GPS', val: stats.withGPS, color: '#4ade80' },
          { label: 'Techs Live', val: stats.techsOnline, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{s.label}:</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{s.val}</span>
          </div>
        ))}
        {routeStatus && (
          <span style={{ fontSize: '11px', color: '#4ade80', marginLeft: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', border: '2px solid #4ade80', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            {routeStatus}
          </span>
        )}
        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
          {Object.entries(colorMode === 'priority' ? PRIORITY_COLOR : STATUS_COLOR).map(([k, c]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, display: 'inline-block' }} />{k}
            </span>
          ))}
        </div>
      </div>

      {/* MAIN: Map + Sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* MAP */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {(!mapReady || loading) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06060d', zIndex: 10, flexDirection: 'column', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#4b5563', fontSize: '13px' }}>
                {loading ? 'Fetching all issues…' : 'Rendering map with road routes…'}
              </p>
            </div>
          )}
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
        </div>

        {/* SIDEBAR — desktop only, hidden on mobile */}
        <div style={{ width: '280px', background: '#0c0c14', borderLeft: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}
          className="hide-mobile">
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>All Issues ({issues.length})</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {issues.map(issue => {
              const color = getColor(issue)
              return (
                <div key={issue.id} className="irow" onClick={() => {
                  const L = LRef.current, map = mapRef.current
                  if (L && map) map.setView([issue.latitude, issue.longitude], 14)
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{issue.vehicle_no}</p>
                    <span style={{ fontSize: '10px', color: color, background: `${color}18`, padding: '2px 7px', borderRadius: '6px', flexShrink: 0 }}>{issue.priority}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {issue.client} · {issue.city || 'No city'}
                  </p>
                  {issue.technicians && (
                    <p style={{ fontSize: '11px', color: '#60a5fa', marginTop: '2px' }}>👷 {issue.technicians.name}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .hide-mobile { display: none !important; } }
      `}</style>
    </div>
  )
}
