'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, MapPin, Navigation, RefreshCw, Locate } from 'lucide-react'
import type { Issue } from '@/lib/types'

interface IssueWithDistance extends Issue {
  distance?: number
}

export default function TechnicianMapPage() {
  const router = useRouter()
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [issues, setIssues] = useState<IssueWithDistance[]>([])
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [technicianId, setTechnicianId] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (myLocation && issues.length > 0 && !mapLoaded) {
      initMap()
    }
  }, [myLocation, issues, mapLoaded])

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
        () => alert('Location access required')
      )
    }
  }

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setTechnicianId(session.user.id)
    getCurrentLocation()
    await fetchIssues(session.user.id)
  }

  const fetchIssues = async (id: string) => {
    try {
      const { data } = await supabase
        .from('issues')
        .select('*')
        .eq('assigned_to', id)
        .in('status', ['assigned', 'in-progress'])

      if (data) {
        const withCoords = data.filter(i => i.latitude && i.longitude)
        
        if (myLocation) {
          const withDistance = withCoords.map(issue => ({
            ...issue,
            distance: calculateDistance(myLocation.lat, myLocation.lng, issue.latitude, issue.longitude)
          }))
          withDistance.sort((a, b) => (a.distance || 999) - (b.distance || 999))
          setIssues(withDistance)
        } else {
          setIssues(withCoords)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const initMap = async () => {
    if (!mapContainerRef.current || mapLoaded) return

    try {
      const L = (await import('leaflet')).default

      if (mapRef.current) mapRef.current.remove()

      const center = myLocation ? [myLocation.lat, myLocation.lng] : [12.9716, 77.5946]
      const map = L.map(mapContainerRef.current).setView(center as [number, number], 12)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)

      // My location
      if (myLocation) {
        const myIcon = L.divIcon({
          html: `<div style="
            width:16px; height:16px;
            background:#2563eb;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 4px rgba(37,99,235,0.3);
          "></div>`,
          className: '',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
        L.marker([myLocation.lat, myLocation.lng], { icon: myIcon })
          .addTo(map)
          .bindPopup('<strong>📍 Your Location</strong>')
      }

      // Issue markers
      issues.forEach((issue, idx) => {
        const color = idx === 0 ? '#16a34a' : '#2563eb'
        const icon = L.divIcon({
          html: `<div style="
            background: ${color};
            color: white;
            padding: 4px 8px;
            border-radius: 16px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            border: 2px solid white;
          ">#${idx + 1} ${issue.vehicle_no}</div>`,
          className: '',
          iconAnchor: [40, 16]
        })
        
        L.marker([issue.latitude!, issue.longitude!], { icon })
          .addTo(map)
          .bindPopup(`
            <strong>#${idx + 1} ${issue.vehicle_no}</strong><br>
            ${issue.client}<br>
            ${issue.city} ${issue.location || ''}<br>
            ${issue.distance ? `<strong>${issue.distance < 1 ? (issue.distance * 1000).toFixed(0) + 'm' : issue.distance.toFixed(2) + 'km'} away</strong>` : ''}
          `)
      })

      // Fit bounds
      if (issues.length > 0) {
        const allPoints = myLocation 
          ? [[myLocation.lat, myLocation.lng] as [number, number], ...issues.map(i => [i.latitude!, i.longitude!] as [number, number])]
          : issues.map(i => [i.latitude!, i.longitude!] as [number, number])
        const bounds = L.latLngBounds(allPoints)
        map.fitBounds(bounds, { padding: [50, 50] })
      }

      mapRef.current = map
      setMapLoaded(true)
    } catch (err) {
      console.error('Map error:', err)
    }
  }

  const handleNavigateAll = () => {
    if (!myLocation || issues.length === 0) return
    const origin = `${myLocation.lat},${myLocation.lng}`
    if (issues.length === 1) {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${issues[0].latitude},${issues[0].longitude}&travelmode=driving`, '_blank')
    } else {
      const waypoints = issues.slice(0, -1).map(i => `${i.latitude},${i.longitude}`).join('|')
      const dest = `${issues[issues.length - 1].latitude},${issues[issues.length - 1].longitude}`
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=driving`, '_blank')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />Back
              </Button>
              <h1 className="text-xl font-bold">Route Map - Nearest First</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={getCurrentLocation}>
                <Locate className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchIssues(technicianId)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              {issues.length > 0 && (
                <Button size="sm" onClick={handleNavigateAll}>
                  <Navigation className="h-4 w-4 mr-2" />
                  Navigate All
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Issues - Sorted by Distance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                {loading ? (
                  <p className="text-xs text-center py-4">Loading...</p>
                ) : issues.length === 0 ? (
                  <p className="text-xs text-center py-4 text-muted-foreground">
                    No issues with GPS coordinates
                  </p>
                ) : (
                  issues.map((issue, idx) => (
                    <div
                      key={issue.id}
                      className="p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition"
                      onClick={() => router.push(`/technician/issues/${issue.id}`)}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <div className={`${idx === 0 ? 'bg-green-500' : 'bg-blue-500'} text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0`}>
                          #{idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{issue.vehicle_no}</p>
                          <p className="text-xs text-muted-foreground">{issue.client}</p>
                        </div>
                      </div>
                      {issue.city && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {issue.city}
                        </p>
                      )}
                      {issue.distance !== undefined && (
                        <p className={`text-xs font-bold mt-2 ${idx === 0 ? 'text-green-600' : 'text-blue-600'}`}>
                          {issue.distance < 1 
                            ? `${(issue.distance * 1000).toFixed(0)} meters away` 
                            : `${issue.distance.toFixed(2)} km away`}
                          {idx === 0 && ' • NEAREST!'}
                        </p>
                      )}
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
                        {!myLocation ? 'Getting your location...' : 'Loading map...'}
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
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span> Your Location
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span> #1 Nearest
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span> Other Stops
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
