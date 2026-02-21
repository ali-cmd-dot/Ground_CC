'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, RefreshCw, Activity, Users, MapPin } from 'lucide-react'

interface TechLocation {
  id: string
  name: string
  lat: number
  lng: number
  lastSeen: string
}

export default function LiveMapPage() {
  const router = useRouter()
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [technicians, setTechnicians] = useState<TechLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const intervalRef = useRef<any>(null)

  useEffect(() => {
    fetchTechnicianLocations()
    intervalRef.current = setInterval(fetchTechnicianLocations, 10000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  useEffect(() => {
    if (technicians.length > 0) {
      if (!mapReady) initMap()
      else updateMarkers()
    }
  }, [technicians])

  const fetchTechnicianLocations = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('attendance')
        .select('*, technicians:technician_id(id, name, phone)')
        .eq('date', today).is('check_out', null)
        .order('check_in', { ascending: false })

      if (data) {
        const locs: TechLocation[] = data
          .filter((a: any) => a.latitude && a.longitude)
          .map((a: any) => ({
            id: a.technician_id,
            name: a.technicians?.name || 'Unknown',
            lat: a.latitude, lng: a.longitude,
            lastSeen: a.check_in
          }))
        setTechnicians(locs)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const initMap = async () => {
    if (!mapContainerRef.current || mapReady) return
    try {
      const L = (await import('leaflet')).default
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      // Force container to have explicit dimensions
      const container = mapContainerRef.current
      container.style.height = '100%'
      container.style.width = '100%'

      const center = technicians[0]
        ? [technicians[0].lat, technicians[0].lng] as [number, number]
        : [20.5937, 78.9629] as [number, number]

      const map = L.map(container, { zoomControl: true }).setView(center, 12)

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd', maxZoom: 19
      }).addTo(map)

      technicians.forEach(tech => {
        const icon = L.divIcon({
          html: `<div style="background:linear-gradient(135deg,#16a34a,#15803d);color:white;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 4px 15px rgba(22,163,74,0.5);border:2px solid rgba(255,255,255,0.3);">👷 ${tech.name}</div>`,
          className: '', iconAnchor: [50, 16]
        })
        L.marker([tech.lat, tech.lng], { icon }).addTo(map)
          .bindPopup(`<div style="font-family:system-ui;color:white;min-width:160px;"><strong>${tech.name}</strong><br><small style="color:#9ca3af;">Checked in: ${new Date(tech.lastSeen).toLocaleTimeString()}</small><br><small style="color:#9ca3af;font-mono;">${tech.lat.toFixed(6)}, ${tech.lng.toFixed(6)}</small></div>`)
      })

      if (technicians.length > 1) {
        const bounds = L.latLngBounds(technicians.map(t => [t.lat, t.lng] as [number, number]))
        map.fitBounds(bounds, { padding: [60, 60] })
      }

      // Critical: invalidate size after render
      setTimeout(() => { map.invalidateSize() }, 100)

      mapRef.current = map
      setMapReady(true)
    } catch (err) { console.error('Map error:', err) }
  }

  const updateMarkers = async () => {
    if (!mapRef.current) return
    try {
      const L = (await import('leaflet')).default
      mapRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) mapRef.current.removeLayer(layer)
      })
      technicians.forEach(tech => {
        const icon = L.divIcon({
          html: `<div style="background:linear-gradient(135deg,#16a34a,#15803d);color:white;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 4px 15px rgba(22,163,74,0.5);border:2px solid rgba(255,255,255,0.3);">👷 ${tech.name}</div>`,
          className: '', iconAnchor: [50, 16]
        })
        L.marker([tech.lat, tech.lng], { icon }).addTo(mapRef.current)
          .bindPopup(`<strong>${tech.name}</strong><br><small>${new Date(tech.lastSeen).toLocaleTimeString()}</small>`)
      })
      mapRef.current.invalidateSize()
    } catch (err) { console.error(err) }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#06060e' }}>
      <style>{`
        .leaflet-popup-content-wrapper { background: #1a1a2e !important; border: 1px solid rgba(255,255,255,0.1) !important; color: white !important; border-radius: 12px !important; }
        .leaflet-popup-tip { background: #1a1a2e !important; }
        .leaflet-container { background: #0a0a1a !important; }
      `}</style>

      {/* Header */}
      <header style={{ background: '#0a0a12', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin')} className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'white', margin: 0 }}>Live Technician Tracking</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '8px', padding: '6px 12px' }}>
            <Activity className="h-4 w-4 text-green-400" style={{ animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '13px', color: '#4ade80', fontWeight: '600' }}>Live</span>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchTechnicianLocations} className="text-gray-400 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{ width: '280px', background: '#0a0a12', borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users className="h-4 w-4 text-green-400" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>Active Technicians ({technicians.length})</span>
            </div>
          </div>
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading ? (
              <p style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading...</p>
            ) : technicians.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <MapPin className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                <p style={{ color: '#6b7280', fontSize: '13px' }}>No technicians checked in</p>
              </div>
            ) : technicians.map(tech => (
              <div key={tech.id} style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.15)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 2s infinite' }}></div>
                  <span style={{ fontWeight: '600', color: 'white', fontSize: '14px' }}>{tech.name}</span>
                </div>
                <p style={{ color: '#6b7280', fontSize: '11px', margin: 0 }}>
                  {new Date(tech.lastSeen).toLocaleTimeString()}
                </p>
                <p style={{ color: '#4b5563', fontSize: '10px', fontFamily: 'monospace', margin: '2px 0 0' }}>
                  {tech.lat.toFixed(4)}, {tech.lng.toFixed(4)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Map container - FULL HEIGHT */}
        <div style={{ flex: 1, position: 'relative' }}>
          {!mapReady && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06060e', zIndex: 10 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>
                  {technicians.length === 0 ? 'Waiting for technicians...' : 'Loading map...'}
                </p>
              </div>
            </div>
          )}
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
