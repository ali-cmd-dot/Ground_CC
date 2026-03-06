'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

// Hardcoded city centers for offline technicians
// Add more cities as needed
const CITY_CENTERS: Record<string, [number, number]> = {
  'delhi': [28.6139, 77.2090],
  'new delhi': [28.6139, 77.2090],
  'mumbai': [19.0760, 72.8777],
  'bombay': [19.0760, 72.8777],
  'pune': [18.5204, 73.8567],
  'bangalore': [12.9716, 77.5946],
  'bengaluru': [12.9716, 77.5946],
  'hyderabad': [17.3850, 78.4867],
  'chennai': [13.0827, 80.2707],
  'kolkata': [22.5726, 88.3639],
  'ahmedabad': [23.0225, 72.5714],
  'jaipur': [26.9124, 75.7873],
  'surat': [21.1702, 72.8311],
  'lucknow': [26.8467, 80.9462],
  'kanpur': [26.4499, 80.3319],
  'nagpur': [21.1458, 79.0882],
  'indore': [22.7196, 75.8577],
  'bhopal': [23.2599, 77.4126],
  'patna': [25.5941, 85.1376],
  'vadodara': [22.3072, 73.1812],
  'agra': [27.1767, 78.0081],
  'chandigarh': [30.7333, 76.7794],
  'coimbatore': [11.0168, 76.9558],
  'visakhapatnam': [17.6868, 83.2185],
  'noida': [28.5355, 77.3910],
  'gurgaon': [28.4595, 77.0266],
  'gurugram': [28.4595, 77.0266],
  'faridabad': [28.4089, 77.3178],
  'nangloi': [28.6780, 77.0580],
  'ghaziabad': [28.6692, 77.4538],
}

const getCityCenter = (citiesStr: string): [number, number] | null => {
  if (!citiesStr) return null
  const cities = citiesStr.split(',').map(c => c.trim().toLowerCase())
  for (const city of cities) {
    if (CITY_CENTERS[city]) return CITY_CENTERS[city]
    // partial match
    const match = Object.keys(CITY_CENTERS).find(k => k.includes(city) || city.includes(k))
    if (match) return CITY_CENTERS[match]
  }
  return null
}

export default function IssuesMapPage() {
  const router = useRouter()
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])
  const techMarkersRef = useRef<any[]>([])
  const routeLinesRef = useRef<any[]>([])

  const [issues, setIssues] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [liveLocations, setLiveLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [routeProgress, setRouteProgress] = useState<{done: number, total: number} | null>(null)
  const [activeFilter, setActiveFilter] = useState<'Priority' | 'Status' | 'Routes' | 'Techs'>('Priority')
  const [selectedIssue, setSelectedIssue] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    initMap()
    checkAuthAndLoad()
  }, [])

  useEffect(() => {
    if (mapRef.current) {
      renderMarkers()
    }
  }, [issues, technicians, liveLocations, activeFilter])

  const checkAuthAndLoad = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    const { data: user } = await supabase
      .from('technicians')
      .select('*')
      .eq('id', session.user.id)
      .single()
    setCurrentUser(user)
    await loadData(user)
  }

  const loadData = async (user: any) => {
    setLoading(true)
    try {
      // Load ALL pending/assigned issues with GPS
      const { data: allIssues } = await supabase
        .from('issues')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .not('status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false })

      setIssues(allIssues || [])

      // Load all technicians
      const { data: techs } = await supabase
        .from('technicians')
        .select('*')
        .eq('role', 'technician')
        .eq('is_active', true)
      setTechnicians(techs || [])

      // Online = live location updated in last 5 minutes
      // (technician app sends location every 12 seconds when active)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      const { data: freshLocs } = await supabase
        .from('live_locations')
        .select('*')
        .gte('updated_at', fiveMinAgo)

      setLiveLocations(freshLocs || [])

    } finally {
      setLoading(false)
    }
  }

  const initMap = async () => {
    if (typeof window === 'undefined' || mapRef.current) return
    const L = (await import('leaflet')).default
    if (!mapContainerRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [22.5, 80.0],
      zoom: 5,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '©OpenStreetMap ©CartoDB',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map
  }

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return '#ef4444'
      case 'high': return '#f97316'
      case 'medium': return '#eab308'
      case 'low': return '#22c55e'
      default: return '#eab308'
    }
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'pending': return '#ef4444'
      case 'assigned': return '#f97316'
      case 'in-progress': return '#3b82f6'
      default: return '#6b7280'
    }
  }

  const renderMarkers = async () => {
    if (!mapRef.current) return
    const L = (await import('leaflet')).default

    // Clear old markers/lines
    markersRef.current.forEach(m => m.remove())
    techMarkersRef.current.forEach(m => m.remove())
    routeLinesRef.current.forEach(l => l.remove())
    markersRef.current = []
    techMarkersRef.current = []
    routeLinesRef.current = []

    const bounds: [number, number][] = []

    // ── Issue markers ──────────────────────────────
    issues.forEach(issue => {
      const color = activeFilter === 'Status'
        ? getStatusColor(issue.status)
        : getPriorityColor(issue.priority)

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:12px;height:12px;border-radius:50%;
          background:${color};
          border:2px solid rgba(255,255,255,0.5);
          box-shadow:0 0 8px ${color}88;
        "></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      })

      const tech = technicians.find(t => t.id === issue.assigned_to)
      const marker = L.marker([issue.latitude, issue.longitude], { icon })
        .addTo(mapRef.current)
        .bindTooltip(`${issue.vehicle_no} · ${issue.client}`, { direction: 'top', offset: [0, -8] })
        .on('click', () => setSelectedIssue(issue))

      markersRef.current.push(marker)
      bounds.push([issue.latitude, issue.longitude])
    })

    // ── Technician markers ──────────────────────────
    if (activeFilter === 'Techs' || activeFilter === 'Routes') {
      for (const tech of technicians) {
        const liveData = liveLocations.find(l => l.technician_id === tech.id)
        const isOnline = !!liveData
        let lat: number, lng: number

        if (isOnline) {
          lat = liveData.latitude
          lng = liveData.longitude
        } else {
          // Use city center for offline technicians
          const cityCenter = getCityCenter(tech.cities || tech.city || '')
          if (!cityCenter) continue
          ;[lat, lng] = cityCenter
        }

        const initials = (tech.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

        const icon = L.divIcon({
          className: '',
          html: `
            <div style="position:relative;width:36px;height:36px;">
              <div style="
                width:36px;height:36px;border-radius:50%;
                background:${isOnline ? '#3b82f6' : '#4b5563'};
                border:2px solid ${isOnline ? 'white' : '#9ca3af'};
                display:flex;align-items:center;justify-content:center;
                font-size:11px;font-weight:bold;color:white;
                box-shadow:0 0 ${isOnline ? '10px #3b82f688' : '4px #00000088'};
              ">${initials}</div>
              ${isOnline
                ? `<div style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:#22c55e;border:1.5px solid #080810;"></div>`
                : `<div style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:#6b7280;border:1.5px solid #080810;font-size:7px;color:white;display:flex;align-items:center;justify-content:center;">Z</div>`
              }
            </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })

        const techAssignedCount = issues.filter(i => i.assigned_to === tech.id).length

        const marker = L.marker([lat, lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="min-width:180px;font-family:sans-serif;">
              <b style="font-size:13px;">${tech.name}</b>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">📍 ${tech.cities || tech.city || 'No city set'}</div>
              <div style="margin-top:8px;font-size:11px;padding:4px 8px;border-radius:4px;${
                isOnline
                  ? 'background:#16a34a22;color:#22c55e;'
                  : 'background:#37415122;color:#9ca3af;'
              }">
                ${isOnline
                  ? '🟢 Online — Live GPS Location'
                  : '⚫ Not logged in yet<br/><span style="font-size:10px;color:#6b7280;">Showing city center</span>'
                }
              </div>
              <div style="font-size:11px;margin-top:6px;color:#d1d5db;">
                Assigned issues: <b style="color:white;">${techAssignedCount}</b>
              </div>
            </div>
          `)

        techMarkersRef.current.push(marker)
        if (isOnline) bounds.push([lat, lng])
      }
    }

    // ── Routes: nearest-next ordering per technician ──────
    if (activeFilter === 'Routes') {
      // Group issues by assigned technician
      const techIssueMap = new Map<string, any[]>()
      for (const issue of issues) {
        if (!issue.assigned_to) continue
        if (!techIssueMap.has(issue.assigned_to)) techIssueMap.set(issue.assigned_to, [])
        techIssueMap.get(issue.assigned_to)!.push(issue)
      }

      const totalRoutes = issues.filter(i => i.assigned_to).length
      setRouteProgress({ done: 0, total: totalRoutes })
      let done = 0

      for (const [techId, techIssues] of techIssueMap) {
        const tech = technicians.find(t => t.id === techId)
        if (!tech) continue

        const liveData = liveLocations.find(l => l.technician_id === tech.id)
        const isOnline = !!liveData
        let startLat: number, startLng: number

        if (liveData) {
          startLat = liveData.latitude
          startLng = liveData.longitude
        } else {
          const cityCenter = getCityCenter(tech.cities || tech.city || '')
          if (!cityCenter) continue
          ;[startLat, startLng] = cityCenter
        }

        // ── Nearest-next greedy sort ──
        // Start from tech position, always pick closest remaining issue
        const calcDist = (lat1: number, lng1: number, lat2: number, lng2: number) => {
          const R = 6371
          const dLat = (lat2 - lat1) * Math.PI / 180
          const dLng = (lng2 - lng1) * Math.PI / 180
          const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
        }

        const remaining = [...techIssues]
        const ordered: any[] = []
        let curLat = startLat, curLng = startLng

        while (remaining.length > 0) {
          let nearestIdx = 0
          let nearestDist = Infinity
          for (let i = 0; i < remaining.length; i++) {
            const d = calcDist(curLat, curLng, remaining[i].latitude, remaining[i].longitude)
            if (d < nearestDist) { nearestDist = d; nearestIdx = i }
          }
          const next = remaining.splice(nearestIdx, 1)[0]
          ordered.push(next)
          curLat = next.latitude
          curLng = next.longitude
        }

        // Draw tech marker
        const initials = (tech.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()
        const techIcon = L.divIcon({
          className: '',
          html: `<div style="
            width:34px;height:34px;border-radius:50%;
            background:${isOnline ? '#3b82f6' : '#4b5563'};
            border:2px solid ${isOnline ? 'white' : '#9ca3af'};
            display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:bold;color:white;
            box-shadow:0 0 10px ${isOnline ? '#3b82f6aa' : '#00000066'};
          ">${initials}</div>`,
          iconSize: [34, 34], iconAnchor: [17, 17],
        })
        const techMarker = L.marker([startLat, startLng], { icon: techIcon })
          .addTo(mapRef.current)
          .bindPopup(`
            <div style="min-width:160px;font-family:sans-serif;">
              <b>${tech.name}</b>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">📍 ${tech.cities || tech.city || 'No city'}</div>
              <div style="font-size:11px;margin-top:6px;${isOnline ? 'color:#22c55e' : 'color:#9ca3af'}">
                ${isOnline ? '🟢 Online — Live GPS' : '⚫ Not logged in<br/><small>City center shown</small>'}
              </div>
              <div style="font-size:11px;margin-top:4px;">Issues: <b>${ordered.length}</b></div>
            </div>
          `)
        techMarkersRef.current.push(techMarker)

        // Draw numbered markers + route segments in nearest-next order
        let prevLat = startLat, prevLng = startLng

        for (let idx = 0; idx < ordered.length; idx++) {
          const issue = ordered[idx]
          const stopNum = idx + 1

          // Numbered issue marker
          const stopIcon = L.divIcon({
            className: '',
            html: `<div style="
              width:24px;height:24px;border-radius:50%;
              background:${isOnline ? '#1a1a2e' : '#222'};
              border:2px solid ${isOnline ? '#eab308' : '#6b7280'};
              display:flex;align-items:center;justify-content:center;
              font-size:11px;font-weight:bold;
              color:${isOnline ? '#eab308' : '#9ca3af'};
            ">${stopNum}</div>`,
            iconSize: [24, 24], iconAnchor: [12, 12],
          })
          const stopMarker = L.marker([issue.latitude, issue.longitude], { icon: stopIcon })
            .addTo(mapRef.current)
            .bindPopup(`
              <div style="font-family:sans-serif;">
                <div style="font-size:10px;color:#9ca3af;">Stop #${stopNum}</div>
                <b>${issue.vehicle_no}</b>
                <div style="font-size:11px;">${issue.client}</div>
                <div style="font-size:11px;color:#9ca3af;">${issue.city || ''}</div>
                <div style="font-size:11px;margin-top:4px;">${issue.issue || ''}</div>
              </div>
            `)
          routeLinesRef.current.push(stopMarker)

          // Straight line as fallback
          const fallback = L.polyline([[prevLat, prevLng], [issue.latitude, issue.longitude]], {
            color: isOnline ? '#eab308' : '#6b7280',
            weight: 2, opacity: 0.35, dashArray: '5, 8',
          }).addTo(mapRef.current)
          routeLinesRef.current.push(fallback)

          // Fetch road route for this segment
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${prevLng},${prevLat};${issue.longitude},${issue.latitude}?overview=full&geometries=geojson`
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
            const routeData = await res.json()
            if (routeData.routes?.[0]) {
              fallback.remove()
              const fi = routeLinesRef.current.indexOf(fallback)
              if (fi > -1) routeLinesRef.current.splice(fi, 1)

              const coords = routeData.routes[0].geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng])
              const distKm = (routeData.routes[0].distance / 1000).toFixed(0)
              const distMins = Math.round(routeData.routes[0].duration / 60)

              const roadLine = L.polyline(coords, {
                color: isOnline ? '#eab308' : '#6b7280',
                weight: isOnline ? 3 : 2,
                opacity: isOnline ? 0.85 : 0.5,
                dashArray: isOnline ? undefined : '8,8',
              }).addTo(mapRef.current)
              routeLinesRef.current.push(roadLine)

              // Mid-segment distance label
              const mid = coords[Math.floor(coords.length / 2)]
              const distLabel = L.marker(mid, {
                icon: L.divIcon({
                  className: '',
                  html: `<div style="
                    background:#0d0d16;border:1px solid ${isOnline ? '#eab308' : '#4b5563'};
                    color:${isOnline ? '#eab308' : '#9ca3af'};
                    padding:1px 5px;border-radius:3px;
                    font-size:9px;white-space:nowrap;font-weight:600;
                  ">${distKm}km·${distMins}m</div>`,
                  iconAnchor: [25, 8],
                })
              }).addTo(mapRef.current)
              routeLinesRef.current.push(distLabel)
            }
          } catch { /* keep fallback line */ }

          prevLat = issue.latitude
          prevLng = issue.longitude
          done++
          setRouteProgress({ done, total: totalRoutes })
        }
      }
      setRouteProgress(null)
    }

    // Fit map
    if (bounds.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 })
    }
  }

  const issueCount = issues.length
  const onlineTechs = technicians.filter(t => liveLocations.find(l => l.technician_id === t.id)).length
  const offlineTechs = technicians.length - onlineTechs

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col" style={{ height: '100vh' }}>
      {/* Header */}
      <header className="bg-[#0a0a12] border-b border-white/8 z-20 relative flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.back()} className="text-gray-400 hover:text-white h-8 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-sm font-bold text-white">Issues Map</h1>
          </div>
          <Button variant="ghost" onClick={() => loadData(currentUser)} className="text-gray-400 hover:text-white h-8 w-8 p-0">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Stats row */}
        <div className="px-4 pb-2 flex items-center gap-4 text-xs text-gray-400 flex-wrap">
          <span>📍 Issues: <b className="text-white">{issueCount}</b></span>
          <span>🟢 Online: <b className="text-green-400">{onlineTechs}</b></span>
          <span>⚫ Offline: <b className="text-gray-400">{offlineTechs}</b></span>
          {routeProgress && (
            <span className="text-yellow-400 flex items-center gap-1">
              <span className="animate-spin inline-block">↻</span>
              Loading routes... {routeProgress.done}/{routeProgress.total}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="px-4 pb-3 flex gap-2">
          {(['Priority', 'Status', 'Routes', 'Techs'] as const).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                activeFilter === f
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Legend */}
        {activeFilter === 'Priority' && (
          <div className="px-4 pb-2 flex gap-3 text-xs">
            {[['urgent','#ef4444'],['high','#f97316'],['medium','#eab308'],['low','#22c55e']].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1 text-gray-400">
                <span style={{ background: color as string }} className="w-2 h-2 rounded-full inline-block" />
                {label}
              </span>
            ))}
          </div>
        )}
        {(activeFilter === 'Techs' || activeFilter === 'Routes') && (
          <div className="px-4 pb-2 flex gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Online (exact location)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500 inline-block" /> Offline (city center)</span>
          </div>
        )}
      </header>

      {/* Map container */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
          </div>
        )}

        {/* Right panel: issue list */}
        <div
          className="absolute top-0 right-0 w-68 overflow-y-auto z-10 bg-[#0a0a12]/95 border-l border-white/8 p-3"
          style={{ maxHeight: '100%', width: '270px' }}
        >
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            All Issues ({issueCount})
          </p>
          {issues.map(issue => {
            const tech = technicians.find(t => t.id === issue.assigned_to)
            const isOnline = tech ? !!liveLocations.find(l => l.technician_id === tech.id) : false
            const color = getPriorityColor(issue.priority)
            return (
              <div
                key={issue.id}
                className={`mb-2 p-2 rounded-lg cursor-pointer border transition-all ${
                  selectedIssue?.id === issue.id
                    ? 'bg-white/10 border-white/20'
                    : 'bg-white/3 border-white/5 hover:bg-white/8'
                }`}
                onClick={() => {
                  setSelectedIssue(issue)
                  if (mapRef.current) {
                    mapRef.current.setView([issue.latitude, issue.longitude], 14)
                  }
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold text-white">{issue.vehicle_no}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: color + '22', color }}>
                    {issue.priority}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400">{issue.client} · {issue.city}</p>
                {tech && (
                  <p className={`text-[10px] mt-1 flex items-center gap-1 ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
                    {isOnline ? '🟢' : '⚫'} {tech.name}
                    {!isOnline && <span className="text-gray-600 ml-1">(not logged in)</span>}
                  </p>
                )}
                {!issue.assigned_to && (
                  <p className="text-[10px] text-red-400 mt-1">⚠ Unassigned</p>
                )}
              </div>
            )
          })}
          {issues.length === 0 && !loading && (
            <p className="text-xs text-gray-500 text-center py-8">No active issues with GPS</p>
          )}
        </div>

        {/* Bottom card: selected issue detail */}
        {selectedIssue && (
          <div className="absolute bottom-4 left-4 z-10 bg-[#0d0d16] border border-white/10 rounded-2xl p-4 shadow-2xl"
            style={{ right: '290px' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono font-bold text-white">{selectedIssue.vehicle_no}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300">{selectedIssue.status}</span>
                </div>
                <p className="text-sm text-gray-400 mt-0.5">{selectedIssue.client}</p>
                <p className="text-xs text-gray-500">{selectedIssue.city}{selectedIssue.location ? ` · ${selectedIssue.location}` : ''}</p>
                <p className="text-xs text-gray-300 mt-2 line-clamp-2">{selectedIssue.issue}</p>
                {selectedIssue.assigned_to && (() => {
                  const tech = technicians.find(t => t.id === selectedIssue.assigned_to)
                  const isOnline = tech ? !!liveLocations.find(l => l.technician_id === tech.id) : false
                  return tech ? (
                    <p className={`text-xs mt-1 ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
                      👷 {tech.name} · {isOnline ? 'Online' : 'Offline'}
                    </p>
                  ) : null
                })()}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <Button size="sm" className="text-xs h-7 bg-blue-600 hover:bg-blue-700"
                  onClick={() => router.push(`/admin/issues/${selectedIssue.id}`)}>
                  View
                </Button>
                <button className="text-xs text-gray-500 hover:text-white" onClick={() => setSelectedIssue(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
