'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, MapPin, Zap, Users, Link, CheckCircle, AlertTriangle } from 'lucide-react'
import type { Technician } from '@/lib/types'

interface TechWithDistance extends Technician {
  distance?: number
  lastLocation?: { lat: number; lng: number }
}

export default function CreateIssuePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [technicians, setTechnicians] = useState<TechWithDistance[]>([])
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [nearestTech, setNearestTech] = useState<TechWithDistance | null>(null)
  const [mapsLink, setMapsLink] = useState('')
  const [linkError, setLinkError] = useState('')
  const [linkSuccess, setLinkSuccess] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState('')
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)

  const [formData, setFormData] = useState({
    vehicle_no: '', client: '', poc_name: '', poc_number: '',
    issue: '', city: '', location: '', latitude: 0, longitude: 0,
    availability: '', priority: 'medium', assigned_to: '',
    availability_date: ''
  })

  useEffect(() => { fetchTechnicians() }, [])

  useEffect(() => {
    if (formData.latitude && formData.longitude) {
      findNearestTechnician(formData.latitude, formData.longitude)
    }
  }, [formData.latitude, formData.longitude])

  const fetchTechnicians = async () => {
    const { data } = await supabase.from('technicians').select('*')
      .eq('role', 'technician').eq('is_active', true)
    if (data) setTechnicians(data)
  }

  const extractCoordsFromLink = (url: string): { lat: number; lng: number } | null => {
    try {
      const patterns = [
        /query=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
        /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
        /place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,
        /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
        /destination=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
        /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
      ]
      for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }
      }
      return null
    } catch { return null }
  }

  const handleLinkExtract = () => {
    setLinkError(''); setLinkSuccess(false)
    if (!mapsLink.trim()) { setLinkError('Please enter a link first'); return }
    const coords = extractCoordsFromLink(mapsLink)
    if (!coords) {
      setLinkError('Invalid Google Maps link. Supported formats: maps.google.com/?q=lat,lng or any share link')
      return
    }
    setFormData(prev => ({ ...prev, latitude: coords.lat, longitude: coords.lng }))
    setLinkSuccess(true)
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
      const today = new Date().toISOString().split('T')[0]
      const { data: attendance } = await supabase
        .from('attendance').select('technician_id, latitude, longitude')
        .eq('date', today).is('check_out', null)
      if (!attendance || attendance.length === 0) { setNearestTech(null); return }
      const withDistances: TechWithDistance[] = []
      for (const att of attendance) {
        if (!att.latitude || !att.longitude) continue
        const tech = technicians.find(t => t.id === att.technician_id)
        if (!tech) continue
        withDistances.push({
          ...tech,
          distance: calculateDistance(issueLat, issueLng, att.latitude, att.longitude),
          lastLocation: { lat: att.latitude, lng: att.longitude }
        })
      }
      withDistances.sort((a, b) => (a.distance || 999) - (b.distance || 999))
      setNearestTech(withDistances[0] || null)
    } finally { setAutoAssigning(false) }
  }

  const checkDuplicate = async (vehicleNo: string) => {
    if (!vehicleNo || vehicleNo.length < 4) { setDuplicateWarning(''); return }
    setCheckingDuplicate(true)
    const { data } = await supabase.from('issues').select('id, status')
      .eq('vehicle_no', vehicleNo.toUpperCase())
      .not('status', 'in', '("completed","cancelled")')
    setCheckingDuplicate(false)
    if (data && data.length > 0) {
      setDuplicateWarning(`${vehicleNo.toUpperCase()} already has an open issue (Status: ${data[0].status}). A new issue can only be added after this one is closed.`)
    } else {
      setDuplicateWarning('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (duplicateWarning && !confirm('Is vehicle ka issue already open hai. Phir bhi add karna hai?')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('issues').insert({
        ...formData,
        vehicle_no: formData.vehicle_no.toUpperCase(),
        assigned_to: formData.assigned_to || null,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        availability_date: formData.availability_date || null,
        status: formData.assigned_to ? 'assigned' : 'pending'
      })
      if (error) throw error
      const tech = technicians.find(t => t.id === formData.assigned_to)
      if (tech) {
        await fetch('/api/telegram', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `🔧 <b>Issue Assigned</b>\n\n👷 ${tech.name}\n🚗 ${formData.vehicle_no.toUpperCase()}\n👤 ${formData.client}\n📍 ${formData.city}` })
        }).catch(() => {})
      }
      alert('Issue created successfully!')
      router.push('/admin')
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally { setLoading(false) }
  }

  const inputClass = "mt-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-blue-500/50 focus:ring-blue-500/20"
  const labelClass = "text-gray-400 text-sm font-medium"
  const sectionClass = "bg-[#0d0d16] border border-white/8 rounded-2xl p-6"

  return (
    <div className="min-h-screen bg-[#080810]">
      <header className="bg-[#0a0a12] border-b border-white/8 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.back()} className="text-gray-400 hover:text-white h-9 px-3">
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          <h1 className="text-lg font-bold text-white">Create New Issue</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Vehicle */}
          <div className={sectionClass}>
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">🚗 Vehicle</h3>
            <div>
              <Label className={labelClass}>Vehicle Number *</Label>
              <Input value={formData.vehicle_no}
                onChange={e => { const v = e.target.value.toUpperCase(); setFormData({ ...formData, vehicle_no: v }); checkDuplicate(v) }}
                placeholder="MH01AB1234" required className={inputClass + " uppercase font-mono text-lg tracking-widest"} />
              {checkingDuplicate && <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1"><span className="animate-spin inline-block">⟳</span> Checking...</p>}
              {duplicateWarning && (
                <div className="mt-2 flex items-start gap-2 bg-orange-500/10 border border-orange-500/25 rounded-xl px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-orange-300">{duplicateWarning}</p>
                </div>
              )}
            </div>
          </div>

          {/* Client */}
          <div className={sectionClass}>
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">👤 Client Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className={labelClass}>Client Name *</Label>
                <Input value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })}
                  placeholder="Baba Travels" required className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}>Availability Date</Label>
                <Input type="date" value={formData.availability_date}
                  onChange={e => setFormData({ ...formData, availability_date: e.target.value })}
                  className={inputClass + " "} />
              </div>
              <div>
                <Label className={labelClass}>POC Name</Label>
                <Input value={formData.poc_name} onChange={e => setFormData({ ...formData, poc_name: e.target.value })}
                  placeholder="RAVI" className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}>POC Number</Label>
                <Input value={formData.poc_number} onChange={e => setFormData({ ...formData, poc_number: e.target.value })}
                  placeholder="9876543210" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Issue */}
          <div className={sectionClass}>
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">🔧 Issue Details</h3>
            <div className="space-y-4">
              <div>
                <Label className={labelClass}>Issue Description *</Label>
                <textarea value={formData.issue} onChange={e => setFormData({ ...formData, issue: e.target.value })}
                  placeholder="Device offline, GPS not tracking..." required
                  rows={3}
                  className="w-full mt-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className={labelClass}>Priority *</Label>
                  <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full mt-1 h-10 px-3 border border-white/10 rounded-lg text-white text-sm"
                    style={{ background: '#1a1a2e', colorScheme: 'dark' }} required>
                    <option value="low" style={{ background: '#1a1a2e' }}>Low</option>
                    <option value="medium" style={{ background: '#1a1a2e' }}>Medium</option>
                    <option value="high" style={{ background: '#1a1a2e' }}>High</option>
                    <option value="urgent" style={{ background: '#1a1a2e' }}>Urgent</option>
                  </select>
                </div>
                <div>
                  <Label className={labelClass}>Availability Hours</Label>
                  <Input value={formData.availability} onChange={e => setFormData({ ...formData, availability: e.target.value })}
                    placeholder="9am to 7pm" className={inputClass} />
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className={sectionClass}>
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">📍 Location</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <Label className={labelClass}>City</Label>
                <Input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Pune" className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}>Location / Area</Label>
                <Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Sangamwadi" className={inputClass} />
              </div>
            </div>

            {/* Google Maps Link */}
            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-300 mb-1 flex items-center gap-2">
                <Link className="h-4 w-4" />GPS from Google Maps Link
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Google Maps → Open location → Share → Copy Link → Paste here
              </p>
              <div className="flex gap-2">
                <Input value={mapsLink}
                  onChange={e => { setMapsLink(e.target.value); setLinkSuccess(false); setLinkError('') }}
                  placeholder="https://maps.google.com/..."
                  className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-600 text-xs" />
                <Button type="button" onClick={handleLinkExtract}
                  className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                  <MapPin className="h-4 w-4 mr-1.5" />Extract
                </Button>
              </div>
              {linkError && <p className="text-xs text-red-400 mt-2 flex items-center gap-1">⚠ {linkError}</p>}
              {(linkSuccess || formData.latitude !== 0) && (
                <div className="flex items-center gap-2 mt-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <p className="text-sm text-green-400 font-mono">
                    {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Assignment */}
          <div className={sectionClass}>
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4">👷 Assignment</h3>
            {nearestTech && (
              <div className="mb-4 bg-green-500/8 border border-green-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{nearestTech.name} — Nearest Available</p>
                      <p className="text-xs text-green-300">
                        {nearestTech.distance !== undefined
                          ? nearestTech.distance < 1 ? `${(nearestTech.distance * 1000).toFixed(0)}m away` : `${nearestTech.distance.toFixed(1)}km away`
                          : ''} • Checked in today
                      </p>
                    </div>
                  </div>
                  <Button type="button" size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, assigned_to: nearestTech.id }))}
                    className="bg-green-600 hover:bg-green-700 shrink-0">Auto Assign</Button>
                </div>
              </div>
            )}
            {autoAssigning && <p className="text-sm text-gray-400 mb-4 flex items-center gap-2"><span className="animate-spin">⟳</span> Finding nearest technician...</p>}
            {formData.latitude !== 0 && !nearestTech && !autoAssigning && (
              <p className="text-sm text-yellow-400 mb-4 flex items-center gap-2"><Users className="h-4 w-4" />No active technicians nearby</p>
            )}
            <Label className={labelClass}>Assign to Technician</Label>
            <select value={formData.assigned_to}
              onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full mt-1 h-10 px-3 border border-white/10 rounded-lg text-white text-sm"
              style={{ background: '#1a1a2e', colorScheme: 'dark' }}>
              <option value="" style={{ background: '#1a1a2e' }}>-- Leave Unassigned --</option>
              {technicians.map(tech => (
                <option key={tech.id} value={tech.id} style={{ background: '#1a1a2e' }}>
                  {tech.name}{(tech as any).cities ? ` — ${(tech as any).cities}` : ''}
                  {nearestTech?.id === tech.id ? ' ★ Nearest' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl">
              <Save className="h-5 w-5 mr-2" />{loading ? 'Creating...' : 'Create Issue'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}
              className="h-12 px-6 border-white/10 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl">
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
