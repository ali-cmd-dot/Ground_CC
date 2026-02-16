'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  MapPin, 
  Users, 
  ClipboardList, 
  LogOut,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye
} from 'lucide-react'
import type { Issue, Technician } from '@/lib/types'
import { getStatusColor, getPriorityColor, formatDateTime } from '@/lib/utils'

export default function AdminDashboard() {
  const router = useRouter()
  const [issues, setIssues] = useState<Issue[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalIssues: 0,
    pendingIssues: 0,
    completedIssues: 0,
    activeTechnicians: 0
  })

  useEffect(() => {
    checkAuth()
    fetchData()
    
    // Real-time subscription
    const subscription = supabase
      .channel('issues_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data: technician } = await supabase
      .from('technicians')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (technician?.role !== 'admin' && technician?.role !== 'manager') {
      router.push('/technician')
    }
  }

  const fetchData = async () => {
    try {
      // Fetch issues with technician names
      const { data: issuesData } = await supabase
        .from('issues')
        .select(`
          *,
          technicians:assigned_to (name)
        `)
        .order('created_at', { ascending: false })

      // Fetch technicians
      const { data: techData } = await supabase
        .from('technicians')
        .select('*')

      if (issuesData) {
        setIssues(issuesData)
        setStats({
          totalIssues: issuesData.length,
          pendingIssues: issuesData.filter(i => i.status === 'pending' || i.status === 'assigned').length,
          completedIssues: issuesData.filter(i => i.status === 'completed').length,
          activeTechnicians: techData?.length || 0
        })
      }
      if (techData) setTechnicians(techData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Admin Dashboard
            </h1>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalIssues}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingIssues}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedIssues}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Technicians</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeTechnicians}</div>
            </CardContent>
          </Card>
        </div>

        {/* Issues List */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Issues</CardTitle>
              <Button size="sm" onClick={() => router.push('/admin/issues/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Issue
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {issues.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No issues found. Create your first issue to get started.
                </p>
              ) : (
                issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-lg">{issue.vehicle_number}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full text-white ${getStatusColor(issue.status)}`}>
                          {issue.status}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full text-white ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Client: {issue.client_name} • {issue.client_phone}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3 inline mr-1" />
                        {issue.location}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Issue: {issue.issue_description}
                      </p>
                      {issue.assigned_to && (
                        <p className="text-xs text-blue-600 mt-2">
                          Assigned to: {(issue as any).technicians?.name || 'Unknown'}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Created: {formatDateTime(issue.created_at)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
