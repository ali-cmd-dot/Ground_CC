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
  Eye,
  Upload,
  UserPlus
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

  const handleAssignIssue = async (issueId: string, technicianId: string) => {
    try {
      const { error } = await supabase
        .from('issues')
        .update({ 
          assigned_to: technicianId,
          status: 'assigned'
        })
        .eq('id', issueId)

      if (error) throw error

      alert('Issue assigned successfully!')
      fetchData()
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

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/admin/issues/create')}
          >
            <CardContent className="pt-6">
              <div className="text-center">
                <Plus className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Create Issue</h3>
                <p className="text-sm text-muted-foreground">
                  Add single issue manually
                </p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/admin/import')}
          >
            <CardContent className="pt-6">
              <div className="text-center">
                <Upload className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Import CSV</h3>
                <p className="text-sm text-muted-foreground">
                  Bulk import from Excel/CSV
                </p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push('/admin/technicians')}
          >
            <CardContent className="pt-6">
              <div className="text-center">
                <UserPlus className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Technicians</h3>
                <p className="text-sm text-muted-foreground">
                  Manage team members
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Live Map</h3>
                <p className="text-sm text-muted-foreground">
                  Track technicians live
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Issues List */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Issues ({issues.length})</CardTitle>
              <div className="flex gap-2">
                <select className="h-9 px-3 border rounded-md text-sm">
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {issues.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No issues found. Create your first issue or import from CSV.
                </p>
              ) : (
                issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-lg">{issue.vehicle_no}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full text-white ${getStatusColor(issue.status)}`}>
                          {issue.status}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full text-white ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Client: {issue.client}
                      </p>
                      {issue.poc_name && (
                        <p className="text-sm text-muted-foreground">
                          POC: {issue.poc_name} • {issue.poc_number}
                        </p>
                      )}
                      {issue.city && (
                        <p className="text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 inline mr-1" />
                          {issue.city} {issue.location && `- ${issue.location}`}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-1">
                        Issue: {issue.issue}
                      </p>
                      {issue.availability && (
                        <p className="text-xs text-blue-600 mt-1">
                          Available: {issue.availability}
                        </p>
                      )}
                      {issue.assigned_to ? (
                        <p className="text-xs text-green-600 mt-1 font-medium">
                          ✓ Assigned to: {(issue as any).technicians?.name || 'Unknown'}
                        </p>
                      ) : (
                        <p className="text-xs text-orange-600 mt-1 font-medium">
                          ⚠ Not assigned yet
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Created: {formatDateTime(issue.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-col">
                      {!issue.assigned_to && (
                        <select
                          className="h-9 px-3 border rounded-md text-sm min-w-[150px]"
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAssignIssue(issue.id, e.target.value)
                            }
                          }}
                        >
                          <option value="">Assign to...</option>
                          {technicians
                            .filter(t => t.role === 'technician')
                            .map(tech => (
                              <option key={tech.id} value={tech.id}>
                                {tech.name}
                              </option>
                            ))}
                        </select>
                      )}
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
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
