'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Download, Users, Clock, CheckCircle, XCircle, Search, Calendar } from 'lucide-react'

interface AttendanceRecord {
  id: string
  technician_id: string
  date: string
  check_in: string
  check_out?: string
  total_hours?: number
  latitude?: number
  longitude?: number
  technicians?: { name: string; email: string; phone: string }
}

export default function AdminAttendancePage() {
  const router = useRouter()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({ present: 0, absent: 0, totalHours: 0 })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    fetchAttendance()
  }, [selectedDate])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: tech } = await supabase.from('technicians').select('role').eq('id', session.user.id).single()
    if (tech?.role !== 'admin' && tech?.role !== 'manager') router.push('/technician')
  }

  const fetchAttendance = async () => {
    setLoading(true)
    try {
      // Get all technicians
      const { data: techs } = await supabase.from('technicians').select('id, name, email, phone').eq('is_active', true).eq('role', 'technician')

      // Get attendance for selected date
      const { data: att } = await supabase
        .from('attendance')
        .select('*, technicians:technician_id(name, email, phone)')
        .eq('date', selectedDate)
        .order('check_in', { ascending: true })

      if (att) {
        setRecords(att)
        const present = att.length
        const absent = (techs?.length || 0) - present
        const totalHours = att.reduce((s, a) => s + (a.total_hours || 0), 0)
        setStats({ present, absent: Math.max(0, absent), totalHours })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = records.filter(r =>
    !searchTerm ||
    r.technicians?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.technicians?.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Date', 'Check In', 'Check Out', 'Total Hours', 'Location']
    const rows = records.map(r => [
      r.technicians?.name || '',
      r.technicians?.email || '',
      r.date,
      new Date(r.check_in).toLocaleTimeString('en-IN'),
      r.check_out ? new Date(r.check_out).toLocaleTimeString('en-IN') : 'Not checked out',
      r.total_hours?.toFixed(2) || '0',
      r.latitude ? `${r.latitude}, ${r.longitude}` : 'N/A'
    ])
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${selectedDate}.csv`
    a.click()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push('/admin')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            <h1 className="text-xl font-bold">Attendance Management</h1>
          </div>
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Present</p>
                  <p className="text-3xl font-bold text-green-600">{stats.present}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Absent</p>
                  <p className="text-3xl font-bold text-red-600">{stats.absent}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.totalHours.toFixed(1)}h</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input type="date" value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-auto" />
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search technician..." value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance — {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No attendance records for this date</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 pr-4">Technician</th>
                      <th className="pb-3 pr-4">Check In</th>
                      <th className="pb-3 pr-4">Check Out</th>
                      <th className="pb-3 pr-4">Hours</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(record => {
                      const isCheckedOut = !!record.check_out
                      const hours = record.total_hours || 0
                      return (
                        <tr key={record.id}>
                          <td className="py-3 pr-4">
                            <p className="font-medium">{record.technicians?.name}</p>
                            <p className="text-xs text-muted-foreground">{record.technicians?.email}</p>
                          </td>
                          <td className="py-3 pr-4 font-mono text-sm">
                            {new Date(record.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 pr-4 font-mono text-sm">
                            {record.check_out
                              ? new Date(record.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                              : <span className="text-yellow-500 font-medium">Active</span>}
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`font-bold ${hours >= 8 ? 'text-green-600' : hours >= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {isCheckedOut ? `${hours.toFixed(1)}h` : '—'}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isCheckedOut ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {isCheckedOut ? 'Completed' : 'Working'}
                            </span>
                          </td>
                          <td className="py-3">
                            {record.latitude ? (
                              <a href={`https://maps.google.com/?q=${record.latitude},${record.longitude}`}
                                target="_blank" className="text-blue-600 hover:underline text-xs">
                                View Map
                              </a>
                            ) : <span className="text-xs text-muted-foreground">N/A</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
