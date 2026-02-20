'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, CheckCircle, Calendar } from 'lucide-react'

interface AttendanceRecord {
  date: string
  check_in: string
  check_out?: string
  total_hours?: number
  latitude?: number
  longitude?: number
}

export default function TechnicianAttendancePage() {
  const router = useRouter()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [techId, setTechId] = useState('')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [stats, setStats] = useState({ present: 0, totalHours: 0, avgHours: 0 })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (techId) fetchAttendance()
  }, [techId, currentMonth])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setTechId(session.user.id)
  }

  const fetchAttendance = async () => {
    setLoading(true)
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth() + 1
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('technician_id', techId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (data) {
      setRecords(data)
      const present = data.length
      const totalHours = data.reduce((s, r) => s + (r.total_hours || 0), 0)
      setStats({ present, totalHours, avgHours: present > 0 ? totalHours / present : 0 })
    }
    setLoading(false)
  }

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return { firstDay, daysInMonth }
  }

  const getRecordForDate = (day: number) => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth() + 1
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return records.find(r => r.date === dateStr)
  }

  const isWeekend = (day: number) => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const date = new Date(year, month, day)
    return date.getDay() === 0 || date.getDay() === 6
  }

  const isToday = (day: number) => {
    const today = new Date()
    return today.getDate() === day &&
      today.getMonth() === currentMonth.getMonth() &&
      today.getFullYear() === currentMonth.getFullYear()
  }

  const isFuture = (day: number) => {
    const today = new Date()
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    return date > today
  }

  const { firstDay, daysInMonth } = getDaysInMonth()
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push('/technician')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          <h1 className="text-xl font-bold">My Attendance</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
              <p className="text-xs text-muted-foreground mt-1">Days Present</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.totalHours.toFixed(0)}h</p>
              <p className="text-xs text-muted-foreground mt-1">Total Hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.avgHours.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground mt-1">Avg Per Day</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="h-5 w-5" /></Button>
              <CardTitle className="text-lg">
                {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="h-5 w-5" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const record = getRecordForDate(day)
                const weekend = isWeekend(day)
                const today = isToday(day)
                const future = isFuture(day)

                return (
                  <div key={day} className={`
                    aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative
                    ${today ? 'ring-2 ring-primary' : ''}
                    ${record ? 'bg-green-100 dark:bg-green-900/30' : weekend ? 'bg-gray-100 dark:bg-gray-800' : future ? '' : 'bg-red-50 dark:bg-red-900/10'}
                  `}>
                    <span className={`font-medium text-sm ${today ? 'text-primary' : weekend && !record ? 'text-muted-foreground' : ''}`}>
                      {day}
                    </span>
                    {record && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-0.5"></div>
                    )}
                    {!record && !weekend && !future && (
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-0.5"></div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground justify-center">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 inline-block"></span>Present</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 inline-block"></span>Absent</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block"></span>Weekend</span>
            </div>
          </CardContent>
        </Card>

        {/* Records List */}
        <Card>
          <CardHeader><CardTitle>Detailed Records</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : records.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No records this month</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...records].reverse().map(record => (
                  <div key={record.date} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          In: {new Date(record.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          {record.check_out && ` • Out: ${new Date(record.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {record.total_hours ? (
                        <span className="font-bold text-green-600">{record.total_hours.toFixed(1)}h</span>
                      ) : (
                        <span className="text-xs text-yellow-500 font-medium">Active</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
