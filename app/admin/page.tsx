'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  UserPlus,
  Search,
  X,
  RefreshCw,
  AlertTriangle
} from 'lucide-react'
import type { Issue, Technician } from '@/lib/types'
import { getStatusColor, getPriorityColor, formatDateTime } from '@/lib/utils'

export default function AdminDashboard() {
  const router = useRouter()
  const [issues, setIssues] = useState<Issue[]>([])
  const [filteredIssues, setFilteredIssues] = useState<Issue[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
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

    return () => { subscription.unsubscribe() }
  }, [])

  // Filter effect
  useEffect(() => {
    let filtered = issues

    if (searchTerm) {
      filtered = filtered.filter(issue =>
        issue.vehicle_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.poc_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.poc_number?.includes(searchTerm)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(issue => issue.status === statusFilter)
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(issue => issue.priority === priorityFilter)
    }

    setFilteredIssues(filtered)
  }, [issues, searchTerm, statusFilter, priorityFilter])

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
      const { data: issuesData } = await supabase
        .from('issues')
        .select(`*, technicians:assigned_to (name)`)
        .order('created_at', { ascending: false })

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
        .update({ assigned_to: technicianId, status: 'assigned' })
        .eq('id', issueId)

      if (error) throw error
      fetchData()
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setPriorityFilter('all')
  }

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
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
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/cautio_shield.webp" alt="Cautio" className="h-8 w-8" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Cautio Admin
              </h1>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalIssues}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{stats.pendingIssues}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.completedIssues}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Technicians</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.activeTechnicians}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card 
            className="hover:shadow-lg transition-all cursor-pointer hover:border-primary"
            onClick={() => router.push('/admin/issues/create')}
          >
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                  <Plus className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-sm">Create Issue</h3>
                <p className="text-xs text-muted-foreground mt-1">Add manually</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-all cursor-pointer hover:border-primary"
            onClick={() => router.push('/admin/import')}
          >
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
                  <Upload className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-sm">Import CSV</h3>
                <p className="text-xs text-muted-foreground mt-1">Bulk import</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-all cursor-pointer hover:border-primary"
            onClick={() => router.push('/admin/technicians')}
          >
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3">
                  <UserPlus className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-sm">Technicians</h3>
                <p className="text-xs text-muted-foreground mt-1">Manage team</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all cursor-pointer hover:border-primary">
            <CardContent className="pt-6 pb-6">
              <div className="text-center">
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-3">
                  <MapPin className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="font-semibold text-sm">Live Map</h3>
                <p className="text-xs text-muted-foreground mt-1">Track technicians</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Issues List with Search & Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <CardTitle>
                  All Issues 
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({filteredIssues.length}{hasActiveFilters ? ` of ${issues.length}` : ''})
                  </span>
                </CardTitle>
                <Button size="sm" onClick={() => router.push('/admin/issues/create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Issue
                </Button>
              </div>

              {/* Search & Filters Row */}
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vehicle no, client, city, POC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 px-3 border rounded-md text-sm bg-background"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                {/* Priority Filter */}
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="h-10 px-3 border rounded-md text-sm bg-background"
                >
                  <option value="all">All Priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {filteredIssues.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium">
                    {hasActiveFilters
                      ? 'No issues match your filters'
                      : 'No issues found. Create your first issue or import from CSV.'}
                  </p>
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                filteredIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => router.push(`/admin/issues/${issue.id}`)}
                    >
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-base">{issue.vehicle_no}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getStatusColor(issue.status)}`}>
                          {issue.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {issue.client}
                      </p>

                      {issue.poc_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          POC: {issue.poc_name} {issue.poc_number && `• ${issue.poc_number}`}
                        </p>
                      )}

                      {issue.city && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {issue.city}{issue.location && ` - ${issue.location}`}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {issue.issue}
                      </p>

                      <div className="flex items-center gap-3 mt-2">
                        {issue.assigned_to ? (
                          <span className="text-xs text-green-600 font-medium">
                            ✓ {(issue as any).technicians?.name || 'Assigned'}
                          </span>
                        ) : (
                          <span className="text-xs text-orange-500 font-medium">
                            ⚠ Unassigned
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(issue.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4 min-w-[140px]">
                      {!issue.assigned_to && (
                        <select
                          className="h-8 px-2 border rounded-md text-xs bg-background w-full"
                          onChange={(e) => {
                            if (e.target.value) handleAssignIssue(issue.id, e.target.value)
                          }}
                          onClick={(e) => e.stopPropagation()}
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
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => router.push(`/admin/issues/${issue.id}`)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
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
