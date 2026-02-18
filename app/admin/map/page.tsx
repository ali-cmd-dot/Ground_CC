'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, MapPin, User, RefreshCw, Activity } from 'lucide-react'

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
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    fetchTechnicianLocations()
    const interval = setInterval(fetchTechnicianLocations, 10000) // Update every 10 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!mapLoaded && technicians.length > 0) {
      initMap()
    } else if (mapLoaded && technicians.length > 0) {
      updateMarkers()
    }
  }, [technicians])

  const fetchTechnicianLocations = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('attendance')
        .select(`*, technicians:technician_id (id, name, phone)`)
        .eq('date', today)
        .is('check_out', null)
        .order('check_in', { ascending: false })

      if (data) {
        const locs: TechLocation[] = data
          .filter(a => a.latitude && a.longitude)
          .map(a => ({
            id: a.technician_id,
            name: (a as any).technicians?.name || 'Unknown',
            lat: a.latitude,
            lng: a.longitude,
            lastSeen: a.check_in
          }))
        setTechnicians(locs)
      }
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const initMap = async () => {
    if (!mapContainerRef.current || technicians.length === 0 || mapLoaded) return

    try {
      const L = (await import('leaflet')).default

      if (mapRef.current) {
        mapRef.current.remove()
      }

      // Center on first technician or default India
      const center = technicians[0] ? [technicians[0].lat, technicians[0].lng] : [20.5937, 78.9629]
      const map = L.map(mapContainerRef.current).setView(center as [number, number], 12)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)

      // Add technician markers
      technicians.forEach(tech => {
        const icon = L.divIcon({
          html: `<div style="
            background: #16a34a;
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 2px solid white;
          ">👷 ${tech.name}</div>`,
          className: '',
          iconAnchor: [50, 16]
        })
        
        L.marker([tech.lat, tech.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <strong>${tech.name}</strong><br>
            <small>Checked in: ${new Date(tech.lastSeen).toLocaleTimeString()}</small><br>
            <small>Lat: ${tech.lat.toFixed(6)}, Lng: ${tech.lng.toFixed(6)}</small>
          `)
      })

      // Fit bounds to show all technicians
      if (technicians.length > 1) {
        const bounds = L.latLngBounds(technicians.map(t => [t.lat, t.lng] as [number, number]))
        map.fitBounds(bounds, { padding: [50, 50] })
      }

      mapRef.current = map
      setMapLoaded(true)
    } catch (err) {
      console.error('Map error:', err)
    }
  }

  const updateMarkers = async () => {
    if (!mapRef.current || !mapLoaded) return

    try {
      const L = (await import('leaflet')).default
      
      // Clear existing markers
      mapRef.current.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) {
          mapRef.current.removeLayer(layer)
        }
      })

      // Add updated markers
      technicians.forEach(tech => {
        const icon = L.divIcon({
          html: `<div style="
            background: #16a34a;
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 2px solid white;
          ">👷 ${tech.name}</div>`,
          className: '',
          iconAnchor: [50, 16]
        })
        
        L.marker([tech.lat, tech.lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(`
            <strong>${tech.name}</strong><br>
            <small>Last update: ${new Date(tech.lastSeen).toLocaleTimeString()}</small><br>
            <small>Lat: ${tech.lat.toFixed(6)}, Lng: ${tech.lng.toFixed(6)}</small>
          `)
      })
    } catch (err) {
      console.error('Update error:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => router.push('/admin')}>
                <ArrowLeft className="h-4 w-4 mr-2" />Back
              </Button>
              <h1 className="text-xl font-bold">Live Technician Tracking</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md px-3 py-1.5">
                <Activity className="h-4 w-4 text-green-600 animate-pulse" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Live Updates</span>
              </div>
              <Button variant="outline" size="sm" onClick={fetchTechnicianLocations}>
                <RefreshCw className="h-4 w-4 mr-2" />Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-green-600" />
                  Active Technicians ({technicians.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <p className="text-xs text-center py-4">Loading...</p>
                ) : technicians.length === 0 ? (
                  <p className="text-xs text-center py-4 text-muted-foreground">
                    No technicians checked in
                  </p>
                ) : (
                  technicians.map(tech => (
                    <div key={tech.id} className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <p className="text-sm font-semibold">{tech.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last seen: {new Date(tech.lastSeen).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        {tech.lat.toFixed(4)}, {tech.lng.toFixed(4)}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Map */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-0 overflow-hidden rounded-lg">
                {!mapLoaded ? (
                  <div className="h-[600px] flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                      <p className="text-sm text-muted-foreground">
                        {technicians.length === 0 ? 'Waiting for technicians to check in...' : 'Loading map...'}
                      </p>
                    </div>
                  </div>
                ) : null}
                <div
                  ref={mapContainerRef}
                  style={{ height: '600px', width: '100%', display: mapLoaded ? 'block' : 'none' }}
                />
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              🟢 Green markers = Active technicians • Updates every 10 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
