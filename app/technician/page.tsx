'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  MapPin, Camera, LogOut, CheckCircle, PlayCircle,
  Navigation, RefreshCw, Phone, Locate, Map, AlertCircle
} from 'lucide-react'
import type { Issue } from '@/lib/types'
import { getStatusColor, getPriorityColor } from '@/lib/utils'

interface IssueWithDistance extends Issue {
  distance?: number
}

export default function TechnicianDashboard() {
  const router = useRouter()
  const [issues, setIssues] = useState<IssueWithDistance[]>([])
  const [loading, setLoading] = useState(true)
  const [technicianId, setTechnicianId] = useState('')
  const [technicianName, setTechnicianName] = useState('')
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [fetchingLocation, setFetchingLocation] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (technicianId) {
      getCurrentLocation()
    }
  }, [technicianId])

  useEffect(() => {
    if (myLocation && technicianId) {
      fetchAndSortIssues()
    } else if (technicianId) {
      fetchAndSortIssues()
    }
  }, [myLocation, technicianId])

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
    setFetchingLocation(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const newLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          console.log('Current location:', newLocation)
          setMyLocation(newLocation)
          setFetchingLocation(false)
        },
        err => {
          console.error('Location error:', err)
          alert('Please enable location access')
          setFetchingLocation(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }
  }

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setTechnicianId(session.user.id)
    const { data: tech } = await supabase.from('technicians').select('*').eq('id', session.user.id).single()
    if (tech) setTechnicianName(tech.name)
    await checkAttendance(session.user.id)
  }

  const fetchAndSortIssues = async () => {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .eq('assigned_to', technicianId)
        .in('status', ['assigned', 'in-progress'])

      if (error) throw error

      if (data) {
        console.log('Raw issues:', data)
        
        const withDistance: IssueWithDistance[] = data.map(issue => {
          let distance = 999999
          
          // Check if issue has GPS coordinates
          if (issue.latitude && issue.longitude) {
            if (myLocation) {
              distance = calculateDistance(
                myLocation.lat,
                myLocation.lng,
                issue.latitude,
                issue.longitude
              )
              console.log(`Issue ${issue.vehicle_no}: Distance = ${distance.toFixed(2)}km`)
            }
          } else {
            console.warn(`Issue ${issue.vehicle_no}: No GPS coordinates (lat: ${issue.latitude}, lng: ${issue.longitude})`)
          }
          
          return { ...issue, distance }
        })

        // Sort by distance
        withDistance.sort((a, b) => {
          const distA = a.distance ?? 999999
          const distB = b.distance ?? 999999
          return distA - distB
        })

        console.log('Sorted issues by distance:', withDistance.map(i => ({
          vehicle: i.vehicle_no,
          distance: i.distance,
          hasGPS: !!(i.latitude && i.longitude)
        })))

        setIssues(withDistance)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkAttendance = async (id: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('attendance').select('*')
      .eq('technician_id', id).eq('date', today).is('check_out', null).single()
    setIsCheckedIn(!!data)
  }

  const handleCheckIn = async () => {
    if (!myLocation) {
      alert('Getting your location...')
      getCurrentLocation()
      return
    }
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('attendance').insert({
      technician_id: technicianId,
      check_in: new Date().toISOString(),
      latitude: myLocation.lat,
      longitude: myLocation.lng,
      date: today
    })
    if (!error) {
      setIsCheckedIn(true)
      alert('Checked in!')
    }
  }

  const handleCheckOut = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('attendance').select('*')
      .eq('technician_id', technicianId).eq('date', today).is('check_out', null).single()
    if (data) {
      const hours = (Date.now() - new Date(data.check_in).getTime()) / 3600000
      await supabase.from('attendance').update({ 
        check_out: new Date().toISOString(), 
        total_hours: hours 
      }).eq('id', data.id)
      setIsCheckedIn(false)
      alert(`Checked out! Hours: ${hours.toFixed(2)}`)
    }
  }

  const handleStartIssue = async (e: React.MouseEvent, issueId: string) => {
    e.stopPropagation()
    const { error } = await supabase.from('issues')
      .update({ status: 'in-progress', started_at: new Date().toISOString() })
      .eq('id', issueId)
    if (!error) {
      alert('Issue started!')
      fetchAndSortIssues()
    }
  }

  const handleNavigate = (e: React.MouseEvent, issue: Issue) => {
    e.stopPropagation()
    if (issue.latitude && issue.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}`, '_blank')
    } else if (issue.city || issue.location) {
      const query = `${issue.location || ''} ${issue.city || ''}`.trim()
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank')
    }
  }

  const handleNavigateAll = () => {
    if (!myLocation) {
      alert('Please enable location first')
      return
    }
    const issuesWithCoords = issues.filter(i => i.latitude && i.longitude)
    if (issuesWithCoords.length === 0) {
      alert('No issues have GPS coordinates')
      return
    }
    const origin = `${myLocation.lat},${myLocation.lng}`
    if (issuesWithCoords.length === 1) {
      const dest = `${issuesWithCoords[0].latitude},${issuesWithCoords[0].longitude}`
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`, '_blank')
    } else {
      const waypoints = issuesWithCoords.slice(0, -1).map(i => `${i.latitude},${i.longitude}`).join('|')
      const destination = `${issuesWithCoords[issuesWithCoords.length - 1].latitude},${issuesWithCoords[issuesWithCoords.length - 1].longitude}`
      window.open(
        `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`,
        '_blank'
      )
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const issuesWithGPS = issues.filter(i => i.latitude && i.longitude).length
  const issuesWithoutGPS = issues.length - issuesWithGPS

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/cautio_shield.webp" alt="Cautio" className="h-7 w-7" />
              <div>
                <h1 className="text-lg font-bold leading-tight">My Tasks</h1>
                {technicianName && <p className="text-xs text-muted-foreground">{technicianName}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {issuesWithGPS > 0 && (
                <Button onClick={() => router.push('/technician/map')} variant="outline" size="sm">
                  <Map className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={getCurrentLocation} variant="outline" size="sm" disabled={fetchingLocation}>
                <Locate className={`h-4 w-4 ${fetchingLocation ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={() => fetchAndSortIssues()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 space-y-5 max-w-2xl mx-auto">
        {myLocation ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">Location: {myLocation.lat.toFixed(4)}, {myLocation.lng.toFixed(4)}</span>
              </div>
              {issuesWithGPS > 0 && (
                <Button size="sm" onClick={handleNavigateAll} className="h-7 text-xs">
                  <Map className="h-3 w-3 mr-1" />Route All
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
                <Locate className="h-4 w-4" />
                <span className="font-medium">Location OFF - Cannot sort by nearest</span>
              </div>
              <Button size="sm" onClick={getCurrentLocation} disabled={fetchingLocation}>
                {fetchingLocation ? 'Getting...' : 'Enable'}
              </Button>
            </div>
          </div>
        )}

        {issuesWithoutGPS > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{issuesWithoutGPS} issue(s) missing GPS coordinates - cannot calculate distance</span>
            </div>
          </div>
        )}

        <Card className={`border-0 text-white ${isCheckedIn ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Attendance Status</p>
                <p className="text-2xl font-bold mt-0.5">{isCheckedIn ? '✓ Checked In' : 'Not Checked In'}</p>
              </div>
              <Button onClick={isCheckedIn ? handleCheckOut : handleCheckIn} size="lg"
                className="bg-white text-gray-800 hover:bg-gray-100 font-semibold">
                {isCheckedIn ? 'Check Out' : 'Check In'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{issues.filter(i => i.status === 'assigned').length}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{issues.filter(i => i.status === 'in-progress').length}</p>
            <p className="text-xs text-muted-foreground mt-1">In Progress</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{issues.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </CardContent></Card>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            Today's Tasks ({issues.length})
            {myLocation && issuesWithGPS > 0 && (
              <span className="text-xs font-normal text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                ✓ Sorted nearest first
              </span>
            )}
          </h2>

          {issues.length === 0 ? (
            <Card><CardContent className="py-14 text-center">
              <CheckCircle className="h-14 w-14 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No tasks assigned</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              {issues.map((issue, idx) => (
                <Card key={issue.id} className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/technician/issues/${issue.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`${idx === 0 && issue.distance && issue.distance < 999999 ? 'bg-green-500' : 'bg-blue-500'} text-white text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center`}>
                          #{idx + 1}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{issue.vehicle_no}</h3>
                          <p className="text-sm text-muted-foreground">{issue.client}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-col items-end">
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getStatusColor(issue.status)}`}>{issue.status}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getPriorityColor(issue.priority)}`}>{issue.priority}</span>
                      </div>
                    </div>

                    {issue.distance !== undefined && issue.distance < 999999 ? (
                      <div className={`${idx === 0 ? 'bg-green-100 border-green-300' : 'bg-blue-50 border-blue-200'} border rounded-md px-3 py-2 mb-3`}>
                        <p className={`text-sm font-bold ${idx === 0 ? 'text-green-700' : 'text-blue-700'} flex items-center gap-2`}>
                          <Navigation className="h-4 w-4" />
                          {issue.distance < 1 ? `${(issue.distance * 1000).toFixed(0)}m away` : `${issue.distance.toFixed(2)}km away`}
                          {idx === 0 && <span className="text-xs">• NEAREST!</span>}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-100 border border-gray-300 rounded-md px-3 py-2 mb-3">
                        <p className="text-xs text-gray-600 flex items-center gap-2">
                          <AlertCircle className="h-3 w-3" />
                          No GPS data - distance unknown
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5 mb-4">
                      {(issue.city || issue.location) && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {issue.city}{issue.location && ` - ${issue.location}`}
                        </p>
                      )}
                      {issue.poc_name && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {issue.poc_name} {issue.poc_number && `• ${issue.poc_number}`}
                        </p>
                      )}
                      <p className="text-sm bg-gray-50 dark:bg-gray-800 rounded-md px-3 py-2">{issue.issue}</p>
                      {issue.availability && <p className="text-xs text-blue-600">Available: {issue.availability}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" onClick={(e) => handleNavigate(e, issue)}>
                        <Navigation className="h-4 w-4 mr-2" />Navigate
                      </Button>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); router.push(`/technician/issues/${issue.id}`) }}>
                        <Camera className="h-4 w-4 mr-2" />Camera
                      </Button>
                      {issue.status === 'assigned' && (
                        <Button size="sm" className="col-span-2 bg-orange-500 hover:bg-orange-600"
                          onClick={(e) => handleStartIssue(e, issue.id)}>
                          <PlayCircle className="h-4 w-4 mr-2" />Start Work
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
