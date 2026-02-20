'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, MapPin, Zap, Users } from 'lucide-react'
import type { Technician } from '@/lib/types'

interface TechWithDistance extends Technician {
  distance?: number
  lastLocation?: { lat: number; lng: number }
}

export default function CreateIssuePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [technicians, setTechnicians] = useState<TechWithDistance[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [nearestTech, setNearestTech] = useState<TechWithDistance | null>(null)

  const [formData, setFormData] = useState({
    vehicle_no: '', client: '', poc_name: '', poc_number: '',
    issue: '', city: '', location: '', latitude: 0, longitude: 0,
    availability: '', priority: 'medium', assigned_to: '',
    availability_date: ''
  })

  useEffect(() => {
    fetchTechnicians()
  }, [])

  // Auto-find nearest when GPS coords are set
  useEffect(() => {
    if (formData.latitude && formData.longitude) {
      findNearestTechnician(formData.latitude, formData.longitude)
    }
  }, [formData.latitude, formData.longitude])

  const fetchTechnicians = async () => {
    const { data } = await supabase
      .from('technicians')
      .select('*')
      .eq('role', 'technician')
      .eq('is_active', true)
    if (data) setTechnicians(data)
  }

  const getCurrentLocation = () => {
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }))
        setLocationLoading(false)
      },
      (error) => {
        alert('Unable to get location: ' + error.message)
        setLocationLoading(false)
      }
    )
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const findNearestTechnician = async (issueLat: number, issueLng: number) => {
    setAutoAssigning(true)
    try {
      // Get today's checked-in technicians with their locations
      const today = new Date().toISOString().split('T')[0]
      const { data: attendance } = await supabase
        .from('attendance')
        .select('technician_id, latitude, longitude')
        .eq('date', today)
        .is('check_out', null)

      if (!attendance || attendance.length === 0) {
        setNearestTech(null)
        setAutoAssigning(false)
        return
      }

      // Calculate distances
      const withDistances: TechWithDistance[] = []
      for (const att of attendance) {
        if (!att.latitude || !att.longitude) continue
        const tech = technicians.find(t => t.id === att.technician_id)
        if (!tech) continue

        const dist = calculateDistance(issueLat, issueLng, att.latitude, att.longitude)
        withDistances.push({
          ...tech,
          distance: dist,
          lastLocation: { lat: att.latitude, lng: att.longitude }
        })
      }

      if (withDistances.length === 0) {
        setNearestTech(null)
        setAutoAssigning(false)
        return
      }

      // Sort by distance
      withDistances.sort((a, b) => (a.distance || 999) - (b.distance || 999))
      setNearestTech(withDistances[0])
    } catch (err) {
      console.error(err)
    } finally {
      setAutoAssigning(false)
    }
  }

  const handleAutoAssign = () => {
    if (nearestTech) {
      setFormData(prev => ({ ...prev, assigned_to: nearestTech.id }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const submitData: any = { ...formData }
      if (!submitData.assigned_to) submitData.assigned_to = null
      if (!submitData.latitude) submitData.latitude = null
      if (!submitData.longitude) submitData.longitude = null
      if (!submitData.availability_date) submitData.availability_date = null
      submitData.status = submitData.assigned_to ? 'assigned' : 'pending'

      const { error } = await supabase.from('issues').insert(submitData)
      if (error) throw error

      // Send Telegram notification if assigned
      if (submitData.assigned_to) {
        const tech = technicians.find(t => t.id === submitData.assigned_to)
        if (tech) {
          await fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `🔧 <b>New Issue Assigned</b>\n\n👷 Technician: <b>${tech.name}</b>\n🚗 Vehicle: <b>${formData.vehicle_no}</b>\n👤 Client: ${formData.client}\n📍 City: ${formData.city}\n⏰ ${new Date().toLocaleString('en-IN')}`
            })
          }).catch(() => {}) // Don't fail if Telegram fails
        }
      }

      alert('Issue created successfully!')
      router.push('/admin')
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader><CardTitle>Create New Issue</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Vehicle */}
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Vehicle Details</h3>
                <div>
                  <Label>Vehicle Number *</Label>
                  <Input value={formData.vehicle_no} onChange={e => setFormData({ ...formData, vehicle_no: e.target.value })}
                    placeholder="MH01AB1234" required />
                </div>
              </div>

              {/* Client */}
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Client Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Client Name *</Label>
                    <Input value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })}
                      placeholder="Baba Travels" required />
                  </div>
                  <div>
                    <Label>Availability Date</Label>
                    <Input type="date" value={formData.availability_date}
                      onChange={e => setFormData({ ...formData, availability_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>POC Name</Label>
                    <Input value={formData.poc_name} onChange={e => setFormData({ ...formData, poc_name: e.target.value })}
                      placeholder="RAVI" />
                  </div>
                  <div>
                    <Label>POC Number</Label>
                    <Input value={formData.poc_number} onChange={e => setFormData({ ...formData, poc_number: e.target.value })}
                      placeholder="9876543210" />
                  </div>
                </div>
              </div>

              {/* Issue */}
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Issue Details</h3>
                <div>
                  <Label>Issue Description *</Label>
                  <textarea value={formData.issue} onChange={e => setFormData({ ...formData, issue: e.target.value })}
                    placeholder="Device offline issue" className="w-full min-h-[100px] px-3 py-2 border rounded-md bg-background" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Priority *</Label>
                    <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full h-10 px-3 border rounded-md bg-background" required>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <Label>Availability Hours</Label>
                    <Input value={formData.availability} onChange={e => setFormData({ ...formData, availability: e.target.value })}
                      placeholder="9am to 7pm" />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>City</Label>
                    <Input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="Pune" />
                  </div>
                  <div>
                    <Label>Location / Area</Label>
                    <Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Sangamwadi" />
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={getCurrentLocation} disabled={locationLoading}>
                  <MapPin className="h-4 w-4 mr-2" />{locationLoading ? 'Getting...' : 'Get GPS Coordinates'}
                </Button>
                {formData.latitude !== 0 && (
                  <p className="text-sm text-green-600 font-medium">✓ GPS: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}</p>
                )}
              </div>

              {/* Assignment */}
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Assignment</h3>

                {/* Auto-assign suggestion */}
                {nearestTech && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Zap className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-semibold text-blue-700 dark:text-blue-300">
                            Nearest: {nearestTech.name}
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-400">
                            {nearestTech.distance !== undefined
                              ? nearestTech.distance < 1
                                ? `${(nearestTech.distance * 1000).toFixed(0)}m away`
                                : `${nearestTech.distance.toFixed(1)}km away`
                              : 'Distance unknown'}
                            {' • Currently checked in'}
                          </p>
                        </div>
                      </div>
                      <Button type="button" size="sm" onClick={handleAutoAssign}
                        className="bg-blue-600 hover:bg-blue-700">
                        Auto Assign
                      </Button>
                    </div>
                  </div>
                )}

                {autoAssigning && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="animate-spin">⟳</span> Finding nearest technician...
                  </p>
                )}

                {formData.latitude !== 0 && !nearestTech && !autoAssigning && (
                  <p className="text-sm text-yellow-600 flex items-center gap-2">
                    <Users className="h-4 w-4" />No technicians currently checked in nearby
                  </p>
                )}

                <div>
                  <Label>Manual Assignment</Label>
                  <select value={formData.assigned_to} onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full h-10 px-3 border rounded-md bg-background mt-1">
                    <option value="">-- Leave Unassigned --</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name} ({tech.email})
                        {nearestTech?.id === tech.id ? ' ⭐ Nearest' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />{loading ? 'Creating...' : 'Create Issue'}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
