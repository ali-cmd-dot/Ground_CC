'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, MapPin } from 'lucide-react'
import type { Issue, Technician } from '@/lib/types'

export default function EditIssuePage() {
  const router = useRouter()
  const params = useParams()
  const issueId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [locationLoading, setLocationLoading] = useState(false)

  const [formData, setFormData] = useState({
    vehicle_no: '', client: '', poc_name: '', poc_number: '',
    issue: '', city: '', location: '', latitude: 0, longitude: 0,
    availability: '', priority: 'medium', assigned_to: '',
    status: 'pending', availability_date: '', days: 0
  })

  useEffect(() => {
    checkAuth()
    fetchIssue()
    fetchTechnicians()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: tech } = await supabase.from('technicians').select('role').eq('id', session.user.id).single()
    if (tech?.role !== 'admin' && tech?.role !== 'manager') router.push('/technician')
  }

  const fetchIssue = async () => {
    const { data, error } = await supabase.from('issues').select('*').eq('id', issueId).single()
    if (error || !data) { alert('Issue not found'); router.back(); return }
    setFormData({
      vehicle_no: data.vehicle_no || '', client: data.client || '',
      poc_name: data.poc_name || '', poc_number: data.poc_number || '',
      issue: data.issue || '', city: data.city || '',
      location: data.location || '', latitude: data.latitude || 0,
      longitude: data.longitude || 0, availability: data.availability || '',
      priority: data.priority || 'medium', assigned_to: data.assigned_to || '',
      status: data.status || 'pending',
      availability_date: data.availability_date || '',
      days: data.days || 0
    })
    setLoading(false)
  }

  const fetchTechnicians = async () => {
    const { data } = await supabase.from('technicians').select('*').eq('role', 'technician').eq('is_active', true)
    if (data) setTechnicians(data)
  }

  const getCurrentLocation = () => {
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          location: prev.location || `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`
        }))
        setLocationLoading(false)
      },
      err => { alert('Unable to get location: ' + err.message); setLocationLoading(false) }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updateData: any = { ...formData }
      if (!updateData.assigned_to) updateData.assigned_to = null
      if (!updateData.latitude) updateData.latitude = null
      if (!updateData.longitude) updateData.longitude = null
      if (!updateData.availability_date) updateData.availability_date = null
      if (!updateData.days) updateData.days = null

      // Auto set status when assigned
      if (updateData.assigned_to && updateData.status === 'pending') {
        updateData.status = 'assigned'
      }

      const { error } = await supabase.from('issues').update(updateData).eq('id', issueId)
      if (error) throw error
      alert('Issue updated!')
      router.push(`/admin/issues/${issueId}`)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )

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
          <CardHeader><CardTitle>Edit Issue</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Vehicle Details */}
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Vehicle Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Vehicle Number *</Label>
                    <Input value={formData.vehicle_no} onChange={e => setFormData({ ...formData, vehicle_no: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Days</Label>
                    <Input type="number" value={formData.days} onChange={e => setFormData({ ...formData, days: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>

              {/* Client Details */}
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Client Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Client Name *</Label>
                    <Input value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })} required />
                  </div>
                  <div>
                    <Label>POC Name</Label>
                    <Input value={formData.poc_name} onChange={e => setFormData({ ...formData, poc_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>POC Number</Label>
                    <Input value={formData.poc_number} onChange={e => setFormData({ ...formData, poc_number: e.target.value })} />
                  </div>
                  <div>
                    <Label>Availability Date</Label>
                    <Input type="date" value={formData.availability_date} onChange={e => setFormData({ ...formData, availability_date: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Issue Details */}
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Issue Details</h3>
                <div>
                  <Label>Issue Description *</Label>
                  <textarea value={formData.issue} onChange={e => setFormData({ ...formData, issue: e.target.value })}
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md bg-background" required />
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
                    <Label>Status</Label>
                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full h-10 px-3 border rounded-md bg-background">
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <Label>Availability Hours</Label>
                    <Input value={formData.availability} onChange={e => setFormData({ ...formData, availability: e.target.value })} placeholder="9am to 7pm" />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>City</Label>
                    <Input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                  </div>
                  <div>
                    <Label>Location / Area</Label>
                    <Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={getCurrentLocation} disabled={locationLoading}>
                  <MapPin className="h-4 w-4 mr-2" />
                  {locationLoading ? 'Getting...' : 'Get GPS Coordinates'}
                </Button>
                {formData.latitude !== 0 && (
                  <p className="text-sm text-green-600 font-medium">
                    ✓ GPS: {Number(formData.latitude).toFixed(6)}, {Number(formData.longitude).toFixed(6)}
                  </p>
                )}
              </div>

              {/* Assignment */}
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Assignment</h3>
                <div>
                  <Label>Assign to Technician</Label>
                  <select value={formData.assigned_to} onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full h-10 px-3 border rounded-md bg-background">
                    <option value="">-- Unassigned --</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>{tech.name} ({tech.email})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={saving} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}
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
