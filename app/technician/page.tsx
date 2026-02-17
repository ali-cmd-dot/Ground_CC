'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  MapPin, 
  Camera, 
  LogOut,
  CheckCircle,
  PlayCircle,
  Navigation,
  RefreshCw,
  Phone
} from 'lucide-react'
import type { Issue } from '@/lib/types'
import { getStatusColor, getPriorityColor } from '@/lib/utils'

export default function TechnicianDashboard() {
  const router = useRouter()
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [technicianId, setTechnicianId] = useState('')
  const [technicianName, setTechnicianName] = useState('')
  const [isCheckedIn, setIsCheckedIn] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    setTechnicianId(session.user.id)

    const { data: tech } = await supabase
      .from('technicians')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (tech) setTechnicianName(tech.name)

    await fetchAssignedIssues(session.user.id)
    await checkAttendance(session.user.id)
  }

  const fetchAssignedIssues = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .eq('assigned_to', id)
        .in('status', ['assigned', 'in-progress'])
        .order('priority', { ascending: false })

      if (data) setIssues(data)
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
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('attendance').insert({
        technician_id: technicianId,
        check_in: new Date().toISOString(),
        latitude, longitude,
        date: today
      })
      if (!error) {
        setIsCheckedIn(true)
        alert('Checked in!')
      }
    }, () => alert('Location access required for check-in'))
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
      alert(`Checked out! Hours: ${hours.toFixed(2)}`)
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
      fetchAssignedIssues(technicianId)
    }
  }

  const handleNavigate = (e: React.MouseEvent, issue: Issue) => {
    e.stopPropagation()
    if (issue.latitude && issue.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}`, '_blank')
    } else if (issue.city || issue.location) {
      const query = `${issue.location || ''} ${issue.city || ''}`.trim()
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank')
    } else {
      alert('Location not available for this issue')
    }
  }

  const handleCamera = (e: React.MouseEvent, issueId: string) => {
    e.stopPropagation()
    router.push(`/technician/issues/${issueId}?tab=camera`)
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
                {technicianName && (
                  <p className="text-xs text-muted-foreground">{technicianName}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => fetchAssignedIssues(technicianId)} variant="outline" size="sm">
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
        {/* Attendance Card */}
        <Card className={`border-0 text-white ${isCheckedIn ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Attendance Status</p>
                <p className="text-2xl font-bold mt-0.5">
                  {isCheckedIn ? '✓ Checked In' : 'Not Checked In'}
                </p>
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

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">
                {issues.filter(i => i.status === 'assigned').length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-blue-500">
                {issues.filter(i => i.status === 'in-progress').length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                {issues.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Tasks */}
        <div>
          <h2 className="text-base font-semibold mb-3">
            Today's Tasks ({issues.length})
          </h2>

          {issues.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <CheckCircle className="h-14 w-14 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium text-muted-foreground">No tasks assigned</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Contact admin for issue assignment
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {issues.map((issue) => (
                <Card
                  key={issue.id}
                  className="hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
                  onClick={() => router.push(`/technician/issues/${issue.id}`)}
                >
                  <CardContent className="p-4">
                    {/* Top Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{issue.vehicle_no}</h3>
                        <p className="text-sm text-muted-foreground">{issue.client}</p>
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
                      <p className="text-sm bg-gray-50 dark:bg-gray-800 rounded-md px-3 py-2 mt-2">
                        {issue.issue}
                      </p>
                      {issue.availability && (
                        <p className="text-xs text-blue-600 font-medium">
                          Available: {issue.availability}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => handleNavigate(e, issue)}
                        className="w-full"
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        Navigate
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleCamera(e, issue.id)}
                        className="w-full"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Camera
                      </Button>

                      {issue.status === 'assigned' && (
                        <Button
                          size="sm"
                          className="w-full col-span-2 bg-orange-500 hover:bg-orange-600"
                          onClick={(e) => handleStartIssue(e, issue.id)}
                        >
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Start Work
                        </Button>
                      )}

                      {issue.status === 'in-progress' && (
                        <Button
                          size="sm"
                          className="w-full col-span-2 bg-green-600 hover:bg-green-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/technician/issues/${issue.id}`)
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Complete Issue
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
