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
  Clock,
  PlayCircle,
  Navigation
} from 'lucide-react'
import type { Issue } from '@/lib/types'
import { getStatusColor, getPriorityColor, formatDateTime } from '@/lib/utils'

export default function TechnicianDashboard() {
  const router = useRouter()
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [technicianId, setTechnicianId] = useState('')
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
    await fetchAssignedIssues(session.user.id)
    await checkAttendance(session.user.id)
  }

  const fetchAssignedIssues = async (id: string) => {
    try {
      const { data } = await supabase
        .from('issues')
        .select('*')
        .eq('assigned_to', id)
        .in('status', ['assigned', 'in-progress'])
        .order('priority', { ascending: false })

      if (data) setIssues(data)
    } catch (error) {
      console.error('Error fetching issues:', error)
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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords
        const today = new Date().toISOString().split('T')[0]

        await supabase.from('attendance').insert({
          technician_id: technicianId,
          check_in: new Date().toISOString(),
          latitude,
          longitude,
          date: today
        })

        setIsCheckedIn(true)
      })
    }
  }

  const handleCheckOut = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data: attendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('technician_id', technicianId)
      .eq('date', today)
      .is('check_out', null)
      .single()

    if (attendance) {
      const checkInTime = new Date(attendance.check_in)
      const checkOutTime = new Date()
      const hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

      await supabase
        .from('attendance')
        .update({
          check_out: checkOutTime.toISOString(),
          total_hours: hours
        })
        .eq('id', attendance.id)

      setIsCheckedIn(false)
    }
  }

  const handleStartIssue = async (issueId: string) => {
    try {
      const { error } = await supabase
        .from('issues')
        .update({
          status: 'in-progress',
          started_at: new Date().toISOString()
        })
        .eq('id', issueId)

      if (error) throw error

      alert('Issue started!')
      fetchAssignedIssues(technicianId)
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              My Tasks
            </h1>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Check-in/out Card */}
        <Card className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Attendance</p>
                <p className="text-2xl font-bold mt-1">
                  {isCheckedIn ? 'Checked In' : 'Not Checked In'}
                </p>
              </div>
              <Button
                onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
                variant={isCheckedIn ? "secondary" : "default"}
                size="lg"
                className="bg-white text-blue-600 hover:bg-gray-100"
              >
                {isCheckedIn ? 'Check Out' : 'Check In'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Today's Tasks */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Today's Tasks ({issues.length})</h2>
          
          {issues.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No tasks assigned yet. Check back later!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {issues.map((issue) => (
                <Card key={issue.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{issue.vehicle_no}</h3>
                        <p className="text-sm text-muted-foreground">{issue.client}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full text-white ${getStatusColor(issue.status)}`}>
                          {issue.status}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full text-white ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {issue.city && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-2" />
                          {issue.city} {issue.location && `- ${issue.location}`}
                        </div>
                      )}
                      {issue.poc_name && (
                        <p className="text-sm text-muted-foreground">
                          POC: {issue.poc_name} • {issue.poc_number}
                        </p>
                      )}
                      <p className="text-sm">{issue.issue}</p>
                      {issue.availability && (
                        <p className="text-xs text-blue-600">
                          Available: {issue.availability}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1">
                        <Navigation className="h-4 w-4 mr-2" />
                        Navigate
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <Camera className="h-4 w-4 mr-2" />
                        Camera
                      </Button>
                      {issue.status === 'assigned' && (
                        <Button 
                          size="sm" 
                          variant="default" 
                          className="flex-1"
                          onClick={() => handleStartIssue(issue.id)}
                        >
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Start
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {issues.filter(i => i.status === 'assigned').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {issues.filter(i => i.status === 'in-progress').length}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
