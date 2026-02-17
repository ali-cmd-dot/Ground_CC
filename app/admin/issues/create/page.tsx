'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, MapPin } from 'lucide-react'

interface Technician {
  id: string
  name: string
  email: string
}

export default function CreateIssuePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    vehicle_no: '',
    client: '',
    poc_name: '',
    poc_number: '',
    issue: '',
    city: '',
    location: '',
    latitude: 0,
    longitude: 0,
    availability: '',
    priority: 'medium',
    assigned_to: ''
  })

  useEffect(() => {
    fetchTechnicians()
  }, [])

  const fetchTechnicians = async () => {
    const { data } = await supabase
      .from('technicians')
      .select('id, name, email')
      .eq('role', 'technician')
    
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
          location: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
        }))
        setLocationLoading(false)
      },
      (error) => {
        alert('Unable to get location: ' + error.message)
        setLocationLoading(false)
      }
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.from('issues').insert({
        ...formData,
        status: formData.assigned_to ? 'assigned' : 'pending'
      })

      if (error) throw error

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
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Issue</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Vehicle Details */}
              <div className="space-y-4">
                <h3 className="font-semibold">Vehicle Details</h3>
                
                <div>
                  <Label htmlFor="vehicle_no">Vehicle Number *</Label>
                  <Input
                    id="vehicle_no"
                    value={formData.vehicle_no}
                    onChange={(e) => setFormData({...formData, vehicle_no: e.target.value})}
                    placeholder="MH01AB1234"
                    required
                  />
                </div>
              </div>

              {/* Client Details */}
              <div className="space-y-4">
                <h3 className="font-semibold">Client Details</h3>
                
                <div>
                  <Label htmlFor="client">Client Name *</Label>
                  <Input
                    id="client"
                    value={formData.client}
                    onChange={(e) => setFormData({...formData, client: e.target.value})}
                    placeholder="Baba Travels"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="poc_name">POC Name</Label>
                    <Input
                      id="poc_name"
                      value={formData.poc_name}
                      onChange={(e) => setFormData({...formData, poc_name: e.target.value})}
                      placeholder="RAVI"
                    />
                  </div>

                  <div>
                    <Label htmlFor="poc_number">POC Number</Label>
                    <Input
                      id="poc_number"
                      value={formData.poc_number}
                      onChange={(e) => setFormData({...formData, poc_number: e.target.value})}
                      placeholder="9876543210"
                    />
                  </div>
                </div>
              </div>

              {/* Issue Details */}
              <div className="space-y-4">
                <h3 className="font-semibold">Issue Details</h3>
                
                <div>
                  <Label htmlFor="issue">Issue Description *</Label>
                  <textarea
                    id="issue"
                    value={formData.issue}
                    onChange={(e) => setFormData({...formData, issue: e.target.value})}
                    placeholder="Device offline issue"
                    className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">Priority *</Label>
                    <select
                      id="priority"
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value})}
                      className="w-full h-10 px-3 border rounded-md"
                      required
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="availability">Availability</Label>
                    <Input
                      id="availability"
                      value={formData.availability}
                      onChange={(e) => setFormData({...formData, availability: e.target.value})}
                      placeholder="9am to 7pm"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="font-semibold">Location</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      placeholder="Pune"
                    />
                  </div>

                  <div>
                    <Label htmlFor="location">Location/Area</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      placeholder="Sangamwadi"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={getCurrentLocation}
                  disabled={locationLoading}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {locationLoading ? 'Getting Location...' : 'Get GPS Coordinates'}
                </Button>

                {formData.latitude !== 0 && (
                  <p className="text-sm text-green-600">
                    GPS: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                  </p>
                )}
              </div>

              {/* Assignment */}
              <div className="space-y-4">
                <h3 className="font-semibold">Assignment (Optional)</h3>
                
                <div>
                  <Label htmlFor="assigned_to">Assign to Technician</Label>
                  <select
                    id="assigned_to"
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
                    className="w-full h-10 px-3 border rounded-md"
                  >
                    <option value="">-- Leave Unassigned --</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name} ({tech.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Creating...' : 'Create Issue'}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
