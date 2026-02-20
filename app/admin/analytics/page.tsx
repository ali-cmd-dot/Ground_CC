'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { ArrowLeft, TrendingUp, Users, CheckCircle, Clock, IndianRupee, Download } from 'lucide-react'

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

export default function AnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30') // days

  // Data states
  const [issuesByStatus, setIssuesByStatus] = useState<any[]>([])
  const [issuesByPriority, setIssuesByPriority] = useState<any[]>([])
  const [issuesByDay, setIssuesByDay] = useState<any[]>([])
  const [techPerformance, setTechPerformance] = useState<any[]>([])
  const [revenueByMonth, setRevenueByMonth] = useState<any[]>([])
  const [issuesByCity, setIssuesByCity] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalIssues: 0, completed: 0, avgResolutionHours: 0,
    totalRevenue: 0, pendingRevenue: 0, activeTechs: 0
  })

  useEffect(() => {
    checkAuth()
    fetchAnalytics()
  }, [dateRange])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: tech } = await supabase.from('technicians').select('role').eq('id', session.user.id).single()
    if (tech?.role !== 'admin' && tech?.role !== 'manager') router.push('/technician')
  }

  const fetchAnalytics = async () => {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - parseInt(dateRange))
    const sinceISO = since.toISOString()

    try {
      // Fetch all issues in range
      const { data: issues } = await supabase
        .from('issues')
        .select('*, technicians:assigned_to(name)')
        .gte('created_at', sinceISO)

      if (!issues) return

      // Fetch invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .gte('created_at', sinceISO)

      // Fetch technicians
      const { data: technicians } = await supabase
        .from('technicians')
        .select('id, name')
        .eq('is_active', true)

      // Stats
      const completed = issues.filter(i => i.status === 'completed')
      const avgHours = completed.length > 0
        ? completed.filter(i => i.started_at && i.completed_at)
            .reduce((sum, i) => {
              const diff = new Date(i.completed_at!).getTime() - new Date(i.started_at!).getTime()
              return sum + diff / 3600000
            }, 0) / Math.max(completed.filter(i => i.started_at && i.completed_at).length, 1)
        : 0

      const totalRevenue = invoices?.filter(i => i.payment_status === 'paid').reduce((s, i) => s + i.total_amount, 0) || 0
      const pendingRevenue = invoices?.filter(i => i.payment_status === 'pending').reduce((s, i) => s + i.total_amount, 0) || 0

      setStats({
        totalIssues: issues.length, completed: completed.length,
        avgResolutionHours: avgHours, totalRevenue, pendingRevenue,
        activeTechs: technicians?.length || 0
      })

      // By Status
      const statusCounts: Record<string, number> = {}
      issues.forEach(i => { statusCounts[i.status] = (statusCounts[i.status] || 0) + 1 })
      setIssuesByStatus(Object.entries(statusCounts).map(([name, value]) => ({ name, value })))

      // By Priority
      const priorityCounts: Record<string, number> = {}
      issues.forEach(i => { priorityCounts[i.priority] = (priorityCounts[i.priority] || 0) + 1 })
      setIssuesByPriority(Object.entries(priorityCounts).map(([name, value]) => ({ name, value })))

      // By Day (last N days)
      const dayMap: Record<string, { created: number; completed: number }> = {}
      const daysToShow = Math.min(parseInt(dateRange), 30)
      for (let d = daysToShow - 1; d >= 0; d--) {
        const date = new Date()
        date.setDate(date.getDate() - d)
        const key = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        dayMap[key] = { created: 0, completed: 0 }
      }
      issues.forEach(i => {
        const key = new Date(i.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        if (dayMap[key]) dayMap[key].created++
        if (i.completed_at) {
          const compKey = new Date(i.completed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
          if (dayMap[compKey]) dayMap[compKey].completed++
        }
      })
      setIssuesByDay(Object.entries(dayMap).map(([date, data]) => ({ date, ...data })))

      // Tech Performance
      const techMap: Record<string, { name: string; assigned: number; completed: number; inProgress: number }> = {}
      issues.forEach(i => {
        if (!i.assigned_to) return
        const name = (i as any).technicians?.name || 'Unknown'
        if (!techMap[i.assigned_to]) techMap[i.assigned_to] = { name, assigned: 0, completed: 0, inProgress: 0 }
        techMap[i.assigned_to].assigned++
        if (i.status === 'completed') techMap[i.assigned_to].completed++
        if (i.status === 'in-progress') techMap[i.assigned_to].inProgress++
      })
      setTechPerformance(Object.values(techMap).sort((a, b) => b.completed - a.completed))

      // Revenue by Month
      const monthMap: Record<string, { month: string; revenue: number; pending: number }> = {}
      invoices?.forEach(inv => {
        const month = new Date(inv.created_at).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
        if (!monthMap[month]) monthMap[month] = { month, revenue: 0, pending: 0 }
        if (inv.payment_status === 'paid') monthMap[month].revenue += inv.total_amount
        else monthMap[month].pending += inv.total_amount
      })
      setRevenueByMonth(Object.values(monthMap))

      // By City
      const cityMap: Record<string, number> = {}
      issues.forEach(i => { if (i.city) cityMap[i.city] = (cityMap[i.city] || 0) + 1 })
      setIssuesByCity(Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value })))

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = async () => {
    const { data: issues } = await supabase.from('issues').select('*, technicians:assigned_to(name)')
    if (!issues) return
    const headers = ['Vehicle No', 'Client', 'City', 'Issue', 'Status', 'Priority', 'Assigned To', 'Created At', 'Completed At']
    const rows = issues.map(i => [
      i.vehicle_no, i.client, i.city || '', i.issue, i.status, i.priority,
      (i as any).technicians?.name || '', i.created_at, i.completed_at || ''
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cautio-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push('/admin')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            <h1 className="text-xl font-bold">Analytics & Reports</h1>
          </div>
          <div className="flex gap-3">
            <select value={dateRange} onChange={e => setDateRange(e.target.value)}
              className="h-10 px-3 border rounded-md bg-background text-sm">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 1 year</option>
            </select>
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Total Issues', value: stats.totalIssues, icon: <TrendingUp className="h-6 w-6 text-blue-600" />, color: 'blue' },
            { label: 'Completed', value: stats.completed, icon: <CheckCircle className="h-6 w-6 text-green-600" />, color: 'green' },
            { label: 'Avg Resolution', value: `${stats.avgResolutionHours.toFixed(1)}h`, icon: <Clock className="h-6 w-6 text-yellow-600" />, color: 'yellow' },
            { label: 'Revenue (Paid)', value: `₹${stats.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: <IndianRupee className="h-6 w-6 text-green-600" />, color: 'green' },
            { label: 'Pending Revenue', value: `₹${stats.pendingRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: <IndianRupee className="h-6 w-6 text-yellow-600" />, color: 'yellow' },
            { label: 'Active Technicians', value: stats.activeTechs, icon: <Users className="h-6 w-6 text-purple-600" />, color: 'purple' },
          ].map((kpi, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                  </div>
                  <div className={`h-12 w-12 bg-${kpi.color}-100 dark:bg-${kpi.color}-900/30 rounded-full flex items-center justify-center`}>
                    {kpi.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Issues Over Time */}
        <Card>
          <CardHeader><CardTitle>Issues Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={issuesByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.floor(issuesByDay.length / 8)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" stroke="#2563eb" name="Created" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="completed" stroke="#16a34a" name="Completed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status + Priority Pie Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Issues by Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={issuesByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {issuesByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Issues by Priority</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={issuesByPriority} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {issuesByPriority.map((_, i) => <Cell key={i} fill={['#94a3b8', '#f59e0b', '#f97316', '#ef4444'][i % 4]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        {revenueByMonth.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => `₹${Number(v).toLocaleString('en-IN')}`} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#16a34a" name="Collected" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" fill="#f59e0b" name="Pending" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Issues by City */}
        {issuesByCity.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Issues by City</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={issuesByCity} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" name="Issues" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Technician Performance */}
        {techPerformance.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Technician Performance</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, techPerformance.length * 60)}>
                <BarChart data={techPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="assigned" fill="#2563eb" name="Assigned" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="completed" fill="#16a34a" name="Completed" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="inProgress" fill="#f59e0b" name="In Progress" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
