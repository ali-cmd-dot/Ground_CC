'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  MapPin, Camera, LogOut, CheckCircle, PlayCircle,
  Navigation, RefreshCw, Phone, Locate
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
    getCurrentLocation()
  }, [])

  useEffect(() => {
    if (myLocation && technicianId) {
      fetchAndSortIssues()
    }
  }, [myLocation, technicianId])

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371 // Earth radius in km
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
          setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setFetchingLocation(false)
        },
        () => {
          alert('Please enable location access to see nearest issues')
          setFetchingLocation(false)
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      )
    }
  }

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    setTechnicianId(session.user.id)

    const { data: tech } = await supabase
      .from('technicians')
      .select('*')
      .eq('id', session.user.id)
      .single()

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

      if (data && myLocation) {
        // Calculate distance for each issue
        const withDistance = data.map(issue => {
          let distance = 9999
          if (issue.latitude && issue.longitude) {
            distance = calculateDistance(
              myLocation.lat,
              myLocation.lng,
              issue.latitude,
              issue.longitude
            )
          }
          return { ...issue, distance }
        })

        // Sort by distance (nearest first)
        withDistance.sort((a, b) => (a.distance || 9999) - (b.distance || 9999))
        setIssues(withDistance)
      } else {
        setIssues(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkAttendance = async (id: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('technician_id', id)
      .eq('date', today)
      .is('check_out', null)
      .single()
    setIsCheckedIn(!!data)
  }

  const handleCheckIn = async () => {
    if (!myLocation) {
      getCurrentLocation()
      alert('Getting your location...')
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
      alert('Checked in successfully!')
    }
  }

  const handleCheckOut = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('technician_id', technicianId)
      .eq('date', today)
      .is('check_out', null)
      .single()

    if (data) {
      const hours = (Date.now() - new Date(data.check_in).getTime()) / 3600000
      await supabase.from('attendance')
        .update({ check_out: new Date().toISOString(), total_hours: hours })
        .eq('id', data.id)
      setIsCheckedIn(false)
      alert(`Checked out! Total hours: ${hours.toFixed(2)}`)
    }
  }

  const handleStartIssue = async (e: React.MouseEvent, issueId: string) => {
    e.stopPropagation()
    const { error } = await supabase
      .from('issues')
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

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
      {/* Header */}
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
              <Button onClick={getCurrentLocation} variant="outline" size="sm" disabled={fetchingLocation}>
                <Locate className="h-4 w-4" />
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
        {/* Location Status */}
        {myLocation ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <MapPin className="h-4 w-4" />
              <span className="font-medium">Location active</span>
              <span className="text-xs">• Issues sorted by nearest first</span>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 text-sm">
                <Locate className="h-4 w-4" />
                <span>Location needed to sort by nearest</span>
              </div>
              <Button size="sm" onClick={getCurrentLocation}>Enable</Button>
            </div>
          </div>
        )}

        {/* Attendance */}
        <Card className={`border-0 text-white ${isCheckedIn ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Attendance Status</p>
                <p className="text-2xl font-bold mt-0.5">{isCheckedIn ? '✓ Checked In' : 'Not Checked In'}</p>
              </div>
              <Button
                onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
                size="lg"
                className="bg-white text-gray-800 hover:bg-gray-100 font-semibold"
              >
                {isCheckedIn ? 'Check Out' : 'Check In'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">{issues.filter(i => i.status === 'assigned').length}</p>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-blue-500">{issues.filter(i => i.status === 'in-progress').length}</p>
              <p className="text-xs text-muted-foreground mt-1">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{issues.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Tasks - Sorted by Nearest */}
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            Today's Tasks ({issues.length})
            {myLocation && <span className="text-xs font-normal text-green-600">• Sorted by nearest first</span>}
          </h2>

          {issues.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <CheckCircle className="h-14 w-14 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium text-muted-foreground">No tasks assigned</p>
                <p className="text-sm text-muted-foreground mt-1">Contact admin for assignments</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {issues.map((issue, idx) => (
                <Card
                  key={issue.id}
                  className="hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
                  onClick={() => router.push(`/technician/issues/${issue.id}`)}
                >
                  <CardContent className="p-4">
                    {/* Ranking Badge */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                          #{idx + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg">{issue.vehicle_no}</h3>
                          <p className="text-sm text-muted-foreground">{issue.client}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-col items-end">
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${getStatusColor(issue.status)}`}>
                          {issue.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>
                    </div>

                    {/* Distance Badge */}
                    {issue.distance !== undefined && issue.distance < 9999 && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md px-3 py-2 mb-3">
                        <p className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {issue.distance < 1 
                            ? `${(issue.distance * 1000).toFixed(0)} meters away` 
                            : `${issue.distance.toFixed(1)} km away`}
                          <span className="text-xs opacity-75">• {idx === 0 ? 'Nearest!' : `#${idx + 1} nearest`}</span>
                        </p>
                      </div>
                    )}

                    {/* Details */}
                    <div className="space-y-1.5 mb-4">
                      {(issue.city || issue.location) && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          {issue.city}{issue.location && ` - ${issue.location}`}
                        </p>
                      )}
                      {issue.poc_name && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                          {issue.poc_name} {issue.poc_number && `• ${issue.poc_number}`}
                        </p>
                      )}
                      <p className="text-sm bg-gray-50 dark:bg-gray-800 rounded-md px-3 py-2 mt-2">{issue.issue}</p>
                      {issue.availability && (
                        <p className="text-xs text-blue-600 font-medium">Available: {issue.availability}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" onClick={(e) => handleNavigate(e, issue)} className="w-full">
                        <Navigation className="h-4 w-4 mr-2" />Navigate
                      </Button>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); router.push(`/technician/issues/${issue.id}`) }} className="w-full">
                        <Camera className="h-4 w-4 mr-2" />Camera
                      </Button>
                      {issue.status === 'assigned' && (
                        <Button size="sm" className="w-full col-span-2 bg-orange-500 hover:bg-orange-600"
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
