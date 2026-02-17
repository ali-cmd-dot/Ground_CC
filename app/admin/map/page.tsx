'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, MapPin, User, Navigation, RefreshCw, Locate } from 'lucide-react'

interface TechLocation {
  id: string
  name: string
  lat: number
  lng: number
  status: string
  distance?: number
  lastSeen?: string
}

interface IssueMarker {
  id: string
  vehicle_no: string
  client: string
  city: string
  location: string
  lat: number
  lng: number
  status: string
  priority: string
  distance?: number
}

export default function LiveMapPage() {
  const router = useRouter()
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [technicians, setTechnicians] = useState<TechLocation[]>([])
  const [issues, setIssues] = useState<IssueMarker[]>([])
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortedIssues, setSortedIssues] = useState<IssueMarker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    getCurrentLocation()
    fetchData()

    // Real-time location updates
    const interval = setInterval(fetchTechnicianLocations, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (myLocation && issues.length > 0) {
      // Sort issues by distance from current location
      const withDistance = issues.map(issue => ({
        ...issue,
        distance: issue.lat && issue.lng
          ? calculateDistance(myLocation.lat, myLocation.lng, issue.lat, issue.lng)
          : 9999
      }))
      withDistance.sort((a, b) => (a.distance || 9999) - (b.distance || 9999))
      setSortedIssues(withDistance)
    } else {
      setSortedIssues(issues)
    }
  }, [myLocation, issues])

  useEffect(() => {
    if (!mapLoaded && myLocation) {
      initMap()
    }
  }, [myLocation, mapLoaded])

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          // Default to India center if location denied
          setMyLocation({ lat: 20.5937, lng: 78.9629 })
        }
      )
    }
  }

  const fetchData = async () => {
    await Promise.all([fetchTechnicianLocations(), fetchIssues()])
    setLoading(false)
  }

  const fetchTechnicianLocations = async () => {
    try {
      // Get latest attendance with location
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('attendance')
        .select(`*, technicians:technician_id (id, name)`)
        .eq('date', today)
        .is('check_out', null)
        .order('check_in', { ascending: false })

      if (data) {
        const locs: TechLocation[] = data.map(a => ({
          id: a.technician_id,
          name: (a as any).technicians?.name || 'Unknown',
          lat: a.latitude,
          lng: a.longitude,
          status: 'active',
          lastSeen: a.check_in
        }))
        setTechnicians(locs)
      }
    } catch (err) {
      console.error('Error fetching locations:', err)
    }
  }

  const fetchIssues = async () => {
    try {
      const { data } = await supabase
        .from('issues')
        .select('*')
        .in('status', ['pending', 'assigned', 'in-progress'])

      if (data) {
        const withCoords = data.filter(i => i.latitude && i.longitude).map(i => ({
          id: i.id,
          vehicle_no: i.vehicle_no,
          client: i.client,
          city: i.city || '',
          location: i.location || '',
          lat: i.latitude,
          lng: i.longitude,
          status: i.status,
          priority: i.priority
        }))
        setIssues(withCoords)
      }
    } catch (err) {
      console.error('Error fetching issues:', err)
    }
  }

  const initMap = async () => {
    if (!mapContainerRef.current || !myLocation || mapLoaded) return

    try {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      if (mapRef.current) {
        mapRef.current.remove()
      }

      const map = L.map(mapContainerRef.current).setView([myLocation.lat, myLocation.lng], 10)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)

      // My location marker
      const myIcon = L.divIcon({
        html: `<div style="
          width:20px; height:20px;
          background:#2563eb;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.3);
        "></div>`,
        className: '',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
      L.marker([myLocation.lat, myLocation.lng], { icon: myIcon })
        .addTo(map)
        .bindPopup('<strong>📍 Your Location</strong>')

      // Technician markers (green)
      technicians.forEach(tech => {
        if (tech.lat && tech.lng) {
          const techIcon = L.divIcon({
            html: `<div style="
              background: #16a34a;
              color: white;
              padding: 4px 8px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              border: 2px solid white;
            ">👷 ${tech.name}</div>`,
            className: '',
            iconAnchor: [40, 16]
          })
          L.marker([tech.lat, tech.lng], { icon: techIcon })
            .addTo(map)
            .bindPopup(`<strong>${tech.name}</strong><br>Last seen: ${new Date(tech.lastSeen || '').toLocaleTimeString()}`)
        }
      })

      // Issue markers (red/orange based on priority)
      issues.forEach(issue => {
        if (issue.lat && issue.lng) {
          const color = issue.priority === 'urgent' ? '#dc2626' : issue.priority === 'high' ? '#ea580c' : '#d97706'
          const issueIcon = L.divIcon({
            html: `<div style="
              background: ${color};
              color: white;
              padding: 4px 8px;
              border-radius: 6px;
              font-size: 10px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              border: 2px solid white;
              max-width: 120px;
              overflow: hidden;
              text-overflow: ellipsis;
            ">🚗 ${issue.vehicle_no}</div>`,
            className: '',
            iconAnchor: [40, 16]
          })
          L.marker([issue.lat, issue.lng], { icon: issueIcon })
            .addTo(map)
            .bindPopup(`
              <strong>${issue.vehicle_no}</strong><br>
              ${issue.client}<br>
              ${issue.city} ${issue.location}<br>
              Status: ${issue.status}<br>
              Priority: ${issue.priority}
            `)
        }
      })

      mapRef.current = map
      setMapLoaded(true)
    } catch (err) {
      console.error('Map init error:', err)
    }
  }

  const navigateToIssue = (issue: IssueMarker) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${issue.lat},${issue.lng}`
    window.open(url, '_blank')
  }

  const getPriorityColor = (p: string) => {
    const c: any = { urgent: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-gray-400' }
    return c[p] || 'bg-gray-400'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => router.push('/admin')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-bold">Live Map & Tracking</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={getCurrentLocation}>
                <Locate className="h-4 w-4 mr-2" />
                My Location
              </Button>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-0 overflow-hidden rounded-lg">
                {!mapLoaded && (
                  <div className="h-[500px] flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                      <p className="text-sm text-muted-foreground">Loading map...</p>
                    </div>
                  </div>
                )}
                <div
                  ref={mapContainerRef}
                  style={{ height: '500px', width: '100%', display: mapLoaded ? 'block' : 'none' }}
                />
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span> Your Location</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span> Technicians</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Urgent Issues</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span> High Issues</span>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Active Technicians */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-green-600" />
                  Active Technicians ({technicians.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {technicians.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No technicians checked in today
                  </p>
                ) : (
                  technicians.map(tech => (
                    <div key={tech.id} className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{tech.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Checked in: {new Date(tech.lastSeen || '').toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Issues sorted by nearest */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-orange-500" />
                  Issues - Nearest First
                  {myLocation && <span className="text-xs font-normal text-muted-foreground">(from your location)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[320px] overflow-y-auto">
                {loading ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
                ) : sortedIssues.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No issues with GPS coordinates
                  </p>
                ) : (
                  sortedIssues.map((issue, idx) => (
                    <div
                      key={issue.id}
                      className="p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/issues/${issue.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                          <span className="text-sm font-semibold">{issue.vehicle_no}</span>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full text-white ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{issue.client}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {issue.city} {issue.location && `- ${issue.location}`}
                      </p>
                      {issue.distance !== undefined && issue.distance < 9999 && (
                        <p className="text-xs font-medium text-blue-600 mt-1">
                          📍 {issue.distance < 1 ? `${(issue.distance * 1000).toFixed(0)}m` : `${issue.distance.toFixed(1)}km`} away
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2 h-7 text-xs"
                        onClick={(e) => { e.stopPropagation(); navigateToIssue(issue) }}
                      >
                        <Navigation className="h-3 w-3 mr-1" />
                        Navigate
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
