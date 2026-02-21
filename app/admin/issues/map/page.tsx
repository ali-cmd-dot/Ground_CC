'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, RefreshCw, MapPin, Users, Filter } from 'lucide-react'

interface IssueLocation {
  id: string
  vehicle_no: string
  client: string
  city: string
  location: string
  latitude: number
  longitude: number
  status: string
  priority: string
  assigned_to?: string
  technician_name?: string
}

interface TechLocation {
  id: string
  name: string
  lat: number
  lng: number
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f97316',
  assigned: '#3b82f6',
  'in-progress': '#8b5cf6',
  completed: '#22c55e',
  cancelled: '#6b7280',
}

export default function AdminIssuesMapPage() {
  const router = useRouter()
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [issues, setIssues] = useState<IssueLocation[]>([])
  const [techLocations, setTechLocations] = useState<TechLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [colorBy, setColorBy] = useState<'priority' | 'status'>('priority')
  const [showTechs, setShowTechs] = useState(true)
  const [showLines, setShowLines] = useState(true)
  const [stats, setStats] = useState({ total: 0, withGPS: 0, techsOnline: 0 })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!mapReady && (issues.length > 0 || techLocations.length > 0)) {
      initMap()
    }
  }, [issues, techLocations])

  const fetchData = async () => {
    try {
      const [issuesRes, attendanceRes] = await Promise.all([
        supabase.from('issues').select('*, technicians:assigned_to(name)')
          .not('status', 'in', '("completed","cancelled")'),
        supabase.from('attendance').select('technician_id, latitude, longitude, technicians:technician_id(name)')
          .eq('date', new Date().toISOString().split('T')[0]).is('check_out', null)
      ])

      const issueData: IssueLocation[] = (issuesRes.data || [])
        .filter((i: any) => i.latitude && i.longitude)
        .map((i: any) => ({
          id: i.id, vehicle_no: i.vehicle_no, client: i.client,
          city: i.city || '', location: i.location || '',
          latitude: i.latitude, longitude: i.longitude,
          status: i.status, priority: i.priority,
          assigned_to: i.assigned_to,
          technician_name: i.technicians?.name
        }))

      const techData: TechLocation[] = (attendanceRes.data || [])
        .filter((a: any) => a.latitude && a.longitude)
        .map((a: any) => ({
          id: a.technician_id, name: (a as any).technicians?.name || 'Unknown',
          lat: a.latitude, lng: a.longitude
        }))

      setIssues(issueData)
      setTechLocations(techData)
      setStats({ total: issuesRes.data?.length || 0, withGPS: issueData.length, techsOnline: techData.length })
    } finally {
      setLoading(false)
    }
  }

  const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const initMap = async () => {
    if (!mapContainerRef.current || mapReady) return
    try {
      const L = (await import('leaflet')).default
      if (mapRef.current) mapRef.current.remove()

      const allPoints = [
        ...issues.map(i => [i.latitude, i.longitude] as [number, number]),
        ...techLocations.map(t => [t.lat, t.lng] as [number, number])
      ]

      const center: [number, number] = allPoints.length > 0
        ? [allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length, allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length]
        : [20.5937, 78.9629]

      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView(center, 10)

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd', maxZoom: 19
      }).addTo(map)

      // Draw connection lines from each technician to nearest issues
      if (showLines && techLocations.length > 0) {
        issues.forEach(issue => {
          if (!issue.latitude || !issue.longitude) return
          const nearestTech = techLocations
            .map(t => ({ ...t, dist: calcDist(t.lat, t.lng, issue.latitude, issue.longitude) }))
            .sort((a, b) => a.dist - b.dist)[0]

          if (nearestTech) {
            const midLat = (nearestTech.lat + issue.latitude) / 2
            const midLng = (nearestTech.lng + issue.longitude) / 2
            const dist = nearestTech.dist

            const line = L.polyline(
              [[nearestTech.lat, nearestTech.lng], [issue.latitude, issue.longitude]],
              { color: dist < 5 ? '#22c55e' : dist < 20 ? '#eab308' : '#ef4444', weight: 1.5, opacity: 0.5, dashArray: '5,5' }
            ).addTo(map)

            // Distance label at midpoint
            const distLabel = L.divIcon({
              html: `<div style="background:rgba(0,0,0,0.75);color:${dist < 5 ? '#22c55e' : dist < 20 ? '#eab308' : '#ef4444'};padding:2px 6px;border-radius:8px;font-size:10px;font-weight:600;white-space:nowrap;backdrop-filter:blur(4px);">${dist < 1 ? `${(dist * 1000).toFixed(0)}m` : `${dist.toFixed(1)}km`}</div>`,
              className: '', iconAnchor: [20, 10]
            })
            L.marker([midLat, midLng], { icon: distLabel }).addTo(map)
          }
        })
      }

      // Issue markers
      issues.forEach(issue => {
        const color = colorBy === 'priority' ? (PRIORITY_COLORS[issue.priority] || '#6b7280') : (STATUS_COLORS[issue.status] || '#6b7280')
        const size = issue.priority === 'urgent' ? 16 : issue.priority === 'high' ? 13 : 11

        // Pulse effect for urgent
        const pulse = issue.priority === 'urgent' ? `
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
            width:${size * 3}px;height:${size * 3}px;background:${color};border-radius:50%;
            opacity:0.2;animation:pulse 2s infinite;"></div>` : ''

        const icon = L.divIcon({
          html: `<div style="position:relative;width:${size * 3}px;height:${size * 3}px;">
            ${pulse}
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
              width:${size}px;height:${size}px;background:${color};border-radius:50%;
              border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 12px ${color}88;"></div>
          </div>`,
          className: '',
          iconSize: [size * 3, size * 3],
          iconAnchor: [size * 1.5, size * 1.5]
        })

        const nearestTech = techLocations.length > 0
          ? techLocations.map(t => ({ ...t, dist: calcDist(t.lat, t.lng, issue.latitude, issue.longitude) })).sort((a, b) => a.dist - b.dist)[0]
          : null

        L.marker([issue.latitude, issue.longitude], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:200px;font-family:system-ui;">
              <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${issue.vehicle_no}</div>
              <div style="color:#9ca3af;font-size:12px;margin-bottom:8px;">${issue.client}</div>
              <div style="display:flex;gap:6px;margin-bottom:8px;">
                <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${issue.priority}</span>
                <span style="background:${STATUS_COLORS[issue.status]}22;color:${STATUS_COLORS[issue.status]};padding:2px 8px;border-radius:12px;font-size:11px;">${issue.status}</span>
              </div>
              <div style="font-size:11px;color:#9ca3af;">📍 ${issue.city} ${issue.location}</div>
              ${issue.technician_name ? `<div style="font-size:11px;color:#60a5fa;margin-top:4px;">👷 ${issue.technician_name}</div>` : ''}
              ${nearestTech ? `<div style="font-size:11px;color:#4ade80;margin-top:4px;">⚡ Nearest: ${nearestTech.name} (${nearestTech.dist < 1 ? `${(nearestTech.dist * 1000).toFixed(0)}m` : `${nearestTech.dist.toFixed(1)}km`})</div>` : ''}
            </div>
          `, { maxWidth: 280 })
      })

      // Technician markers
      if (showTechs) {
        techLocations.forEach(tech => {
          const nearestIssues = issues
            .map(i => ({ ...i, dist: calcDist(tech.lat, tech.lng, i.latitude, i.longitude) }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3)

          const icon = L.divIcon({
            html: `<div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;padding:5px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 4px 15px rgba(37,99,235,0.5);border:2px solid rgba(255,255,255,0.3);">
              👷 ${tech.name}
            </div>`,
            className: '', iconAnchor: [40, 16]
          })

          L.marker([tech.lat, tech.lng], { icon })
            .addTo(map)
            .bindPopup(`
              <div style="min-width:180px;font-family:system-ui;">
                <div style="font-weight:700;font-size:14px;margin-bottom:8px;">👷 ${tech.name}</div>
                <div style="font-size:11px;color:#9ca3af;margin-bottom:6px;">Nearby Issues:</div>
                ${nearestIssues.map(i => `
                  <div style="font-size:11px;padding:3px 0;border-bottom:1px solid #1f2937;">
                    🚗 ${i.vehicle_no} — ${i.dist < 1 ? `${(i.dist * 1000).toFixed(0)}m` : `${i.dist.toFixed(1)}km`}
                  </div>
                `).join('')}
              </div>
            `, { maxWidth: 250 })
        })
      }

      // Fit bounds
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints)
        map.fitBounds(bounds, { padding: [60, 60] })
      }

      mapRef.current = map
      setMapReady(true)
    } catch (err) {
      console.error('Map error:', err)
    }
  }

  return (
    <div className="h-screen bg-[#080810] flex flex-col">
      {/* Header */}
      <header className="bg-[#0a0a12] border-b border-white/8 px-4 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin')} className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <h1 className="text-lg font-bold text-white">Issues Map</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Color toggle */}
          <button onClick={() => setColorBy(p => p === 'priority' ? 'status' : 'priority')}
            className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-3 py-1.5 rounded-lg">
            Color: {colorBy}
          </button>
          <button onClick={() => setShowLines(p => !p)}
            className={`text-xs border px-3 py-1.5 rounded-lg ${showLines ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'bg-white/5 border-white/10 text-gray-400'}`}>
            Lines
          </button>
          <button onClick={() => setShowTechs(p => !p)}
            className={`text-xs border px-3 py-1.5 rounded-lg ${showTechs ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-white/5 border-white/10 text-gray-400'}`}>
            Techs
          </button>
          <Button variant="ghost" size="sm" onClick={() => { setMapReady(false); fetchData() }} className="text-gray-400 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="bg-[#0a0a12] border-b border-white/5 px-4 py-2 flex gap-6 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          <span className="text-gray-400">Total Issues:</span>
          <span className="text-white font-bold">{stats.total}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className="text-gray-400">With GPS:</span>
          <span className="text-white font-bold">{stats.withGPS}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></div>
          <span className="text-gray-400">Techs Online:</span>
          <span className="text-white font-bold">{stats.techsOnline}</span>
        </div>

        {/* Priority legend */}
        <div className="ml-auto flex items-center gap-3">
          {colorBy === 'priority' ? Object.entries(PRIORITY_COLORS).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: v, boxShadow: `0 0 6px ${v}` }}></div>
              <span className="text-xs text-gray-400 capitalize">{k}</span>
            </div>
          )) : Object.entries(STATUS_COLORS).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: v }}></div>
              <span className="text-xs text-gray-400 capitalize">{k}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.2; }
            50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
          }
          .leaflet-popup-content-wrapper {
            background: #1a1a2e !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            color: white !important;
            border-radius: 12px !important;
          }
          .leaflet-popup-tip { background: #1a1a2e !important; }
        `}</style>
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#080810] z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">{loading ? 'Loading data...' : 'Initializing map...'}</p>
            </div>
          </div>
        )}
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  )
}
